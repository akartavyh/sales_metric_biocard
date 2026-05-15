import {
  CallRow,
  DailyCallsPoint,
  DailyCreatedPoint,
  DailyMeetingsPoint,
  DateRange,
  DealRow,
  GroupComparisonRow,
  GroupManagerStats,
  LeadClassification,
  LeadRow,
  ManagerMetrics,
  MeetingRow,
  MeetingStatusClassification,
  MeetingsByManagerPoint,
  StageClassification,
} from "../types";
import { formatDate, getRussianWorkingDaysCount, isWithinRange, parseExcelDate, startOfDay } from "./dates";

export const WON_DEAL_STAGE_KEYWORDS = ["WON", "SUCCESS", "РЈРЎРџР•РҐ", "Р’Р«РР“Р "];
export const LOST_DEAL_STAGE_KEYWORDS = ["LOSE", "LOST", "FAIL", "РџР РћРР“", "РћРўРљРђР—"];
export const SUCCESS_LEAD_STAGE_KEYWORDS = ["CONVERTED", "SUCCESS", "WON", "РЈРЎРџР•РҐ", "РЎРљРћРќР’Р•Р Рў"];
export const LOST_LEAD_STAGE_KEYWORDS = ["JUNK", "LOSE", "LOST", "FAIL", "РџР РћРР“", "РћРўРљРђР—", "РќР•РљРђР§"];

const RU_MEETING_STATUS_KEY = "\u0421\u0442\u0430\u0442\u0443\u0441 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f";

function normalizeStageValue(value: string): string {
  return value.trim().toUpperCase();
}

function toDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function matchesKeyword(stageValue: string, keywords: string[]): boolean {
  const normalizedStage = normalizeStageValue(stageValue);
  return keywords.some((keyword) => normalizedStage.includes(keyword.toUpperCase()));
}

export function classifyDealStage(
  stageId: string,
  wonKeywords: string[] = WON_DEAL_STAGE_KEYWORDS,
  lostKeywords: string[] = LOST_DEAL_STAGE_KEYWORDS,
): StageClassification {
  if (matchesKeyword(stageId, wonKeywords)) {
    return "won";
  }
  if (matchesKeyword(stageId, lostKeywords)) {
    return "lost";
  }
  return "active";
}

export function classifyLeadStage(
  stageId: string,
  successKeywords: string[] = SUCCESS_LEAD_STAGE_KEYWORDS,
  lostKeywords: string[] = LOST_LEAD_STAGE_KEYWORDS,
): LeadClassification {
  if (matchesKeyword(stageId, successKeywords)) {
    return "success";
  }
  if (matchesKeyword(stageId, lostKeywords)) {
    return "lost";
  }
  return "active";
}

export function isOutgoingCall(call: CallRow): boolean {
  if (!call.hasCallType || !call.callType) {
    return true;
  }

  const normalized = call.callType.toUpperCase().trim();
  if (!normalized) {
    return true;
  }

  if (normalized.includes("IN") || normalized.includes("Р’РҐРћР”")) {
    return false;
  }

  return (
    normalized === "1" ||
    normalized === "2" ||
    normalized.includes("OUT") ||
    normalized.includes("РРЎРҐРћР”")
  );
}

export function isQualifiedCall(call: CallRow): boolean {
  return call.callDuration > 14 && isOutgoingCall(call);
}

export function parseMeetingDate(meeting: Pick<MeetingRow, "DEADLINE" | "START_TIME" | "CREATED" | "meetingDate">): Date | null {
  if ("meetingDate" in meeting && meeting.meetingDate) {
    return meeting.meetingDate;
  }
  return parseExcelDate(meeting.DEADLINE ?? meeting.START_TIME ?? meeting.CREATED);
}

export function classifyMeetingStatus(
  meeting: Pick<MeetingRow, "COMPLETED" | "meetingStatus"> & Partial<Record<typeof RU_MEETING_STATUS_KEY, string>>,
): MeetingStatusClassification {
  if ("meetingStatus" in meeting && meeting.meetingStatus) {
    return meeting.meetingStatus;
  }

  const statusText = String(meeting[RU_MEETING_STATUS_KEY] ?? "")
    .trim()
    .toUpperCase();
  const completedText = String(meeting.COMPLETED ?? "")
    .trim()
    .toUpperCase();

  if (
    statusText.includes("\u041d\u0415 \u0412\u042b\u041f\u041e\u041b\u041d\u0415\u041d") ||
    statusText.includes("NOT") ||
    completedText === "N"
  ) {
    return "not_completed";
  }
  if (
    statusText.includes("\u0412\u042b\u041f\u041e\u041b\u041d\u0415\u041d") ||
    statusText.includes("DONE") ||
    statusText.includes("COMPLETED") ||
    completedText === "Y"
  ) {
    return "completed";
  }
  return "unknown";
}

