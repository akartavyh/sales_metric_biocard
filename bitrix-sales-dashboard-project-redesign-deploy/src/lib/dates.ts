import { DateRange } from "../types";
import Holidays from "date-holidays";

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const MOSCOW_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Moscow",
});

const RU_HOLIDAYS = new Holidays("RU");
const RU_EXTRA_NON_WORKING_DAYS = new Set<string>([
  // 2026 official transfers and extra days off from production calendar
  "2026-01-09",
  "2026-03-09",
  "2026-05-11",
  "2026-12-31",
]);

const OBSERVED_RU_HOLIDAY_CACHE = new Map<number, Set<string>>();

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPublicHolidayInRussia(value: Date): boolean {
  const holidayMeta = RU_HOLIDAYS.isHoliday(value);
  const holidayList = Array.isArray(holidayMeta) ? holidayMeta : holidayMeta ? [holidayMeta] : [];
  return holidayList.some((item) => item.type === "public");
}

function getObservedRussianHolidayDays(year: number): Set<string> {
  const cached = OBSERVED_RU_HOLIDAY_CACHE.get(year);
  if (cached) {
    return cached;
  }

  const observed = new Set<string>();
  const dayCursor = new Date(year, 0, 1);
  const dayEnd = new Date(year, 11, 31);

  while (dayCursor.getTime() <= dayEnd.getTime()) {
    const day = dayCursor.getDay();
    const isWeekend = day === 0 || day === 6;
    const isPublicHoliday = isPublicHolidayInRussia(dayCursor);

    // For public holidays on weekend (except Jan 1-8), add observed day off on next business day.
    if (isWeekend && isPublicHoliday) {
      const month = dayCursor.getMonth();
      const date = dayCursor.getDate();
      const isJanHolidayWindow = month === 0 && date >= 1 && date <= 8;

      if (!isJanHolidayWindow) {
        const observedDate = new Date(dayCursor);
        observedDate.setDate(observedDate.getDate() + 1);
        while (
          observedDate.getDay() === 0 ||
          observedDate.getDay() === 6 ||
          isPublicHolidayInRussia(observedDate) ||
          observed.has(toDateKey(observedDate))
        ) {
          observedDate.setDate(observedDate.getDate() + 1);
        }
        if (observedDate.getFullYear() === year) {
          observed.add(toDateKey(observedDate));
        }
      }
    }

    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  OBSERVED_RU_HOLIDAY_CACHE.set(year, observed);
  return observed;
}

export function parseExcelDate(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Excel parsers may return Date-like objects from a different runtime realm.
  if (
    typeof value === "object" &&
    value !== null &&
    "getTime" in value &&
    typeof (value as { getTime: unknown }).getTime === "function"
  ) {
    const timestamp = (value as { getTime: () => number }).getTime();
    if (Number.isFinite(timestamp)) {
      const parsed = new Date(timestamp);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(excelEpoch + Math.round(value * 86400000));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return parseExcelDate(Number(trimmed));
    }

    const ruMatch = trimmed.match(
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (ruMatch) {
      const [, day, month, year, hour = "0", minute = "0", second = "0"] = ruMatch;
      const parsed = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      );
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const isoParsed = new Date(trimmed);
    return Number.isNaN(isoParsed.getTime()) ? null : isoParsed;
  }

  return null;
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  return DATE_FORMATTER.format(value);
}

export function formatDateTime(value: Date | null | undefined): string {
  if (!value) {
    return "—";
  }
  return DATE_TIME_FORMATTER.format(value);
}

export function formatPercent(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainSeconds = safeSeconds % 60;
  return `${minutes}:${remainSeconds.toString().padStart(2, "0")}`;
}

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

export function endOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

export function isWithinRange(date: Date | null, range: DateRange): boolean {
  if (!date) {
    return false;
  }

  const time = date.getTime();
  if (range.start && time < startOfDay(range.start).getTime()) {
    return false;
  }
  if (range.end && time > endOfDay(range.end).getTime()) {
    return false;
  }
  return true;
}

export function getWorkingDaysCount(start: Date | null, end: Date | null): number {
  if (!start || !end) {
    return 0;
  }

  const current = startOfDay(start);
  const final = startOfDay(end);
  if (current.getTime() > final.getTime()) {
    return 0;
  }

  let workingDays = 0;
  while (current.getTime() <= final.getTime()) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      workingDays += 1;
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
}

export function getRussianWorkingDaysCount(start: Date | null, end: Date | null): number {
  if (!start || !end) {
    return 0;
  }

  const current = startOfDay(start);
  const final = startOfDay(end);
  if (current.getTime() > final.getTime()) {
    return 0;
  }

  let workingDays = 0;
  while (current.getTime() <= final.getTime()) {
    const dateKey = toDateKey(current);
    const observedDays = getObservedRussianHolidayDays(current.getFullYear());
    if (RU_EXTRA_NON_WORKING_DAYS.has(dateKey) || observedDays.has(dateKey)) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const weekday = current.getDay();
    const isPublicHoliday = isPublicHolidayInRussia(current);
    const isWeekend = weekday === 0 || weekday === 6;
    if (!isWeekend && !isPublicHoliday) {
      workingDays += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

export function getDaysDifference(from: Date, to: Date): number {
  const fromTs = startOfDay(from).getTime();
  const toTs = startOfDay(to).getTime();
  return Math.max(0, Math.floor((toTs - fromTs) / 86400000));
}

export function dateToInputValue(date: Date | null): string {
  if (!date) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function inputValueToDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDateRangeExtremes(dates: Array<Date | null | undefined>): DateRange {
  const validDates = dates.filter((item): item is Date => item instanceof Date && !Number.isNaN(item.getTime()));
  if (!validDates.length) {
    return { start: null, end: null };
  }

  const timestamps = validDates.map((item) => item.getTime());
  return {
    start: new Date(Math.min(...timestamps)),
    end: new Date(Math.max(...timestamps)),
  };
}

export function monthToDateRange(monthValue: string): DateRange {
  if (!monthValue) {
    return { start: null, end: null };
  }
  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    return { start: null, end: null };
  }
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0),
  };
}

export function dateToMonthValue(date: Date | null): string {
  if (!date) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getCurrentMonthValue(): string {
  return dateToMonthValue(new Date());
}

export function getWorkingDaysInMonth(monthValue: string): number {
  const range = monthToDateRange(monthValue);
  return getRussianWorkingDaysCount(range.start, range.end);
}

export function getPlanRangeToCurrentDate(monthValue: string, now: Date = new Date()): DateRange {
  const monthRange = monthToDateRange(monthValue);
  if (!monthRange.start || !monthRange.end) {
    return monthRange;
  }

  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const monthStart = startOfDay(monthRange.start);
  const monthEnd = startOfDay(monthRange.end);

  const cappedEnd = yesterday.getTime() < monthEnd.getTime() ? yesterday : monthEnd;

  if (cappedEnd.getTime() < monthStart.getTime()) {
    const beforeMonthStart = new Date(monthStart);
    beforeMonthStart.setDate(beforeMonthStart.getDate() - 1);
    return {
      start: monthStart,
      end: beforeMonthStart,
    };
  }

  return {
    start: monthStart,
    end: cappedEnd,
  };
}

export function formatMoscowDateTime(value: Date): string {
  return MOSCOW_DATE_TIME_FORMATTER.format(value);
}
