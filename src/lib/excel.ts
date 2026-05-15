import * as XLSX from "xlsx";
import {
  CallRow,
  CompanyContactRow,
  DealRow,
  LeadRow,
  PlanRow,
  MeetingRow,
  MeetingStatusClassification,
  SheetKey,
  TableValidation,
  WorkbookData,
  WorkbookValidationResult,
} from "../types";
import { parseExcelDate } from "./dates";
import { normalizePhone } from "./phone";

const COL_EMPLOYEE = "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a";
const COL_COMPANY = "\u041a\u043e\u043c\u043f\u0430\u043d\u0438\u044f";
const COL_CONTACT = "\u041a\u043e\u043d\u0442\u0430\u043a\u0442";
const COL_PHONE = "\u041d\u043e\u043c\u0435\u0440 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430";
const COL_MEETING_STATUS = "\u0421\u0442\u0430\u0442\u0443\u0441 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f";
const COL_MEETING_ENTITY = "CRM-\u0441\u0443\u0449\u043d\u043e\u0441\u0442\u044c";

const REQUIRED_COLUMNS: Record<SheetKey, string[]> = {
  Calls: [
    COL_EMPLOYEE,
    "PORTAL_USER_ID",
    "CALL_START_DATE",
    "CALL_DURATION",
    "PHONE_NUMBER",
    "CRM_ENTITY_TYPE",
    "CRM_ENTITY_ID",
  ],
  Deals: [
    COL_EMPLOYEE,
    "assignedById",
    "id",
    "title",
    "stageId",
    "createdTime",
    "opportunity",
  ],
  Leads: [
    COL_EMPLOYEE,
    "assignedById",
    "id",
    "title",
    "stageId",
    "createdTime",
  ],
  CompanyContacts: [COL_COMPANY, COL_CONTACT, COL_PHONE],
  Meetings: [
    COL_EMPLOYEE,
    "RESPONSIBLE_ID",
    "AUTHOR_ID",
    "ID",
    "SUBJECT",
    COL_MEETING_STATUS,
    "DEADLINE",
    "START_TIME",
    "CREATED",
    "COMPLETED",
    "TYPE_ID",
    "PROVIDER_ID",
  ],
};

const SHEET_ALIASES: Record<SheetKey, string[]> = {
  Calls: ["Calls"],
  Deals: ["Deals"],
  Leads: ["Leads"],
  CompanyContacts: ["CompanyContacts", "Contacts"],
  Meetings: ["Meetings", "Meeting", "Activities"],
};

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSheetName(sheetNames: string[], target: SheetKey): string | null {
  const aliases = SHEET_ALIASES[target].map(normalizeSheetName);
  return sheetNames.find((sheetName) => aliases.includes(normalizeSheetName(sheetName))) ?? null;
}

function trimHeader(value: unknown): string {
  return String(value ?? "").trim();
}

function getRawRows(sheet: XLSX.WorkSheet): {
  headers: string[];
  rows: Record<string, unknown>[];
} {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const [rawHeaders = [], ...rawRows] = matrix;
  const headers = rawHeaders.map(trimHeader);
  const rows = rawRows
    .filter((row) => row.some((cell) => cell !== null && cell !== ""))
    .map((row) =>
      headers.reduce<Record<string, unknown>>((accumulator, header, index) => {
        if (header) {
          accumulator[header] = row[index];
        }
        return accumulator;
      }, {}),
    );

  return { headers, rows };
}

function getRawValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return null;
}

function normalizeHeaderText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]/gi, "");
}

function getRawValueByHeaderIncludes(row: Record<string, unknown>, includeParts: string[]): unknown {
  const keys = Object.keys(row);
  const normalizedParts = includeParts.map((part) => normalizeHeaderText(part));

  for (const key of keys) {
    const normalizedKey = normalizeHeaderText(key);
    if (!normalizedKey) {
      continue;
    }
    const isMatch = normalizedParts.every((part) => normalizedKey.includes(part));
    if (isMatch) {
      return row[key];
    }
  }

  return null;
}

function getText(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "").trim();
}

