import { useMemo, useState } from "react";
import { ManagerMetrics } from "../types";

interface LeadersBoardTabProps {
  managerMetrics: ManagerMetrics[];
  previousManagerMetrics: ManagerMetrics[];
}

type LeaderKey = "KAMINSKAYA" | "MASHENKOV";
type LeaderConfig = { id: LeaderKey; name: string; members: string[] };

const LEADERS: LeaderConfig[] = [
  { id: "KAMINSKAYA", name: "Каминская", members: ["Швед", "Куприенко", "Кучер", "Первов", "Белик"] },
  { id: "MASHENKOV", name: "Машенков", members: ["Отин", "Тарасов", "Тодорова", "Кузнецова", "Романов"] },
];

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

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function calcAvgKpi(row: ManagerMetrics): number {
  return (
    clampPercent(row.callPlanCompletion) * 0.2 +
    clampPercent(row.meetingPlanCompletionPercent) * 0.3 +
    clampPercent(row.dealConversion) * 0.3 +
    clampPercent(row.leadConversion) * 0.2
  );
}

function formatSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return "0.0";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function TrendBadge({ delta }: { delta: number }) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) {
    return <span className="exec-trend exec-trend--flat">• 0.0</span>;
  }
  const up = delta > 0;
  return (
    <span className={up ? "exec-trend exec-trend--up" : "exec-trend exec-trend--down"}>
      {up ? "▲" : "▼"} {formatSigned(delta)}
    </span>
  );
}

function buildProgressBlocks(value: number, total = 16): boolean[] {
  const safe = clampPercent(value);
  const active = Math.round((safe / 100) * total);
  return Array.from({ length: total }, (_, index) => index < active);
}

