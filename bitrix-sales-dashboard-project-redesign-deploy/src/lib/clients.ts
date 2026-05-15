import {
  CallRow,
  ClientCoverageRow,
  ClientCallStatusClean,
  CompanyContactRow,
  ForgottenClientRow,
  ForgottenThreshold,
  ManagerBaseContributionRow,
} from "../types";
import { endOfDay, getDaysDifference } from "./dates";
import { isQualifiedCall } from "./metrics";

function isCallVisible(call: CallRow, selectedManager: string, referenceDate: Date | null): boolean {
  if (selectedManager !== "ALL" && call.manager !== selectedManager) {
    return false;
  }

  if (!isQualifiedCall(call) || !call.callStartDate) {
    return false;
  }

  if (referenceDate && call.callStartDate.getTime() > endOfDay(referenceDate).getTime()) {
    return false;
  }

  return true;
}

export function buildClientCoverage(params: {
  companyContacts: CompanyContactRow[];
  calls: CallRow[];
  selectedManager: string;
  referenceDate: Date | null;
}): ClientCoverageRow[] {
  const { companyContacts, calls, selectedManager, referenceDate } = params;

  const callsByPhone = new Map<string, CallRow[]>();

  calls.forEach((call) => {
    if (!call.normalizedPhone || !isCallVisible(call, selectedManager, referenceDate)) {
      return;
    }

    const list = callsByPhone.get(call.normalizedPhone) ?? [];
    list.push(call);
    callsByPhone.set(call.normalizedPhone, list);
  });

  return companyContacts.map((row) => {
    const matchedCalls = row.normalizedPhone ? (callsByPhone.get(row.normalizedPhone) ?? []) : [];
    const sortedCalls = [...matchedCalls].sort((a, b) => {
      const aTime = a.callStartDate?.getTime() ?? 0;
      const bTime = b.callStartDate?.getTime() ?? 0;
      return bTime - aTime;
    });

    return {
      company: row.company,
      contact: row.contact,
      phoneNumber: row.phoneNumber,
      normalizedPhone: row.normalizedPhone,
      hasCall: sortedCalls.length > 0,
      lastCallDate: sortedCalls[0]?.callStartDate ?? null,
      callCount: sortedCalls.length,
      lastManager: sortedCalls[0]?.manager ?? "",
      managers: Array.from(new Set(sortedCalls.map((call) => call.manager).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    };
  });
}

function buildStatus(
  row: ClientCoverageRow,
  threshold: ForgottenThreshold,
  referenceDate: Date,
): { status: ClientCallStatusClean; daysWithoutCall: number | null } {
  if (!row.lastCallDate) {
    return {
      status: "Не звонили",
      daysWithoutCall: null,
    };
  }

  const daysWithoutCall = getDaysDifference(row.lastCallDate, referenceDate);
  if (threshold === "never") {
    return {
      status: "В работе",
      daysWithoutCall,
    };
  }

  if (daysWithoutCall >= threshold) {
    return {
      status: "Забытый клиент",
      daysWithoutCall,
    };
  }

  return {
    status: "В работе",
    daysWithoutCall,
  };
}

export function buildForgottenClients(params: {
  coverageRows: ClientCoverageRow[];
  threshold: ForgottenThreshold;
  referenceDate: Date;
}): ForgottenClientRow[] {
  const { coverageRows, threshold, referenceDate } = params;

  return coverageRows.map((row) => {
    const { status, daysWithoutCall } = buildStatus(row, threshold, referenceDate);
    return {
      ...row,
      status,
      daysWithoutCall,
    };
  });
}

export function buildManagerBaseContribution(params: {
  companyContacts: CompanyContactRow[];
  calls: CallRow[];
  selectedManager: string;
  referenceDate: Date;
}): ManagerBaseContributionRow[] {
  const { companyContacts, calls, selectedManager, referenceDate } = params;
  const basePhones = Array.from(new Set(companyContacts.map((row) => row.normalizedPhone).filter(Boolean)));
  const basePhoneSet = new Set(basePhones);

  const visibleCalls = calls.filter(
    (call) => basePhoneSet.has(call.normalizedPhone) && isCallVisible(call, selectedManager, referenceDate),
  );

  const phonesByManager = new Map<string, Set<string>>();
  const latestByPhone = new Map<string, CallRow>();

  visibleCalls.forEach((call) => {
    const managerSet = phonesByManager.get(call.manager) ?? new Set<string>();
    managerSet.add(call.normalizedPhone);
    phonesByManager.set(call.manager, managerSet);

    const currentLatest = latestByPhone.get(call.normalizedPhone);
    if (!currentLatest || (call.callStartDate?.getTime() ?? 0) > (currentLatest.callStartDate?.getTime() ?? 0)) {
      latestByPhone.set(call.normalizedPhone, call);
    }
  });

  const reachedPhones = latestByPhone.size;
  const lastTouchByManager = new Map<string, { count: number; days: number[] }>();

  latestByPhone.forEach((call) => {
    const current = lastTouchByManager.get(call.manager) ?? { count: 0, days: [] };
    current.count += 1;
    if (call.callStartDate) {
      current.days.push(getDaysDifference(call.callStartDate, referenceDate));
    }
    lastTouchByManager.set(call.manager, current);
  });

  const allManagers = Array.from(
    new Set(
      visibleCalls
        .map((call) => call.manager)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));

  return allManagers
    .map((manager) => {
      const uniquePhonesCalled = phonesByManager.get(manager)?.size ?? 0;
      const lastTouch = lastTouchByManager.get(manager) ?? { count: 0, days: [] };
      const averageDaysSinceLastTouch =
        lastTouch.days.length > 0
          ? lastTouch.days.reduce((sum, day) => sum + day, 0) / lastTouch.days.length
          : 0;

      return {
        manager,
        uniquePhonesCalled,
        shareOfTotalBase: basePhones.length > 0 ? (uniquePhonesCalled / basePhones.length) * 100 : 0,
        shareOfReachedBase: reachedPhones > 0 ? (uniquePhonesCalled / reachedPhones) * 100 : 0,
        lastTouchPhones: lastTouch.count,
        averageDaysSinceLastTouch,
      };
    })
    .sort((a, b) => {
      if (a.lastTouchPhones !== b.lastTouchPhones) {
        return b.lastTouchPhones - a.lastTouchPhones;
      }
      return b.uniquePhonesCalled - a.uniquePhonesCalled;
    });
}