function getTextFromKeys(row: Record<string, unknown>, keys: string[]): string {
  const value = getRawValue(row, keys);
  return String(value ?? "").trim();
}

function getNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(normalized) ? normalized : 0;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const source = String(value ?? "").trim();
  if (!source) {
    return 0;
  }

  const normalized = source
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMeetingDate(row: Record<string, unknown>): { raw: unknown; date: Date | null } {
  const raw = getRawValue(row, ["DEADLINE", "START_TIME", "CREATED"]);
  return {
    raw,
    date: parseExcelDate(raw),
  };
}

function classifyMeetingStatus(row: Record<string, unknown>): MeetingStatusClassification {
  const statusText = getTextFromKeys(row, [COL_MEETING_STATUS]).toUpperCase();
  const completedText = getText(row, "COMPLETED").toUpperCase();

  if (statusText.includes("\u0412\u042b\u041f\u041e\u041b\u041d\u0415\u041d") || completedText === "Y") {
    return "completed";
  }
  if (statusText.includes("\u041d\u0415 \u0412\u042b\u041f\u041e\u041b\u041d\u0415\u041d") || completedText === "N") {
    return "not_completed";
  }
  return "unknown";
}

function parseCalls(rows: Record<string, unknown>[]): CallRow[] {
  return rows.map((row, index) => {
    const warnings: string[] = [];
    const callStartDate = parseExcelDate(row.CALL_START_DATE);
    if (row.CALL_START_DATE != null && !callStartDate) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 CALL_START_DATE");
    }

    return {
      rowId: `call-${index + 1}`,
      rowIndex: index + 1,
      manager: getText(row, COL_EMPLOYEE) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d",
      portalUserId: getText(row, "PORTAL_USER_ID"),
      callStartDateRaw: row.CALL_START_DATE,
      callStartDate,
      callDuration: getNumber(row, "CALL_DURATION"),
      phoneNumber: getText(row, "PHONE_NUMBER"),
      normalizedPhone: normalizePhone(row.PHONE_NUMBER),
      callType: row.CALL_TYPE != null ? getText(row, "CALL_TYPE") : undefined,
      hasCallType: Object.prototype.hasOwnProperty.call(row, "CALL_TYPE"),
      crmEntityType: getText(row, "CRM_ENTITY_TYPE"),
      crmEntityId: getText(row, "CRM_ENTITY_ID"),
      warnings,
      raw: row,
    };
  });
}

function parseDeals(rows: Record<string, unknown>[]): DealRow[] {
  return rows.map((row, index) => {
    const warnings: string[] = [];
    const createdTime = parseExcelDate(row.createdTime);
    const updatedTime = parseExcelDate(row.updatedTime);
    const closeDate = parseExcelDate(row.closedate);

    if (row.createdTime != null && !createdTime) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 createdTime");
    }
    if (row.updatedTime != null && !updatedTime) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 updatedTime");
    }
    if (row.closedate != null && !closeDate) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 closedate");
    }

    return {
      rowId: `deal-${index + 1}`,
      rowIndex: index + 1,
      manager: getText(row, COL_EMPLOYEE) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d",
      assignedById: getText(row, "assignedById"),
      id: getText(row, "id"),
      title: getText(row, "title"),
      stageId: getText(row, "stageId"),
      categoryId: getText(row, "categoryId"),
      createdTimeRaw: row.createdTime,
      createdTime,
      updatedTimeRaw: row.updatedTime,
      updatedTime,
      closeDateRaw: row.closedate,
      closeDate,
      opportunity: getNumber(row, "opportunity"),
      currencyId: getText(row, "currencyId"),
      contactId: getText(row, "contactId"),
      companyId: getText(row, "companyId"),
      warnings,
      raw: row,
    };
  });
}