export function calculateCallPlan(
  start: Date | null,
  end: Date | null,
  managersCount: number,
): number {
  if (managersCount <= 0) {
    return 0;
  }

  const workingDays = getRussianWorkingDaysCount(start, end);
  return 25 * workingDays * managersCount;
}

type CalendarWeekSlice = {
  weekStart: Date;
  weekEnd: Date;
  coveredStart: Date;
  coveredEnd: Date;
};

function startOfWeekMonday(value: Date): Date {
  const start = startOfDay(value);
  const day = start.getDay();
  const offset = (day + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function endOfWeekSunday(value: Date): Date {
  const monday = startOfWeekMonday(value);
  monday.setDate(monday.getDate() + 6);
  return startOfDay(monday);
}

export function splitPeriodByCalendarWeeks(startDate: Date | null, endDate: Date | null): CalendarWeekSlice[] {
  if (!startDate || !endDate) {
    return [];
  }

  const rangeStart = startOfDay(startDate);
  const rangeEnd = startOfDay(endDate);
  if (rangeStart.getTime() > rangeEnd.getTime()) {
    return [];
  }

  const weeks: CalendarWeekSlice[] = [];
  let cursor = startOfWeekMonday(rangeStart);
  while (cursor.getTime() <= rangeEnd.getTime()) {
    const weekStart = startOfDay(cursor);
    const weekEnd = endOfWeekSunday(cursor);

    const coveredStart = new Date(Math.max(weekStart.getTime(), rangeStart.getTime()));
    const coveredEnd = new Date(Math.min(weekEnd.getTime(), rangeEnd.getTime()));
    if (coveredStart.getTime() <= coveredEnd.getTime()) {
      weeks.push({
        weekStart,
        weekEnd,
        coveredStart,
        coveredEnd,
      });
    }

    cursor = new Date(weekStart);
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

export function isFullCalendarWeekCovered(week: CalendarWeekSlice): boolean {
  return (
    startOfDay(week.coveredStart).getTime() === startOfDay(week.weekStart).getTime() &&
    startOfDay(week.coveredEnd).getTime() === startOfDay(week.weekEnd).getTime()
  );
}

export function calculateMeetingPlan(startDate: Date | null, endDate: Date | null, managersCount: number): number {
  if (managersCount <= 0 || !startDate || !endDate) {
    return 0;
  }

  const weeklyPlanPerManager = splitPeriodByCalendarWeeks(startDate, endDate).reduce((sum, week) => {
    return sum + (isFullCalendarWeekCovered(week) ? 2 : 1);
  }, 0);

  return weeklyPlanPerManager * managersCount;
}

function uniqueManagersFromRows(
  calls: CallRow[],
  deals: DealRow[],
  leads: LeadRow[],
  meetings: MeetingRow[],
): string[] {
  return Array.from(
    new Set(
      [...calls, ...deals, ...leads, ...meetings]
        .map((row) => row.manager.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));
}

function filterMeetingsByRange(meetings: MeetingRow[], range: DateRange, managerMatcher: (manager: string) => boolean): MeetingRow[] {
  return meetings.filter((meeting) => managerMatcher(meeting.manager) && isWithinRange(parseMeetingDate(meeting), range));
}

export function buildMeetingMetrics(params: {
  meetings: MeetingRow[];
  range: DateRange;
  planRange?: DateRange;
  selectedManager: string;
  managerList?: string[];
}): Array<{
  manager: string;
  meetingsCount: number;
  meetingPlan: number;
  meetingPlanCompletionPercent: number;
  completedMeetings: number;
  notCompletedMeetings: number;
  unknownStatusMeetings: number;
}> {
  const { meetings, range, selectedManager, planRange, managerList } = params;
  const managerMatcher = (manager: string) => selectedManager === "ALL" || manager === selectedManager;
  const filteredMeetings = filterMeetingsByRange(meetings, range, managerMatcher);
  const managers =
    selectedManager === "ALL"
      ? (managerList?.length ? managerList : Array.from(new Set(filteredMeetings.map((row) => row.manager))).sort((a, b) => a.localeCompare(b, "ru")))
      : [selectedManager];

  const meetingPlanPerManager = calculateMeetingPlan(
    planRange?.start ?? range.start,
    planRange?.end ?? range.end,
    1,
  );

  return managers.map((manager) => {
    const managerMeetings = filteredMeetings.filter((meeting) => meeting.manager === manager);
    const completedMeetings = managerMeetings.filter((meeting) => classifyMeetingStatus(meeting) === "completed").length;
    const notCompletedMeetings = managerMeetings.filter((meeting) => classifyMeetingStatus(meeting) === "not_completed").length;
    const unknownStatusMeetings = managerMeetings.length - completedMeetings - notCompletedMeetings;
    const meetingsCount = completedMeetings;
    const meetingPlanCompletionPercent = meetingPlanPerManager > 0 ? (meetingsCount / meetingPlanPerManager) * 100 : 0;

    return {
      manager,
      meetingsCount,
      meetingPlan: meetingPlanPerManager,
      meetingPlanCompletionPercent,
      completedMeetings,
      notCompletedMeetings,
      unknownStatusMeetings,
    };
  });
}

export function buildManagerMetrics(params: {
  calls: CallRow[];
  deals: DealRow[];
  leads: LeadRow[];
  meetings: MeetingRow[];
  range: DateRange;
  planRange?: DateRange;
  selectedManager: string;
}): ManagerMetrics[] {
  const { calls, deals, leads, meetings, range, selectedManager, planRange } = params;

  const managerMatcher = (manager: string) =>
    selectedManager === "ALL" || manager === selectedManager;

  const filteredCalls = calls.filter(
    (call) => managerMatcher(call.manager) && isQualifiedCall(call) && isWithinRange(call.callStartDate, range),
  );
  const filteredDeals = deals.filter(
    (deal) => managerMatcher(deal.manager) && isWithinRange(deal.createdTime, range),
  );
  const filteredLeads = leads.filter(
    (lead) => managerMatcher(lead.manager) && isWithinRange(lead.createdTime, range),
  );
  const filteredMeetings = filterMeetingsByRange(meetings, range, managerMatcher);

  const managers = selectedManager === "ALL"
    ? uniqueManagersFromRows(filteredCalls, filteredDeals, filteredLeads, filteredMeetings)
    : [selectedManager];

  const callPlanPerManager = calculateCallPlan(
    planRange?.start ?? range.start,
    planRange?.end ?? range.end,
    1,
  );
  const meetingPlanPerManager = calculateMeetingPlan(
    planRange?.start ?? range.start,
    planRange?.end ?? range.end,
    1,
  );

  return managers
    .map((manager) => {
      const managerCalls = filteredCalls.filter((call) => call.manager === manager);
      const managerDeals = filteredDeals.filter((deal) => deal.manager === manager);
      const managerLeads = filteredLeads.filter((lead) => lead.manager === manager);
      const managerMeetings = filteredMeetings.filter((meeting) => meeting.manager === manager);

      const dealsWon = managerDeals.filter((deal) => classifyDealStage(deal.stageId) === "won").length;
      const dealsLost = managerDeals.filter((deal) => classifyDealStage(deal.stageId) === "lost").length;
      const dealsInProgress = managerDeals.length - dealsWon - dealsLost;
      const dealConversion = managerDeals.length > 0 ? (dealsWon / managerDeals.length) * 100 : 0;

      const leadsSuccessful = managerLeads.filter((lead) => classifyLeadStage(lead.stageId) === "success").length;
      const leadsLost = managerLeads.filter((lead) => classifyLeadStage(lead.stageId) === "lost").length;
      const leadsInProgress = managerLeads.length - leadsSuccessful - leadsLost;
      const leadConversion =
        managerLeads.length > 0 ? (leadsSuccessful / managerLeads.length) * 100 : 0;

      const callCount = managerCalls.length;
      const callPlanCompletion = callPlanPerManager > 0 ? (callCount / callPlanPerManager) * 100 : 0;

      const completedMeetings = managerMeetings.filter((meeting) => classifyMeetingStatus(meeting) === "completed").length;
      const notCompletedMeetings = managerMeetings.filter((meeting) => classifyMeetingStatus(meeting) === "not_completed").length;
      const unknownStatusMeetings = managerMeetings.length - completedMeetings - notCompletedMeetings;
      const meetingsCount = completedMeetings;
      const meetingPlanCompletionPercent = meetingPlanPerManager > 0 ? (meetingsCount / meetingPlanPerManager) * 100 : 0;

      return {
        manager,
        callCount,
        callPlan: callPlanPerManager,
        callPlanCompletion,
        meetingsCount,
        meetingPlan: meetingPlanPerManager,
        meetingPlanCompletionPercent,
        completedMeetings,
        notCompletedMeetings,
        unknownStatusMeetings,
        dealCount: managerDeals.length,
        dealsWon,
        dealsLost,
        dealsInProgress,
        dealConversion,
        leadCount: managerLeads.length,
        leadsSuccessful,
        leadsLost,
        leadsInProgress,
        leadConversion,
      };
    })
    .sort((a, b) => {
      if (a.callPlanCompletion !== b.callPlanCompletion) {
        return a.callPlanCompletion - b.callPlanCompletion;
      }
      if (a.meetingPlanCompletionPercent !== b.meetingPlanCompletionPercent) {
        return a.meetingPlanCompletionPercent - b.meetingPlanCompletionPercent;
      }
      if (a.dealConversion !== b.dealConversion) {
        return a.dealConversion - b.dealConversion;
      }
      if (a.leadConversion !== b.leadConversion) {
        return a.leadConversion - b.leadConversion;
      }
      return a.manager.localeCompare(b.manager, "ru");
    });
}

export function buildCallsTrend(
  calls: CallRow[],
  range: DateRange,
  selectedManager: string,
): DailyCallsPoint[] {
  const managerMatcher = (manager: string) =>
    selectedManager === "ALL" || manager === selectedManager;

  const counts = new Map<string, number>();
  calls.forEach((call) => {
    if (!managerMatcher(call.manager) || !isQualifiedCall(call) || !isWithinRange(call.callStartDate, range)) {
      return;
    }
    const key = toDateKey(call.callStartDate!);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, callsCount]) => ({
      dateKey,
      label: formatDate(fromDateKey(dateKey)),
      calls: callsCount,
    }));
}

export function buildCreatedTrend(
  deals: DealRow[],
  leads: LeadRow[],
  range: DateRange,
  selectedManager: string,
): DailyCreatedPoint[] {
  const managerMatcher = (manager: string) =>
    selectedManager === "ALL" || manager === selectedManager;

  const summary = new Map<string, DailyCreatedPoint>();

  deals.forEach((deal) => {
    if (!managerMatcher(deal.manager) || !isWithinRange(deal.createdTime, range)) {
      return;
    }
    const key = toDateKey(deal.createdTime!);
    const current = summary.get(key) ?? {
      dateKey: key,
      label: formatDate(fromDateKey(key)),
      deals: 0,
      leads: 0,
    };
    current.deals += 1;
    summary.set(key, current);
  });

  leads.forEach((lead) => {
    if (!managerMatcher(lead.manager) || !isWithinRange(lead.createdTime, range)) {
      return;
    }
    const key = toDateKey(lead.createdTime!);
    const current = summary.get(key) ?? {
      dateKey: key,
      label: formatDate(fromDateKey(key)),
      deals: 0,
      leads: 0,
    };
    current.leads += 1;
    summary.set(key, current);
  });

  return Array.from(summary.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

export function buildMeetingsByDayChartData(
  meetings: MeetingRow[],
  range: DateRange,
  selectedManager: string,
): DailyMeetingsPoint[] {
  const managerMatcher = (manager: string) =>
    selectedManager === "ALL" || manager === selectedManager;

  const counts = new Map<string, number>();
  meetings.forEach((meeting) => {
    const meetingDate = parseMeetingDate(meeting);
    if (!managerMatcher(meeting.manager) || !isWithinRange(meetingDate, range) || !meetingDate) {
      return;
    }

    const key = toDateKey(meetingDate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, meetingsCount]) => ({
      dateKey,
      label: formatDate(fromDateKey(dateKey)),
      meetings: meetingsCount,
    }));
}

export function buildMeetingsByManagerChartData(managerMetrics: ManagerMetrics[]): MeetingsByManagerPoint[] {
  return managerMetrics.map((row) => ({
    manager: row.manager,
    meetingsCount: row.meetingsCount,
    meetingPlan: row.meetingPlan,
    meetingPlanCompletionPercent: Number(row.meetingPlanCompletionPercent.toFixed(1)),
    completedMeetings: row.completedMeetings,
    notCompletedMeetings: row.notCompletedMeetings,
    unknownStatusMeetings: row.unknownStatusMeetings,
  }));
}

const GROUPS_CONFIG: Array<{ groupName: string; members: string[] }> = [
  {
    groupName: "Р“СЂСѓРїРїР° РљР°РјРёРЅСЃРєР°СЏ Р РµРіРёРЅР°",
    members: ["Швед", "Куприенко", "Кучер", "Первов", "Белик"],
  },
  {
    groupName: "Р“СЂСѓРїРїР° РњР°С€РµРЅРєРѕРІ Р”РµРЅРёСЃ",
    members: ["Отин", "Тарасов", "Тодорова", "Кузнецова", "Романов"],
  },
];

function normalizeNameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, " ")
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function findManagerMetric(managerMetrics: ManagerMetrics[], memberMask: string): ManagerMetrics | null {
  const maskTokens = normalizeNameTokens(memberMask);
  if (!maskTokens.length) {
    return null;
  }

  return (
    managerMetrics.find((item) => {
      const managerTokens = normalizeNameTokens(item.manager);
      return maskTokens.every((maskToken) =>
        managerTokens.some((managerToken) => managerToken.startsWith(maskToken) || maskToken.startsWith(managerToken)),
      );
    }) ?? null
  );
}

function buildGroupManagerStats(
  managerMetrics: ManagerMetrics[],
  members: string[],
): GroupManagerStats[] {
  return members
    .map((memberMask) => {
      const managerMetric = findManagerMetric(managerMetrics, memberMask);
      if (!managerMetric) {
        return null;
      }
      return {
        manager: managerMetric.manager,
        callCount: managerMetric.callCount,
        callPlan: managerMetric.callPlan,
        callPlanCompletion: managerMetric.callPlanCompletion,
        dealConversion: managerMetric.dealConversion,
        leadConversion: managerMetric.leadConversion,
      };
    })
    .filter((item): item is GroupManagerStats => item !== null);
}

export function buildGroupComparison(managerMetrics: ManagerMetrics[]): GroupComparisonRow[] {
  return GROUPS_CONFIG.map(({ groupName, members }) => {
    const managers = buildGroupManagerStats(managerMetrics, members);

    const managerCount = managers.length;
    const totalCalls = managers.reduce((sum, row) => sum + row.callCount, 0);
    const totalPlan = managers.reduce((sum, row) => sum + row.callPlan, 0);
    const groupCallCompletion = totalPlan > 0 ? (totalCalls / totalPlan) * 100 : 0;

    const dealCount = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.dealCount ?? 0);
    }, 0);
    const dealsInProgress = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.dealsInProgress ?? 0);
    }, 0);
    const dealsWon = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.dealsWon ?? 0);
    }, 0);
    const dealsLost = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.dealsLost ?? 0);
    }, 0);
    const dealConversion = dealCount > 0 ? (dealsWon / dealCount) * 100 : 0;

    const leadsSuccess = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.leadsSuccessful ?? 0);
    }, 0);
    const leadsLost = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.leadsLost ?? 0);
    }, 0);
    const totalLeads = managers.reduce((sum, row) => {
      const source = managerMetrics.find((item) => item.manager === row.manager);
      return sum + (source?.leadCount ?? 0);
    }, 0);
    const leadConversion = totalLeads > 0 ? (leadsSuccess / totalLeads) * 100 : 0;

    const efficiencyCoefficient = (groupCallCompletion + dealConversion + leadConversion) / 3;

    return {
      groupName,
      managerCount,
      totalCalls,
      totalPlan,
      dealCount,
      dealsInProgress,
      leadsSuccessful: leadsSuccess,
      callPlanCompletion: groupCallCompletion,
      dealConversion,
      leadConversion,
      efficiencyCoefficient,
      managers,
    };
  });
}
