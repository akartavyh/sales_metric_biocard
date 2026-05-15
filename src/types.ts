export type StageClassification = "won" | "lost" | "active";
export type LeadClassification = "success" | "lost" | "active";
export type MeetingStatusClassification = "completed" | "not_completed" | "unknown";
export type ForgottenThreshold = "never" | 7 | 14 | 30 | 60 | 90;
export type ClientCallStatus = "РќРµ Р·РІРѕРЅРёР»Рё" | "Р—Р°Р±С‹С‚С‹Р№ РєР»РёРµРЅС‚" | "Р’ СЂР°Р±РѕС‚Рµ";
export type SheetKey = "Calls" | "Deals" | "Leads" | "CompanyContacts" | "Meetings";
export type ClientCallStatusClean = "Не звонили" | "Забытый клиент" | "В работе";

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface CallRow {
  rowId: string;
  rowIndex: number;
  manager: string;
  portalUserId: string;
  callStartDateRaw: unknown;
  callStartDate: Date | null;
  callDuration: number;
  phoneNumber: string;
  normalizedPhone: string;
  callType?: string;
  hasCallType: boolean;
  crmEntityType?: string;
  crmEntityId?: string;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface DealRow {
  rowId: string;
  rowIndex: number;
  manager: string;
  assignedById: string;
  id: string;
  title: string;
  stageId: string;
  categoryId: string;
  createdTimeRaw: unknown;
  createdTime: Date | null;
  updatedTimeRaw: unknown;
  updatedTime: Date | null;
  closeDateRaw: unknown;
  closeDate: Date | null;
  opportunity: number;
  currencyId: string;
  contactId: string;
  companyId: string;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface LeadRow {
  rowId: string;
  rowIndex: number;
  manager: string;
  assignedById: string;
  id: string;
  title: string;
  stageId: string;
  sourceId: string;
  createdTimeRaw: unknown;
  createdTime: Date | null;
  updatedTimeRaw: unknown;
  updatedTime: Date | null;
  opportunity: number;
  currencyId: string;
  contactId: string;
  companyId: string;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface CompanyContactRow {
  rowId: string;
  rowIndex: number;
  company: string;
  contact: string;
  phoneNumber: string;
  normalizedPhone: string;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface PlanRow {
  rowId: string;
  rowIndex: number;
  manager: string;
  group?: string;
  planAmount: number;
  factAmount: number;
  warnings: string[];
  raw: Record<string, unknown>;
}

export type MeetingRow = {
  "\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a"?: string;
  RESPONSIBLE_ID?: string | number;
  AUTHOR_ID?: string | number;
  ID?: string | number;
  SUBJECT?: string;
  "\u0421\u0442\u0430\u0442\u0443\u0441 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f"?: string;
  "CRM-\u0441\u0443\u0449\u043d\u043e\u0441\u0442\u044c"?: string;
  OWNER_TYPE_ID?: string | number;
  OWNER_ID?: string | number;
  DEADLINE?: string | number | Date;
  START_TIME?: string | number | Date;
  END_TIME?: string | number | Date;
  CREATED?: string | number | Date;
  LAST_UPDATED?: string | number | Date;
  COMPLETED?: string;
  STATUS?: string | number;
  TYPE_ID?: string | number;
  PROVIDER_ID?: string;
  PROVIDER_TYPE_ID?: string;
} & {
  rowId: string;
  rowIndex: number;
  manager: string;
  meetingDateRaw: unknown;
  meetingDate: Date | null;
  meetingStatus: MeetingStatusClassification;
  warnings: string[];
  raw: Record<string, unknown>;
};

export interface ManagerMetrics {
  manager: string;
  callCount: number;
  callPlan: number;
  callPlanCompletion: number;
  meetingsCount: number;
  meetingPlan: number;
  meetingPlanCompletionPercent: number;
  completedMeetings: number;
  notCompletedMeetings: number;
  unknownStatusMeetings: number;
  dealCount: number;
  dealsWon: number;
  dealsLost: number;
  dealsInProgress: number;
  dealConversion: number;
  leadCount: number;
  leadsSuccessful: number;
  leadsLost: number;
  leadsInProgress: number;
  leadConversion: number;
}

export interface GroupManagerStats {
  manager: string;
  callCount: number;
  callPlan: number;
  callPlanCompletion: number;
  dealConversion: number;
  leadConversion: number;
}

export interface GroupComparisonRow {
  groupName: string;
  managerCount: number;
  totalCalls: number;
  totalPlan: number;
  dealCount: number;
  dealsInProgress: number;
  leadsSuccessful: number;
  callPlanCompletion: number;
  dealConversion: number;
  leadConversion: number;
  efficiencyCoefficient: number;
  managers: GroupManagerStats[];
}

export interface ClientCoverageRow {
  company: string;
  contact: string;
  phoneNumber: string;
  normalizedPhone: string;
  hasCall: boolean;
  lastCallDate: Date | null;
  callCount: number;
  lastManager: string;
  managers: string[];
}

export interface ForgottenClientRow extends ClientCoverageRow {
  status: ClientCallStatusClean;
  daysWithoutCall: number | null;
}

export interface ManagerBaseContributionRow {
  manager: string;
  uniquePhonesCalled: number;
  shareOfTotalBase: number;
  shareOfReachedBase: number;
  lastTouchPhones: number;
  averageDaysSinceLastTouch: number;
}

export interface TableValidation {
  requiredColumns: string[];
  foundColumns: string[];
  missingColumns: string[];
  rowCount: number;
}

export interface WorkbookValidationResult {
  foundTables: SheetKey[];
  missingTables: SheetKey[];
  tableDetails: Record<SheetKey, TableValidation>;
  warnings: string[];
}

export interface WorkbookData {
  calls: CallRow[];
  deals: DealRow[];
  leads: LeadRow[];
  meetings: MeetingRow[];
  companyContacts: CompanyContactRow[];
  planRows: PlanRow[];
  validation: WorkbookValidationResult;
  warnings: string[];
  fileName: string;
}

export interface DailyCallsPoint {
  dateKey: string;
  label: string;
  calls: number;
}

export interface DailyCreatedPoint {
  dateKey: string;
  label: string;
  deals: number;
  leads: number;
}

export interface DailyMeetingsPoint {
  dateKey: string;
  label: string;
  meetings: number;
}

export interface MeetingsByManagerPoint {
  manager: string;
  meetingsCount: number;
  meetingPlan: number;
  meetingPlanCompletionPercent: number;
  completedMeetings: number;
  notCompletedMeetings: number;
  unknownStatusMeetings: number;
}