function parseLeads(rows: Record<string, unknown>[]): LeadRow[] {
  return rows.map((row, index) => {
    const warnings: string[] = [];
    const createdTime = parseExcelDate(row.createdTime);
    const updatedTime = parseExcelDate(row.updatedTime);

    if (row.createdTime != null && !createdTime) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 createdTime");
    }
    if (row.updatedTime != null && !updatedTime) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 updatedTime");
    }

    return {
      rowId: `lead-${index + 1}`,
      rowIndex: index + 1,
      manager: getText(row, COL_EMPLOYEE) || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d",
      assignedById: getText(row, "assignedById"),
      id: getText(row, "id"),
      title: getText(row, "title"),
      stageId: getText(row, "stageId"),
      sourceId: getText(row, "sourceId"),
      createdTimeRaw: row.createdTime,
      createdTime,
      updatedTimeRaw: row.updatedTime,
      updatedTime,
      opportunity: getNumber(row, "opportunity"),
      currencyId: getText(row, "currencyId"),
      contactId: getText(row, "contactId"),
      companyId: getText(row, "companyId"),
      warnings,
      raw: row,
    };
  });
}

function parseCompanyContacts(rows: Record<string, unknown>[]): CompanyContactRow[] {
  return rows.map((row, index) => ({
    rowId: `contact-${index + 1}`,
    rowIndex: index + 1,
    company: getText(row, COL_COMPANY),
    contact: getText(row, COL_CONTACT),
    phoneNumber: getText(row, COL_PHONE),
    normalizedPhone: normalizePhone(row[COL_PHONE]),
    warnings: [],
    raw: row,
  }));
}

function parseMeetings(rows: Record<string, unknown>[]): MeetingRow[] {
  return rows.map((row, index) => {
    const warnings: string[] = [];
    const meetingDate = parseMeetingDate(row);
    if (meetingDate.raw != null && !meetingDate.date) {
      warnings.push("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0441\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0434\u0430\u0442\u0443 \u0432\u0441\u0442\u0440\u0435\u0447\u0438 (DEADLINE/START_TIME/CREATED)");
    }

    const employee = getText(row, COL_EMPLOYEE);
    const responsibleId = getText(row, "RESPONSIBLE_ID");
    const authorId = getText(row, "AUTHOR_ID");
    const manager = employee || responsibleId || authorId || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d";

    return {
      rowId: `meeting-${index + 1}`,
      rowIndex: index + 1,
      manager,
      meetingDateRaw: meetingDate.raw,
      meetingDate: meetingDate.date,
      meetingStatus: classifyMeetingStatus(row),
      [COL_EMPLOYEE]: employee || undefined,
      RESPONSIBLE_ID: row.RESPONSIBLE_ID as string | number | undefined,
      AUTHOR_ID: row.AUTHOR_ID as string | number | undefined,
      ID: row.ID as string | number | undefined,
      SUBJECT: getText(row, "SUBJECT") || undefined,
      [COL_MEETING_STATUS]: getText(row, COL_MEETING_STATUS) || undefined,
      [COL_MEETING_ENTITY]: getText(row, COL_MEETING_ENTITY) || undefined,
      OWNER_TYPE_ID: row.OWNER_TYPE_ID as string | number | undefined,
      OWNER_ID: row.OWNER_ID as string | number | undefined,
      DEADLINE: row.DEADLINE as string | number | Date | undefined,
      START_TIME: row.START_TIME as string | number | Date | undefined,
      END_TIME: row.END_TIME as string | number | Date | undefined,
      CREATED: row.CREATED as string | number | Date | undefined,
      LAST_UPDATED: row.LAST_UPDATED as string | number | Date | undefined,
      COMPLETED: getText(row, "COMPLETED") || undefined,
      STATUS: row.STATUS as string | number | undefined,
      TYPE_ID: row.TYPE_ID as string | number | undefined,
      PROVIDER_ID: getText(row, "PROVIDER_ID") || undefined,
      PROVIDER_TYPE_ID: getText(row, "PROVIDER_TYPE_ID") || undefined,
      warnings,
      raw: row,
    };
  });
}

