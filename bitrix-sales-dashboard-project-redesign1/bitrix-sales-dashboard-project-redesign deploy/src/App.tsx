import { useEffect, useMemo, useState } from "react";
import { ClientsTab } from "./components/ClientsTab";
import { MetricsTab } from "./components/MetricsTab";
import { TopFilters } from "./components/TopFilters";
import {
  formatMoscowDateTime,
  formatDate,
  getCurrentMonthValue,
  getRussianWorkingDaysCount,
  getPlanRangeToCurrentDate,
  monthToDateRange,
  startOfDay,
} from "./lib/dates";
import { parseWorkbook } from "./lib/excel";
import {
  buildManagerMetrics,
  calculateCallPlan,
  isQualifiedCall,
} from "./lib/metrics";
import { buildClientCoverage, buildForgottenClients, buildManagerBaseContribution } from "./lib/clients";
import { ClientCallStatusClean, DateRange, ForgottenThreshold, WorkbookData } from "./types";

type PlanGroupSummary = {
  groupName: string;
  totalPlan: number;
  totalFact: number;
  completionPercent: number;
};

type PlanPerformanceSummary = {
  totalPlan: number;
  totalFact: number;
  completionPercent: number;
  groups: PlanGroupSummary[];
};

type LeaderGroupFilter = "ALL" | "KAMINSKAYA" | "MASHENKOV";

const LEADER_GROUP_MEMBERS: Record<Exclude<LeaderGroupFilter, "ALL">, string[]> = {
  KAMINSKAYA: ["Швед", "Куприенко", "Кучер", "Первов", "Белик", "Служаева", "Служ"],
  MASHENKOV: ["Отин", "Тарасов", "Тодорова", "Кузнецова", "Романов"],
};

function collectManagers(data: WorkbookData | null): string[] {
  if (!data) {
    return [];
  }
  return Array.from(
    new Set(
      [
        ...data.calls.map((row) => row.manager),
        ...data.deals.map((row) => row.manager),
        ...data.leads.map((row) => row.manager),
        ...data.meetings.map((row) => row.manager),
        ...data.planRows.map((row) => row.manager),
      ]
        .map((manager) => manager.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));
}

function normalizeNameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, " ")
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isManagerInLeaderGroup(manager: string, group: Exclude<LeaderGroupFilter, "ALL">): boolean {
  const managerTokens = normalizeNameTokens(manager);
  const masks = LEADER_GROUP_MEMBERS[group];
  return masks.some((mask) => {
    const maskTokens = normalizeNameTokens(mask);
    return maskTokens.every((maskToken) =>
      managerTokens.some((token) => token.startsWith(maskToken) || maskToken.startsWith(token)),
    );
  });
}

function resolveLeaderGroupName(manager: string): string {
  if (isManagerInLeaderGroup(manager, "KAMINSKAYA")) {
    return "Каминская Регина";
  }
  if (isManagerInLeaderGroup(manager, "MASHENKOV")) {
    return "Машенков Денис";
  }
  return "Без группы";
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>Загрузите Excel-файл из Bitrix24</h2>
      <p>После загрузки будут доступны метрики и клиентская аналитика за выбранный месяц.</p>
    </section>
  );
}