export function LeadersBoardTab({ managerMetrics, previousManagerMetrics }: LeadersBoardTabProps) {
  const [selectedLeader, setSelectedLeader] = useState<LeaderKey>("KAMINSKAYA");

  const previousMap = useMemo(
    () => new Map(previousManagerMetrics.map((row) => [row.manager, row])),
    [previousManagerMetrics],
  );

  const leadersState = useMemo(
    () =>
      LEADERS.map((leader) => {
        const managers = managerMetrics.filter((row) => isManagerInGroup(row.manager, leader.members));
        const prevManagers = previousManagerMetrics.filter((row) => isManagerInGroup(row.manager, leader.members));

        const callsFact = managers.reduce((sum, row) => sum + row.callCount, 0);
        const callsPlan = managers.reduce((sum, row) => sum + row.callPlan, 0);
        const callsPercent = callsPlan > 0 ? (callsFact / callsPlan) * 100 : 0;

        const meetingsFact = managers.reduce((sum, row) => sum + row.meetingsCount, 0);
        const meetingsPlan = managers.reduce((sum, row) => sum + row.meetingPlan, 0);
        const meetingsPercent = meetingsPlan > 0 ? (meetingsFact / meetingsPlan) * 100 : 0;

        const dealsTotal = managers.reduce((sum, row) => sum + row.dealCount, 0);
        const dealsWon = managers.reduce((sum, row) => sum + row.dealsWon, 0);
        const dealsConv = dealsTotal > 0 ? (dealsWon / dealsTotal) * 100 : 0;

        const leadsTotal = managers.reduce((sum, row) => sum + row.leadCount, 0);
        const leadsWon = managers.reduce((sum, row) => sum + row.leadsSuccessful, 0);
        const leadsConv = leadsTotal > 0 ? (leadsWon / leadsTotal) * 100 : 0;

        const avgKpi =
          clampPercent(callsPercent) * 0.2 +
          clampPercent(meetingsPercent) * 0.3 +
          clampPercent(dealsConv) * 0.3 +
          clampPercent(leadsConv) * 0.2;

        const prevAvgKpi = prevManagers.length
          ? prevManagers.reduce((sum, row) => sum + calcAvgKpi(row), 0) / prevManagers.length
          : 0;

        return {
          ...leader,
          managers,
          callsFact,
          callsPlan,
          callsPercent,
          meetingsFact,
          meetingsPlan,
          meetingsPercent,
          dealsTotal,
          dealsWon,
          dealsConv,
          leadsTotal,
          leadsWon,
          leadsConv,
          avgKpi,
          avgKpiDelta: avgKpi - prevAvgKpi,
        };
      }),
    [managerMetrics, previousManagerMetrics],
  );

  const activeLeader =
    leadersState.find((item) => item.id === selectedLeader && item.managers.length > 0) ??
    leadersState.find((item) => item.managers.length > 0) ??
    null;

  const rankedManagers = useMemo(() => {
    if (!activeLeader) return [];
    return activeLeader.managers
      .map((row) => {
        const prev = previousMap.get(row.manager);
        const currentKpi = calcAvgKpi(row);
        const prevKpi = prev ? calcAvgKpi(prev) : 0;
        return {
          ...row,
          avgKpi: currentKpi,
          avgKpiDelta: currentKpi - prevKpi,
        };
      })
      .sort((a, b) => b.avgKpi - a.avgKpi);
  }, [activeLeader, previousMap]);

  if (!activeLeader) {
    return (
      <section className="panel empty-state">
        <h2>Нет данных по руководителям</h2>
      </section>
    );
  }

  return (
    <section className="executive-board">
      <aside className="exec-sidebar">
        <div className="exec-sidebar__title">Руководители</div>
        {leadersState.map((leader) => (
          <button
            key={leader.id}
            type="button"
            className={leader.id === activeLeader.id ? "exec-leader-btn is-active" : "exec-leader-btn"}
            onClick={() => setSelectedLeader(leader.id)}
          >
            <strong>{leader.name}</strong>
            <span>{leader.managers.length} менеджеров</span>
            <span>КЭ: {(leader.avgKpi / 10).toFixed(1)}</span>
          </button>
        ))}
      </aside>

      <div className="exec-main">
        <div className="exec-top">
          <article className="exec-card exec-card--kpi">
            <h3>Общий KPI (КЭ)</h3>
            <div className="exec-kpi">
              <span className="exec-kpi__value">{activeLeader.avgKpi.toFixed(1)}%</span>
              <TrendBadge delta={activeLeader.avgKpiDelta} />
            </div>
            <div className="exec-kpi__meta">КЭ: {(activeLeader.avgKpi / 10).toFixed(1)} из 10</div>
          </article>

          <article className="exec-card">
            <h3>Звонки — % выполнения</h3>
            <div className="exec-value-line">
              <span>{activeLeader.callsFact} / {activeLeader.callsPlan}</span>
              <span>{activeLeader.callsPercent.toFixed(1)}%</span>
            </div>
            <div className="exec-progress"><span style={{ width: `${clampPercent(activeLeader.callsPercent)}%` }} /></div>
          </article>

          <article className="exec-card">
            <h3>Встречи — % выполнения</h3>
            <div className="exec-value-line">
              <span>{activeLeader.meetingsFact} / {activeLeader.meetingsPlan}</span>
              <span>{activeLeader.meetingsPercent.toFixed(1)}%</span>
            </div>
            <div className="exec-progress"><span style={{ width: `${clampPercent(activeLeader.meetingsPercent)}%` }} /></div>
          </article>

          <article className="exec-card">
            <h3>Сделки / Лиды — конверсия</h3>
            <div className="exec-two-lines">
              <div>Сделки: {activeLeader.dealsWon}/{activeLeader.dealsTotal} ({activeLeader.dealsConv.toFixed(1)}%)</div>
              <div>Лиды: {activeLeader.leadsWon}/{activeLeader.leadsTotal} ({activeLeader.leadsConv.toFixed(1)}%)</div>
            </div>
          </article>
        </div>

        <div className="exec-managers">
          <div className="exec-managers__head">
            <h3>Метрики по менеджерам ({activeLeader.name})</h3>
          </div>
          <div className="exec-managers__list exec-managers__list--cards">
            {rankedManagers.map((manager) => (
              <article key={manager.manager} className="exec-manager exec-manager--styled">
                <div className="exec-manager__top">
                  <div className="exec-manager__avatar" aria-hidden />
                  <div className="exec-manager__top-name">
                    <strong>{manager.manager}</strong>
                    <span>общий показатель (КЭ)</span>
                  </div>
                  <div className="exec-manager__top-rate">
                    <span>{(manager.avgKpi / 10).toFixed(2)}</span>
                  </div>
                </div>

                <div className="exec-blocks-row">
                  {buildProgressBlocks(manager.avgKpi).map((isActive, idx) => (
                    <span key={`${manager.manager}-kpi-${idx}`} className={isActive ? "exec-block is-active" : "exec-block"} />
                  ))}
                </div>

                <div className="exec-manager__body">
                  <div
                    className="exec-figure"
                    style={{ ["--plan-fill" as string]: `${clampPercent(manager.callPlanCompletion)}%` }}
                    aria-hidden
                  >
                    <div className="exec-figure-layer exec-figure-layer--base">
                      <span className="exec-figure__head" />
                      <span className="exec-figure__body" />
                      <span className="exec-figure__arm exec-figure__arm--left" />
                      <span className="exec-figure__arm exec-figure__arm--right" />
                      <span className="exec-figure__leg exec-figure__leg--left" />
                      <span className="exec-figure__leg exec-figure__leg--right" />
                    </div>
                    <div className="exec-figure-layer exec-figure-layer--fill">
                      <span className="exec-figure__head" />
                      <span className="exec-figure__body" />
                      <span className="exec-figure__arm exec-figure__arm--left" />
                      <span className="exec-figure__arm exec-figure__arm--right" />
                      <span className="exec-figure__leg exec-figure__leg--left" />
                      <span className="exec-figure__leg exec-figure__leg--right" />
                    </div>
                  </div>

                  <div className="exec-manager__kpi">
                    <span>{manager.avgKpi.toFixed(1)}%</span>
                    <TrendBadge delta={manager.avgKpiDelta} />
                  </div>
                </div>

                <div className="exec-manager__stats">
                  <span>Звонки: {manager.callPlanCompletion.toFixed(1)}%</span>
                  <span>Встречи: {manager.meetingPlanCompletionPercent.toFixed(1)}%</span>
                  <span>Сделки: {manager.dealConversion.toFixed(1)}%</span>
                  <span>Лиды: {manager.leadConversion.toFixed(1)}%</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