function parsePlan(rows: Record<string, unknown>[]): PlanRow[] {
  return rows.map((row, index) => {
    const manager = String(
      getRawValueByHeaderIncludes(row, ["менеджер"]) ??
      getRawValueByHeaderIncludes(row, ["фио", "ответствен"]) ??
      getRawValueByHeaderIncludes(row, ["сотрудник"]) ??
      "",
    ).trim();

    const group = String(
      getRawValueByHeaderIncludes(row, ["руководитель", "групп"]) ??
      getRawValueByHeaderIncludes(row, ["группа"]) ??
      getRawValueByHeaderIncludes(row, ["руководитель"]) ??
      "",
    ).trim();

    const planAmount = parseAmount(
      getRawValueByHeaderIncludes(row, ["план", "руб"]) ??
      getRawValueByHeaderIncludes(row, ["план"]),
    );
    const factAmount = parseAmount(
      getRawValueByHeaderIncludes(row, ["факт", "руб"]) ??
      getRawValueByHeaderIncludes(row, ["факт"]),
    );

    return {
      rowId: `plan-${index + 1}`,
      rowIndex: index + 1,
      manager: manager || "Не указан",
      group: group || undefined,
      planAmount,
      factAmount,
      warnings: [],
      raw: row,
    };
  });
}

function normalizeManagerTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, " ")
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildManagerKey(value: string): string {
  const tokens = normalizeManagerTokens(value);
  if (!tokens.length) {
    return "";
  }

  const noPatronymic = tokens.filter((token) => !token.endsWith("вич") && !token.endsWith("вна"));
  const source = noPatronymic.length >= 2 ? noPatronymic.slice(0, 2) : tokens.slice(0, 2);
  if (!source.length) {
    return "";
  }
  if (source.length === 1) {
    return source[0];
  }
  return [...source].sort((a, b) => a.localeCompare(b, "ru")).join(" ");
}

function buildCanonicalManagerMap(names: string[]): Map<string, string> {
  const byKey = new Map<string, string[]>();

  names.forEach((name) => {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) {
      return;
    }
    const key = buildManagerKey(trimmed);
    if (!key) {
      return;
    }
    const bucket = byKey.get(key) ?? [];
    bucket.push(trimmed);
    byKey.set(key, bucket);
  });

  const map = new Map<string, string>();
  byKey.forEach((bucket) => {
    const canonical = [...bucket].sort((a, b) => a.length - b.length || a.localeCompare(b, "ru"))[0];
    bucket.forEach((name) => map.set(name, canonical));
  });

  return map;
}

function emptyValidationTable(sheet: SheetKey): TableValidation {
  return {
    requiredColumns: REQUIRED_COLUMNS[sheet],
    foundColumns: [],
    missingColumns: [...REQUIRED_COLUMNS[sheet]],
    rowCount: 0,
  };
}

export function validateWorkbookTables(workbook: XLSX.WorkBook): WorkbookValidationResult {
  const foundTables: SheetKey[] = [];
  const missingTables: SheetKey[] = [];
  const warnings: string[] = [];

  const tableDetails: Record<SheetKey, TableValidation> = {
    Calls: emptyValidationTable("Calls"),
    Deals: emptyValidationTable("Deals"),
    Leads: emptyValidationTable("Leads"),
    CompanyContacts: emptyValidationTable("CompanyContacts"),
    Meetings: emptyValidationTable("Meetings"),
  };

  (Object.keys(REQUIRED_COLUMNS) as SheetKey[]).forEach((sheetKey) => {
    const actualSheetName = resolveSheetName(workbook.SheetNames, sheetKey);

    if (!actualSheetName) {
      missingTables.push(sheetKey);
      if (sheetKey === "Meetings") {
        warnings.push("\u0422\u0430\u0431\u043b\u0438\u0446\u0430 Meetings \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430. \u041c\u0435\u0442\u0440\u0438\u043a\u0438 \u043f\u043e \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u043c \u043d\u0435 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043d\u044b.");
      } else {
        warnings.push(`\u041d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430 \u0442\u0430\u0431\u043b\u0438\u0446\u0430 ${sheetKey}.`);
      }
      return;
    }

    foundTables.push(sheetKey);
    const sheet = workbook.Sheets[actualSheetName];
    const { headers, rows } = getRawRows(sheet);
    const foundColumns = REQUIRED_COLUMNS[sheetKey].filter((column) => headers.includes(column));
    const missingColumns = REQUIRED_COLUMNS[sheetKey].filter((column) => !headers.includes(column));

    tableDetails[sheetKey] = {
      requiredColumns: REQUIRED_COLUMNS[sheetKey],
      foundColumns,
      missingColumns,
      rowCount: rows.length,
    };

    if (missingColumns.length) {
      warnings.push(
        `\u0412 \u0442\u0430\u0431\u043b\u0438\u0446\u0435 ${sheetKey} \u043e\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044e\u0442 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043a\u043e\u043b\u043e\u043d\u043a\u0438: ${missingColumns.join(", ")}.`,
      );
    }
  });

  return {
    foundTables,
    missingTables,
    tableDetails,
    warnings,
  };
}

