import { Fragment, ReactNode, useMemo, useState } from "react";
import { formatPercent } from "../lib/dates";
import { ManagerMetrics } from "../types";

interface MetricsTabProps {
  managerMetrics: ManagerMetrics[];
  previousManagerMetrics: ManagerMetrics[];
  kpis: {
    totalCalls: number;
    totalMeetings: number;
    callPlan: number;
    meetingPlan: number;
    planCompletion: number;
    meetingPlanCompletion: number;
    averageCallsPerManager: number;
    averageMeetingsPerManager: number;
    managersCount: number;
  };
  deltas: {
    calls: number;
    meetings: number;
    deals: number;
    leads: number;
    planCompletion: number;
    meetingPlanCompletion: number;
    dealConversion: number;
    leadConversion: number;
  };
  workingDaysInMonth: number;
  planPerformance: {
    totalPlan: number;
    totalFact: number;
    completionPercent: number;
    groups: Array<{
      groupName: string;
      totalPlan: number;
      totalFact: number;
      completionPercent: number;
    }>;
  } | null;
}

type TrafficTone = "good" | "warn" | "bad";

type LeaderGroup = {
  id: "KAMINSKAYA" | "MASHENKOV";
  name: string;
  members: string[];
};

type RankedManager = ManagerMetrics & {
  avgKpi: number;
  groupName: string;
};

type GroupRow = {
  id: LeaderGroup["id"];
  name: string;
  managers: RankedManager[];
  callFact: number;
  callPlan: number;
  callPercent: number;
  meetingFact: number;
  meetingPlan: number;
  meetingPercent: number;
  dealsTotal: number;
  dealsInProgress: number;
  dealsWon: number;
  dealsPercent: number;
  leadsTotal: number;
  leadsWon: number;
  leadsPercent: number;
  avgKpi: number;
};

const NUMBER_FORMATTER = new Intl.NumberFormat("ru-RU");
const MONEY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const LEADER_GROUPS: LeaderGroup[] = [
  { id: "KAMINSKAYA", name: "Каминская Регина", members: ["Швед", "Куприенко", "Кучер", "Первов", "Белик", "Служаева", "Служ"] },
  { id: "MASHENKOV", name: "Машенков Денис", members: ["Отин", "Тарасов", "Тодорова", "Кузнецова", "Романов"] },
];

function getTrafficTone(value: number, goodFrom: number, warnFrom: number): TrafficTone {
  if (value >= goodFrom) return "good";
  if (value >= warnFrom) return "warn";
  return "bad";
}

function TrafficValue({ value, tone }: { value: ReactNode; tone: TrafficTone }) {
  return (
    <span className={`traffic-value traffic-value--${tone}`}>
      {value}
      <span className={`traffic-light traffic-light--${tone}`} aria-hidden />
    </span>
  );
}

function formatInt(value: number): string {
  return NUMBER_FORMATTER.format(Math.round(Number.isFinite(value) ? value : 0));
}

function formatCoef10(value: number): string {
  return (Math.min(Math.max(value, 0), 100) / 10).toFixed(1);
}

function formatMoney(value: number): string {
  return MONEY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function formatSigned(value: number, digits = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (Math.abs(safe) < 0.05) {
    return "0.0";
  }
  const sign = safe > 0 ? "+" : "";
  return `${sign}${safe.toFixed(digits)}`;
}

function DeltaArrow({ delta, suffix = "" }: { delta: number; suffix?: string }) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) {
    return <span className="delta-chip delta-chip--flat">• 0{suffix}</span>;
  }
  const up = delta > 0;
  return (
    <span className={up ? "delta-chip delta-chip--up" : "delta-chip delta-chip--down"}>
      {up ? "▲" : "▼"} {formatSigned(delta)}
      {suffix}
    </span>
  );
}

function normalizeNameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, " ")
    .split(/[\s-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isManagerInGroup(managerName: string, groupMembers: string[]): boolean {
  const managerTokens = normalizeNameTokens(managerName);
  return groupMembers.some((memberMask) => {
    const maskTokens = normalizeNameTokens(memberMask);
    return maskTokens.every((maskToken) =>
      managerTokens.some((token) => token.startsWith(maskToken) || maskToken.startsWith(token)),
    );
  });
}

function calculateAvgKpi(row: ManagerMetrics): number {
  const calls = Math.min(Math.max(row.callPlanCompletion, 0), 100);
  const meetings = Math.min(Math.max(row.meetingPlanCompletionPercent, 0), 100);
  const deals = Math.min(Math.max(row.dealConversion, 0), 100);
  const leads = Math.min(Math.max(row.leadConversion, 0), 100);
  return calls * 0.2 + meetings * 0.3 + deals * 0.3 + leads * 0.2;
}

function aggregateAvgKpi(callPercent: number, meetingPercent: number, dealsPercent: number, leadsPercent: number): number {
  const calls = Math.min(Math.max(callPercent, 0), 100);
  const meetings = Math.min(Math.max(meetingPercent, 0), 100);
  const deals = Math.min(Math.max(dealsPercent, 0), 100);
  const leads = Math.min(Math.max(leadsPercent, 0), 100);
  return calls * 0.2 + meetings * 0.3 + deals * 0.3 + leads * 0.2;
}

function getGroupNameForManager(managerName: string): string {
  const group = LEADER_GROUPS.find((item) => isManagerInGroup(managerName, item.members));
  return group?.name ?? "Без группы";
}

function buildGroupRows(rows: RankedManager[]): GroupRow[] {
  return LEADER_GROUPS.map((group) => {
    const managers = rows.filter((row) => isManagerInGroup(row.manager, group.members));

    const callFact = managers.reduce((sum, row) => sum + row.callCount, 0);
    const callPlan = managers.reduce((sum, row) => sum + row.callPlan, 0);
    const callPercent = callPlan > 0 ? (callFact / callPlan) * 100 : 0;

    const meetingFact = managers.reduce((sum, row) => sum + row.meetingsCount, 0);
    const meetingPlan = managers.reduce((sum, row) => sum + row.meetingPlan, 0);
    const meetingPercent = meetingPlan > 0 ? (meetingFact / meetingPlan) * 100 : 0;

    const dealsTotal = managers.reduce((sum, row) => sum + row.dealCount, 0);
    const dealsInProgress = managers.reduce((sum, row) => sum + row.dealsInProgress, 0);
    const dealsWon = managers.reduce((sum, row) => sum + row.dealsWon, 0);
    const dealsPercent = dealsTotal > 0 ? (dealsWon / dealsTotal) * 100 : 0;

    const leadsTotal = managers.reduce((sum, row) => sum + row.leadCount, 0);
    const leadsWon = managers.reduce((sum, row) => sum + row.leadsSuccessful, 0);
    const leadsPercent = leadsTotal > 0 ? (leadsWon / leadsTotal) * 100 : 0;

    return {
      id: group.id,
      name: group.name,
      managers,
      callFact,
      callPlan,
      callPercent,
      meetingFact,
      meetingPlan,
      meetingPercent,
      dealsTotal,
      dealsInProgress,
      dealsWon,
      dealsPercent,
      leadsTotal,
      leadsWon,
      leadsPercent,
      avgKpi: aggregateAvgKpi(callPercent, meetingPercent, dealsPercent, leadsPercent),
    };
  }).filter((group) => group.managers.length > 0);
}

export function MetricsTab({ managerMetrics, previousManagerMetrics, kpis, deltas, workingDaysInMonth, planPerformance }: MetricsTabProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    KAMINSKAYA: true,
    MASHENKOV: true,
  });
  const [isTopOpen, setIsTopOpen] = useState(true);
  const [isLaggingOpen, setIsLaggingOpen] = useState(true);

  const totals = useMemo(() => {
    const dealCount = managerMetrics.reduce((sum, row) => sum + row.dealCount, 0);
    const dealsWon = managerMetrics.reduce((sum, row) => sum + row.dealsWon, 0);
    const leadCount = managerMetrics.reduce((sum, row) => sum + row.leadCount, 0);
    const leadsSuccessful = managerMetrics.reduce((sum, row) => sum + row.leadsSuccessful, 0);

    return {
      dealCount,
      dealsWon,
      dealConversion: dealCount > 0 ? (dealsWon / dealCount) * 100 : 0,
      leadCount,
      leadsSuccessful,
      leadConversion: leadCount > 0 ? (leadsSuccessful / leadCount) * 100 : 0,
    };
  }, [managerMetrics]);

  const rankedManagers = useMemo<RankedManager[]>(
    () =>
      managerMetrics.map((row) => ({
        ...row,
        avgKpi: calculateAvgKpi(row),
        groupName: getGroupNameForManager(row.manager),
      })),
    [managerMetrics],
  );

  const topManagers = useMemo(
    () => [...rankedManagers].sort((a, b) => b.avgKpi - a.avgKpi).slice(0, 3),
    [rankedManagers],
  );

  const laggingManagers = useMemo(() => {
    const withCalls = rankedManagers.filter((row) => row.callCount > 0);
    const source = withCalls.length >= 3 ? withCalls : rankedManagers;
    return [...source].sort((a, b) => a.avgKpi - b.avgKpi).slice(0, 3);
  }, [rankedManagers]);

  const groupRows = useMemo(() => buildGroupRows(rankedManagers), [rankedManagers]);
  const previousManagerAvgMap = useMemo(
    () => new Map(previousManagerMetrics.map((row) => [row.manager, calculateAvgKpi(row)])),
    [previousManagerMetrics],
  );
  const previousGroupAvgMap = useMemo(() => {
    const prevRanked: RankedManager[] = previousManagerMetrics.map((row) => ({
      ...row,
      avgKpi: calculateAvgKpi(row),
      groupName: getGroupNameForManager(row.manager),
    }));
    return new Map(buildGroupRows(prevRanked).map((row) => [row.id, row.avgKpi]));
  }, [previousManagerMetrics]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <div className="tab-layout">
      <section className="traffic-grid">
        <article className="panel traffic-card">
          <h3>Звонки (итог)</h3>
          <div className="traffic-split compact-traffic-split">
            <div className="traffic-split__item">
              <span className="traffic-label">План</span>
              <strong>{formatInt(kpis.callPlan)}</strong>
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Факт</span>
              <strong>{formatInt(kpis.totalCalls)}</strong>
              <DeltaArrow delta={deltas.calls} />
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Выполнение</span>
              <TrafficValue value={formatPercent(kpis.planCompletion)} tone={getTrafficTone(kpis.planCompletion, 90, 70)} />
              <DeltaArrow delta={deltas.planCompletion} suffix=" п.п." />
            </div>
          </div>
        </article>

        <article className="panel traffic-card">
          <h3>Встречи (итог)</h3>
          <div className="traffic-split compact-traffic-split">
            <div className="traffic-split__item">
              <span className="traffic-label">План</span>
              <strong>{formatInt(kpis.meetingPlan)}</strong>
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Факт</span>
              <strong>{formatInt(kpis.totalMeetings)}</strong>
              <DeltaArrow delta={deltas.meetings} />
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Выполнение</span>
              <TrafficValue
                value={formatPercent(kpis.meetingPlanCompletion)}
                tone={getTrafficTone(kpis.meetingPlanCompletion, 90, 70)}
              />
              <DeltaArrow delta={deltas.meetingPlanCompletion} suffix=" п.п." />
            </div>
          </div>
        </article>

        <article className="panel traffic-card">
          <h3>Сделки (итог)</h3>
          <div className="traffic-split compact-traffic-split">
            <div className="traffic-split__item">
              <span className="traffic-label">Всего</span>
              <strong>{formatInt(totals.dealCount)}</strong>
              <DeltaArrow delta={deltas.deals} />
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">В работе</span>
              <strong>{formatInt(Math.max(totals.dealCount - totals.dealsWon, 0))}</strong>
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Конв.</span>
              <TrafficValue value={formatPercent(totals.dealConversion)} tone={getTrafficTone(totals.dealConversion, 25, 15)} />
              <DeltaArrow delta={deltas.dealConversion} suffix=" п.п." />
            </div>
          </div>
        </article>

        <article className="panel traffic-card">
          <h3>Лиды (итог)</h3>
          <div className="traffic-split compact-traffic-split">
            <div className="traffic-split__item">
              <span className="traffic-label">Всего</span>
              <strong>{formatInt(totals.leadCount)}</strong>
              <DeltaArrow delta={deltas.leads} />
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Успешные</span>
              <strong>{formatInt(totals.leadsSuccessful)}</strong>
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Конв.</span>
              <TrafficValue value={formatPercent(totals.leadConversion)} tone={getTrafficTone(totals.leadConversion, 25, 15)} />
              <DeltaArrow delta={deltas.leadConversion} suffix=" п.п." />
            </div>
          </div>
        </article>
      </section>

      {planPerformance ? (
        <section className="panel plan-performance-panel">
          <div className="section-header">
            <div>
              <h2>Выполнение плана (руб.)</h2>
            </div>
          </div>
          <div className="traffic-split compact-traffic-split plan-performance-total">
            <div className="traffic-split__item">
              <span className="traffic-label">Общий план</span>
              <strong>{formatMoney(planPerformance.totalPlan)}</strong>
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">Общий факт</span>
              <strong>{formatMoney(planPerformance.totalFact)}</strong>
            </div>
            <div className="traffic-split__item">
              <span className="traffic-label">% выполнения</span>
              <TrafficValue
                value={formatPercent(planPerformance.completionPercent)}
                tone={getTrafficTone(planPerformance.completionPercent, 90, 70)}
              />
            </div>
          </div>

          <div className="plan-groups-grid">
            {planPerformance.groups.map((group) => (
              <article key={group.groupName} className="plan-group-card">
                <header>
                  <h3>{group.groupName}</h3>
                  <TrafficValue
                    value={formatPercent(group.completionPercent)}
                    tone={getTrafficTone(group.completionPercent, 90, 70)}
                  />
                </header>
                <div className="plan-group-card__stats">
                  <span>План: {formatMoney(group.totalPlan)}</span>
                  <span>Факт: {formatMoney(group.totalFact)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="ranking-grid">
        <article className="panel ranking-panel ranking-panel--good">
          <div className="ranking-head">
            <h3>Тройка лидеров по KPI</h3>
            <button type="button" className="ranking-toggle" onClick={() => setIsTopOpen((prev) => !prev)}>
              {isTopOpen ? "Скрыть" : "Показать"}
            </button>
          </div>
          {isTopOpen ? (
            <ul className="ranking-list">
              {topManagers.map((manager, index) => (
                <li key={manager.manager} className="ranking-item">
                  <div className="ranking-item__head">
                    <span className="ranking-place">#{index + 1}</span>
                    <div className="ranking-item__name-wrap">
                      <strong>{manager.manager}</strong>
                      <span>{manager.groupName}</span>
                    </div>
                    <span className="ranking-score">{formatPercent(manager.avgKpi)}</span>
                  </div>
                  <div className="ranking-item__stats">
                    <span>Звонки: {formatPercent(manager.callPlanCompletion)}</span>
                    <span>Встречи: {formatPercent(manager.meetingPlanCompletionPercent)}</span>
                    <span>Сделки: {formatPercent(manager.dealConversion)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </article>

        <article className="panel ranking-panel ranking-panel--bad">
          <div className="ranking-head">
            <h3>Тройка отстающих по KPI</h3>
            <button type="button" className="ranking-toggle" onClick={() => setIsLaggingOpen((prev) => !prev)}>
              {isLaggingOpen ? "Скрыть" : "Показать"}
            </button>
          </div>
          {isLaggingOpen ? (
            <ul className="ranking-list">
              {laggingManagers.map((manager, index) => (
                <li key={manager.manager} className="ranking-item">
                  <div className="ranking-item__head">
                    <span className="ranking-place">#{index + 1}</span>
                    <div className="ranking-item__name-wrap">
                      <strong>{manager.manager}</strong>
                      <span>{manager.groupName}</span>
                    </div>
                    <span className="ranking-score">{formatPercent(manager.avgKpi)}</span>
                  </div>
                  <div className="ranking-item__stats">
                    <span>Звонки: {formatPercent(manager.callPlanCompletion)}</span>
                    <span>Встречи: {formatPercent(manager.meetingPlanCompletionPercent)}</span>
                    <span>Сделки: {formatPercent(manager.dealConversion)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>

      <section className="panel group-summary-panel">
        <div className="section-header">
          <div>
            <h2>Сводная таблица эффективности (по группам)</h2>
            <p>Рабочих дней: {workingDaysInMonth}. Менеджеров в выборке: {kpis.managersCount}.</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="group-metrics-table">
            <thead>
              <tr className="group-metrics-table__head-main">
                <th rowSpan={2}>Группа / Менеджер</th>
                <th colSpan={2} className="align-center">ЗВОНКИ</th>
                <th colSpan={2} className="align-center">ВСТРЕЧИ</th>
                <th colSpan={3} className="align-center">СДЕЛКИ</th>
                <th className="align-center">ОЦЕНКА</th>
              </tr>
              <tr className="group-metrics-table__head-sub">
                <th>Факт / План</th>
                <th>%</th>
                <th>Факт / План</th>
                <th>%</th>
                <th>Всего / В работе</th>
                <th>Успех</th>
                <th>Конв(%)</th>
                <th>КЭ (из 10)</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((group) => (
                <Fragment key={group.id}>
                  <tr className="group-row">
                    <td>
                      <button type="button" className="group-toggle" onClick={() => toggleGroup(group.id)}>
                        {expandedGroups[group.id] ? "▾" : "▸"} {group.name}
                      </button>
                    </td>
                    <td>
                      <div className="cell-split">{formatInt(group.callFact)} / {formatInt(group.callPlan)}</div>
                    </td>
                    <td>
                      <TrafficValue value={formatPercent(group.callPercent)} tone={getTrafficTone(group.callPercent, 90, 70)} />
                    </td>
                    <td>
                      <div className="cell-split">{formatInt(group.meetingFact)} / {formatInt(group.meetingPlan)}</div>
                    </td>
                    <td>
                      <TrafficValue value={formatPercent(group.meetingPercent)} tone={getTrafficTone(group.meetingPercent, 90, 70)} />
                    </td>
                    <td>
                      <div className="cell-split">{formatInt(group.dealsTotal)} / {formatInt(group.dealsInProgress)}</div>
                    </td>
                    <td>
                      <div className="cell-success">{formatInt(group.dealsWon)}</div>
                    </td>
                    <td>
                      <TrafficValue value={formatPercent(group.dealsPercent)} tone={getTrafficTone(group.dealsPercent, 25, 15)} />
                    </td>
                    <td>
                      <div className="cell-score-wrap">
                        <div className="cell-score">{formatCoef10(group.avgKpi)}</div>
                        <DeltaArrow delta={group.avgKpi - (previousGroupAvgMap.get(group.id) ?? 0)} />
                      </div>
                    </td>
                  </tr>

                  {expandedGroups[group.id]
                    ? group.managers
                        .sort((a, b) => b.avgKpi - a.avgKpi)
                        .map((manager) => (
                          <tr key={`${group.id}-${manager.manager}`} className="manager-row">
                            <td>{manager.manager}</td>
                            <td>
                              <div className="cell-split">{formatInt(manager.callCount)} / {formatInt(manager.callPlan)}</div>
                            </td>
                            <td>
                              <TrafficValue
                                value={formatPercent(manager.callPlanCompletion)}
                                tone={getTrafficTone(manager.callPlanCompletion, 90, 70)}
                              />
                            </td>
                            <td>
                              <div className="cell-split">{formatInt(manager.meetingsCount)} / {formatInt(manager.meetingPlan)}</div>
                            </td>
                            <td>
                              <TrafficValue
                                value={formatPercent(manager.meetingPlanCompletionPercent)}
                                tone={getTrafficTone(manager.meetingPlanCompletionPercent, 90, 70)}
                              />
                            </td>
                            <td>
                              <div className="cell-split">{formatInt(manager.dealCount)} / {formatInt(manager.dealsInProgress)}</div>
                            </td>
                            <td>
                              <div className="cell-success">{formatInt(manager.dealsWon)}</div>
                            </td>
                            <td>
                              <TrafficValue
                                value={formatPercent(manager.dealConversion)}
                                tone={getTrafficTone(manager.dealConversion, 25, 15)}
                              />
                            </td>
                            <td>
                              <div className="cell-score-wrap">
                                <div className="cell-score">{formatCoef10(manager.avgKpi)}</div>
                                <DeltaArrow delta={manager.avgKpi - (previousManagerAvgMap.get(manager.manager) ?? 0)} />
                              </div>
                            </td>
                          </tr>
                        ))
                    : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