export default function App() {
  const [workbookData, setWorkbookData] = useState<WorkbookData | null>(null);
  const [activeTab, setActiveTab] = useState<"metrics" | "clients">("metrics");
  const [selectedLeaderGroup, setSelectedLeaderGroup] = useState<LeaderGroupFilter>("ALL");
  const [selectedManager, setSelectedManager] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [errorMessage, setErrorMessage] = useState("");
  const [now, setNow] = useState(new Date());

  const [clientStatus, setClientStatus] = useState<"ALL" | ClientCallStatusClean>("ALL");
  const [clientThreshold, setClientThreshold] = useState<ForgottenThreshold>(30);
  const [clientSearchCompany, setClientSearchCompany] = useState("");
  const [clientSearchContact, setClientSearchContact] = useState("");
  const [clientSearchPhone, setClientSearchPhone] = useState("");

  const allManagerOptions = useMemo(() => collectManagers(workbookData), [workbookData]);
  const managerOptions = useMemo(() => {
    if (selectedLeaderGroup === "ALL") {
      return allManagerOptions;
    }
    return allManagerOptions.filter((manager) =>
      isManagerInLeaderGroup(manager, selectedLeaderGroup),
    );
  }, [allManagerOptions, selectedLeaderGroup]);
  const allowedManagersSet = useMemo(() => new Set(managerOptions), [managerOptions]);
  const currentRange = useMemo(
    () => monthToDateRange(selectedMonth),
    [selectedMonth],
  );
  const planRange = useMemo(
    () => getPlanRangeToCurrentDate(selectedMonth, now),
    [now, selectedMonth],
  );
  const reportRange = useMemo<DateRange>(() => {
    if (!currentRange.start || !currentRange.end || !planRange.end) {
      return currentRange;
    }
    const rangeEnd =
      currentRange.end.getTime() < planRange.end.getTime()
        ? currentRange.end
        : planRange.end;
    return {
      start: currentRange.start,
      end: rangeEnd,
    };
  }, [currentRange, planRange.end]);
  const previousPlanRange = useMemo<DateRange>(() => {
    if (!planRange.start || !planRange.end) {
      return planRange;
    }
    const prevEnd = startOfDay(planRange.end);
    prevEnd.setDate(prevEnd.getDate() - 1);
    if (prevEnd.getTime() < startOfDay(planRange.start).getTime()) {
      return {
        start: planRange.start,
        end: new Date(startOfDay(planRange.start).getTime() - 86400000),
      };
    }
    return {
      start: planRange.start,
      end: prevEnd,
    };
  }, [planRange]);
  const previousReportRange = useMemo<DateRange>(() => {
    if (!reportRange.start || !reportRange.end) {
      return reportRange;
    }
    const prevEnd = startOfDay(reportRange.end);
    prevEnd.setDate(prevEnd.getDate() - 1);
    if (prevEnd.getTime() < startOfDay(reportRange.start).getTime()) {
      return {
        start: reportRange.start,
        end: new Date(startOfDay(reportRange.start).getTime() - 86400000),
      };
    }
    return {
      start: reportRange.start,
      end: prevEnd,
    };
  }, [reportRange]);
  const workingDaysToCurrentDate = useMemo(
    () => getRussianWorkingDaysCount(planRange.start, planRange.end),
    [planRange.end, planRange.start],
  );
  const referenceDate = useMemo(() => {
    if (!currentRange.end) {
      return now;
    }
    return currentRange.end.getTime() > now.getTime() ? now : currentRange.end;
  }, [currentRange.end, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedManager !== "ALL" && !allowedManagersSet.has(selectedManager)) {
      setSelectedManager("ALL");
    }
  }, [allowedManagersSet, selectedManager]);

  const handleFileSelect = async (file: File) => {
    try {
      setErrorMessage("");
      const parsed = await parseWorkbook(file);
      setWorkbookData(parsed);
      setSelectedLeaderGroup("ALL");
      setSelectedManager("ALL");
      setSelectedMonth(getCurrentMonthValue());
      setClientStatus("ALL");
      setClientThreshold(30);
      setClientSearchCompany("");
      setClientSearchContact("");
      setClientSearchPhone("");
    } catch (error) {
      setWorkbookData(null);
      setErrorMessage(
        error instanceof Error
          ? `Не удалось обработать файл: ${error.message}`
          : "Не удалось обработать файл.",
      );
    }
  };

  const resetFilters = () => {
    setSelectedLeaderGroup("ALL");
    setSelectedManager("ALL");
    setSelectedMonth(getCurrentMonthValue());
    setClientStatus("ALL");
    setClientThreshold(30);
    setClientSearchCompany("");
    setClientSearchContact("");
    setClientSearchPhone("");
  };

  const managerMetrics = useMemo(
    () =>
      workbookData
        ? buildManagerMetrics({
            calls: workbookData.calls.filter((row) => allowedManagersSet.has(row.manager)),
            deals: workbookData.deals.filter((row) => allowedManagersSet.has(row.manager)),
            leads: workbookData.leads.filter((row) => allowedManagersSet.has(row.manager)),
            meetings: workbookData.meetings.filter((row) => allowedManagersSet.has(row.manager)),
            range: reportRange,
            planRange,
            selectedManager,
          })
        : [],
    [allowedManagersSet, planRange, reportRange, selectedManager, workbookData],
  );
  const previousManagerMetrics = useMemo(
    () =>
      workbookData
        ? buildManagerMetrics({
            calls: workbookData.calls.filter((row) => allowedManagersSet.has(row.manager)),
            deals: workbookData.deals.filter((row) => allowedManagersSet.has(row.manager)),
            leads: workbookData.leads.filter((row) => allowedManagersSet.has(row.manager)),
            meetings: workbookData.meetings.filter((row) => allowedManagersSet.has(row.manager)),
            range: previousReportRange,
            planRange: previousPlanRange,
            selectedManager,
          })
        : [],
    [allowedManagersSet, previousPlanRange, previousReportRange, selectedManager, workbookData],
  );

  const metricsKpis = useMemo(() => {
    const totalCalls = managerMetrics.reduce((sum, row) => sum + row.callCount, 0);
    const totalMeetings = managerMetrics.reduce((sum, row) => sum + row.meetingsCount, 0);
    const managersCount =
      selectedManager === "ALL"
        ? managerMetrics.length
        : managerOptions.includes(selectedManager)
          ? 1
          : 0;
    const callPlan = calculateCallPlan(planRange.start, planRange.end, managersCount);
    const meetingPlan = managerMetrics.reduce((sum, row) => sum + row.meetingPlan, 0);
    return {
      totalCalls,
      totalMeetings,
      callPlan,
      meetingPlan,
      planCompletion: callPlan > 0 ? (totalCalls / callPlan) * 100 : 0,
      meetingPlanCompletion: meetingPlan > 0 ? (totalMeetings / meetingPlan) * 100 : 0,
      averageCallsPerManager: managersCount > 0 ? totalCalls / managersCount : 0,
      averageMeetingsPerManager: managersCount > 0 ? totalMeetings / managersCount : 0,
      managersCount,
    };
  }, [managerMetrics, managerOptions, planRange.end, planRange.start, selectedManager]);
  const metricsDeltas = useMemo(() => {
    const currentDeals = managerMetrics.reduce((sum, row) => sum + row.dealCount, 0);
    const currentDealsWon = managerMetrics.reduce((sum, row) => sum + row.dealsWon, 0);
    const currentLeads = managerMetrics.reduce((sum, row) => sum + row.leadCount, 0);
    const currentLeadsWon = managerMetrics.reduce((sum, row) => sum + row.leadsSuccessful, 0);
    const previousCallPlan = previousManagerMetrics.reduce((sum, row) => sum + row.callPlan, 0);
    const previousMeetingPlan = previousManagerMetrics.reduce((sum, row) => sum + row.meetingPlan, 0);

    const previousCalls = previousManagerMetrics.reduce((sum, row) => sum + row.callCount, 0);
    const previousMeetings = previousManagerMetrics.reduce((sum, row) => sum + row.meetingsCount, 0);
    const previousDeals = previousManagerMetrics.reduce((sum, row) => sum + row.dealCount, 0);
    const previousDealsWon = previousManagerMetrics.reduce((sum, row) => sum + row.dealsWon, 0);
    const previousLeads = previousManagerMetrics.reduce((sum, row) => sum + row.leadCount, 0);
    const previousLeadsWon = previousManagerMetrics.reduce((sum, row) => sum + row.leadsSuccessful, 0);

    const currentDealConversion = currentDeals > 0 ? (currentDealsWon / currentDeals) * 100 : 0;
    const previousDealConversion = previousDeals > 0 ? (previousDealsWon / previousDeals) * 100 : 0;
    const currentLeadConversion = currentLeads > 0 ? (currentLeadsWon / currentLeads) * 100 : 0;
    const previousLeadConversion = previousLeads > 0 ? (previousLeadsWon / previousLeads) * 100 : 0;

    return {
      calls: metricsKpis.totalCalls - previousCalls,
      meetings: metricsKpis.totalMeetings - previousMeetings,
      deals: currentDeals - previousDeals,
      leads: currentLeads - previousLeads,
      planCompletion: metricsKpis.planCompletion - (previousCallPlan > 0 ? (previousCalls / previousCallPlan) * 100 : 0),
      meetingPlanCompletion:
        metricsKpis.meetingPlanCompletion -
        (previousMeetingPlan > 0 ? (previousMeetings / previousMeetingPlan) * 100 : 0),
      dealConversion: currentDealConversion - previousDealConversion,
      leadConversion: currentLeadConversion - previousLeadConversion,
    };
  }, [managerMetrics, metricsKpis, previousManagerMetrics]);

  const coverageRows = useMemo(() => {
    if (!workbookData) {
      return [];
    }
    const coverage = buildClientCoverage({
      companyContacts: workbookData.companyContacts,
      calls: workbookData.calls.filter((row) => allowedManagersSet.has(row.manager)),
      selectedManager,
      referenceDate,
    });
    return buildForgottenClients({
      coverageRows: coverage,
      threshold: clientThreshold,
      referenceDate,
    });
  }, [allowedManagersSet, clientThreshold, referenceDate, selectedManager, workbookData]);

  const contributionRows = useMemo(
    () =>
      workbookData
        ? buildManagerBaseContribution({
            companyContacts: workbookData.companyContacts,
            calls: workbookData.calls.filter((row) => allowedManagersSet.has(row.manager)),
            selectedManager,
            referenceDate,
          })
        : [],
    [allowedManagersSet, referenceDate, selectedManager, workbookData],
  );

  const clientKpis = useMemo(() => {
    if (!workbookData) {
      return {
        companies: 0,
        contacts: 0,
        phones: 0,
        uniquePhones: 0,
        calledUniquePhones: 0,
        uncalledUniquePhones: 0,
        coveragePercent: 0,
        forgottenClientsCount: 0,
      };
    }
    const companies = new Set(workbookData.companyContacts.map((row) => row.company).filter(Boolean)).size;
    const contacts = new Set(workbookData.companyContacts.map((row) => row.contact).filter(Boolean)).size;
    const phones = workbookData.companyContacts.filter((row) => row.phoneNumber).length;
    const uniquePhoneSet = new Set(workbookData.companyContacts.map((row) => row.normalizedPhone).filter(Boolean));
    const calledUniquePhones = new Set(
      coverageRows.filter((row) => row.hasCall).map((row) => row.normalizedPhone).filter(Boolean),
    ).size;
    const uniquePhones = uniquePhoneSet.size;
    const uncalledUniquePhones = Math.max(0, uniquePhones - calledUniquePhones);
    const coveragePercent = uniquePhones > 0 ? (calledUniquePhones / uniquePhones) * 100 : 0;
    const forgottenClientsCount = coverageRows.filter((row) => {
      if (clientThreshold === "never") {
        return !row.hasCall;
      }
      return row.status === "Не звонили" || row.status === "Забытый клиент";
    }).length;
    return {
      companies,
      contacts,
      phones,
      uniquePhones,
      calledUniquePhones,
      uncalledUniquePhones,
      coveragePercent,
      forgottenClientsCount,
    };
  }, [clientThreshold, coverageRows, workbookData]);

  const totalQualifiedCalls = useMemo(
    () =>
      workbookData?.calls.filter((row) => allowedManagersSet.has(row.manager) && isQualifiedCall(row)).length ?? 0,
    [allowedManagersSet, workbookData],
  );
  const planPerformance = useMemo<PlanPerformanceSummary | null>(() => {
    if (!workbookData || workbookData.planRows.length === 0) {
      return null;
    }

    const filtered = workbookData.planRows.filter((row) => {
      if (!allowedManagersSet.has(row.manager)) {
        return false;
      }
      if (selectedManager !== "ALL" && row.manager !== selectedManager) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      return null;
    }

    const totalPlan = filtered.reduce((sum, row) => sum + row.planAmount, 0);
    const totalFact = filtered.reduce((sum, row) => sum + row.factAmount, 0);
    const groupMap = new Map<string, { totalPlan: number; totalFact: number }>();

    filtered.forEach((row) => {
      const groupName = row.group?.trim() || resolveLeaderGroupName(row.manager);
      const current = groupMap.get(groupName) ?? { totalPlan: 0, totalFact: 0 };
      current.totalPlan += row.planAmount;
      current.totalFact += row.factAmount;
      groupMap.set(groupName, current);
    });

    const groups: PlanGroupSummary[] = Array.from(groupMap.entries())
      .map(([groupName, values]) => ({
        groupName,
        totalPlan: values.totalPlan,
        totalFact: values.totalFact,
        completionPercent: values.totalPlan > 0 ? (values.totalFact / values.totalPlan) * 100 : 0,
      }))
      .sort((a, b) => b.completionPercent - a.completionPercent);

    return {
      totalPlan,
      totalFact,
      completionPercent: totalPlan > 0 ? (totalFact / totalPlan) * 100 : 0,
      groups,
    };
  }, [allowedManagersSet, selectedManager, workbookData]);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="brand-lockup">
          <div className="brand-wordmark" aria-label="BIOCARD">
            <span>BI</span>
            <span className="brand-wordmark__mark" />
            <span>CARD</span>
          </div>
          <span className="brand-subtitle">Bitrix24 Sales Dashboard</span>
        </div>

        <div className="topbar-status">
          <span className="topbar-status__time">{formatMoscowDateTime(now)} (МСК)</span>
          {workbookData ? (
            <>
              <span>Файл: {workbookData.fileName}</span>
              <span>Месяц: {selectedMonth}</span>
              <span>Квалифицированных звонков: {totalQualifiedCalls}</span>
            </>
          ) : (
            <span>Файл не загружен</span>
          )}
        </div>
      </header>

      <section className="panel app-intro">
        <span className="eyebrow">Отдел продаж</span>
        <h1>Аналитика продаж и клиентской базы</h1>
        <p>Клиентская аналитика по звонкам, сделкам и лидам без передачи данных на сервер.</p>
        {workbookData ? (
          <div className="intro-meta">
            <span>
              Период: {formatDate(currentRange.start)} - {formatDate(currentRange.end)}
            </span>
            <span>
              Плановый период: {formatDate(planRange.start)} - {formatDate(planRange.end)}
            </span>
          </div>
        ) : null}
      </section>

      <TopFilters
        fileName={workbookData?.fileName}
        managerOptions={managerOptions}
        selectedLeaderGroup={selectedLeaderGroup}
        selectedManager={selectedManager}
        selectedMonth={selectedMonth}
        workingDaysInMonth={workingDaysToCurrentDate}
        onLeaderGroupChange={setSelectedLeaderGroup}
        onManagerChange={setSelectedManager}
        onMonthChange={setSelectedMonth}
        onFileSelect={handleFileSelect}
        onReset={resetFilters}
      />

      {errorMessage ? <section className="panel error-panel">{errorMessage}</section> : null}
      {workbookData ? (
        <>
          <section className="tabs">
            <button
              type="button"
              className={activeTab === "metrics" ? "tab-button is-active" : "tab-button"}
              onClick={() => setActiveTab("metrics")}
            >
              Метрики
            </button>
            <button
              type="button"
              className={activeTab === "clients" ? "tab-button is-active" : "tab-button"}
              onClick={() => setActiveTab("clients")}
            >
              Клиенты
            </button>
          </section>

          {activeTab === "metrics" ? (
            <MetricsTab
              managerMetrics={managerMetrics}
              previousManagerMetrics={previousManagerMetrics}
              kpis={metricsKpis}
              deltas={metricsDeltas}
              workingDaysInMonth={workingDaysToCurrentDate}
              planPerformance={planPerformance}
            />
          ) : (
            <ClientsTab
              coverageRows={coverageRows}
              contributionRows={contributionRows}
              selectedStatus={clientStatus}
              selectedManager={selectedManager}
              managerOptions={managerOptions}
              forgottenThreshold={clientThreshold}
              searchCompany={clientSearchCompany}
              searchContact={clientSearchContact}
              searchPhone={clientSearchPhone}
              onStatusChange={setClientStatus}
              onManagerChange={setSelectedManager}
              onThresholdChange={setClientThreshold}
              onSearchCompanyChange={setClientSearchCompany}
              onSearchContactChange={setClientSearchContact}
              onSearchPhoneChange={setClientSearchPhone}
              kpis={clientKpis}
            />
          )}
        </>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