export async function parseWorkbook(file: File): Promise<WorkbookData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const validation = validateWorkbookTables(workbook);
  const sheetNames = workbook.SheetNames;

  const callsSheetName = resolveSheetName(sheetNames, "Calls");
  const dealsSheetName = resolveSheetName(sheetNames, "Deals");
  const leadsSheetName = resolveSheetName(sheetNames, "Leads");
  const companyContactsSheetName = resolveSheetName(sheetNames, "CompanyContacts");
  const meetingsSheetName = resolveSheetName(sheetNames, "Meetings");
  const planSheetName =
    sheetNames.find((name) => {
      const normalized = normalizeSheetName(name);
      return normalized === "plan" || normalized === "план";
    }) ?? null;

  const calls = callsSheetName ? parseCalls(getRawRows(workbook.Sheets[callsSheetName]).rows) : [];
  const deals = dealsSheetName ? parseDeals(getRawRows(workbook.Sheets[dealsSheetName]).rows) : [];
  const leads = leadsSheetName ? parseLeads(getRawRows(workbook.Sheets[leadsSheetName]).rows) : [];
  const meetings = meetingsSheetName ? parseMeetings(getRawRows(workbook.Sheets[meetingsSheetName]).rows) : [];
  const companyContacts = companyContactsSheetName
    ? parseCompanyContacts(getRawRows(workbook.Sheets[companyContactsSheetName]).rows)
    : [];
  const planRows = planSheetName ? parsePlan(getRawRows(workbook.Sheets[planSheetName]).rows) : [];

  const managerMap = buildCanonicalManagerMap([
    ...calls.map((row) => row.manager),
    ...deals.map((row) => row.manager),
    ...leads.map((row) => row.manager),
    ...meetings.map((row) => row.manager),
    ...planRows.map((row) => row.manager),
  ]);

  const canonicalizeManager = (name: string): string => managerMap.get(name) ?? name;
  const normalizedCalls = calls.map((row) => ({ ...row, manager: canonicalizeManager(row.manager) }));
  const normalizedDeals = deals.map((row) => ({ ...row, manager: canonicalizeManager(row.manager) }));
  const normalizedLeads = leads.map((row) => ({ ...row, manager: canonicalizeManager(row.manager) }));
  const normalizedMeetings = meetings.map((row) => ({ ...row, manager: canonicalizeManager(row.manager) }));
  const normalizedPlanRows = planRows.map((row) => ({ ...row, manager: canonicalizeManager(row.manager) }));

  const warnings = [
    ...validation.warnings,
    ...calls.flatMap((row) => row.warnings.map((warning) => `Calls, \u0441\u0442\u0440\u043e\u043a\u0430 ${row.rowIndex}: ${warning}`)),
    ...deals.flatMap((row) => row.warnings.map((warning) => `Deals, \u0441\u0442\u0440\u043e\u043a\u0430 ${row.rowIndex}: ${warning}`)),
    ...leads.flatMap((row) => row.warnings.map((warning) => `Leads, \u0441\u0442\u0440\u043e\u043a\u0430 ${row.rowIndex}: ${warning}`)),
    ...meetings.flatMap((row) =>
      row.warnings.map((warning) => `Meetings, \u0441\u0442\u0440\u043e\u043a\u0430 ${row.rowIndex}: ${warning}`),
    ),
  ];

  return {
    calls: normalizedCalls,
    deals: normalizedDeals,
    leads: normalizedLeads,
    meetings: normalizedMeetings,
    companyContacts,
    planRows: normalizedPlanRows,
    validation,
    warnings,
    fileName: file.name,
  };
}
