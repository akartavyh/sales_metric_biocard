import { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DailyCallsPoint,
  DailyCreatedPoint,
  DailyMeetingsPoint,
  ManagerMetrics,
  MeetingsByManagerPoint,
} from "../types";

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="panel chart-card">
      <div className="section-header">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="chart-frame">{children}</div>
    </article>
  );
}

function EmptyChart() {
  return <div className="chart-empty">Недостаточно данных для построения графика</div>;
}

export function MetricsCharts({
  managerMetrics,
  callsTrend,
  createdTrend,
  meetingsTrend,
  meetingsByManager,
}: {
  managerMetrics: ManagerMetrics[];
  callsTrend: DailyCallsPoint[];
  createdTrend: DailyCreatedPoint[];
  meetingsTrend: DailyMeetingsPoint[];
  meetingsByManager: MeetingsByManagerPoint[];
}) {
  const baseManagerData = managerMetrics.map((row) => ({
    manager: row.manager,
    calls: row.callCount,
    callPlanCompletion: Number(row.callPlanCompletion.toFixed(1)),
    meetings: row.meetingsCount,
    meetingPlanCompletion: Number(row.meetingPlanCompletionPercent.toFixed(1)),
    completedMeetings: row.completedMeetings,
    notCompletedMeetings: row.notCompletedMeetings,
    unknownStatusMeetings: row.unknownStatusMeetings,
    dealsWon: row.dealsWon,
    dealsLost: row.dealsLost,
    dealsInProgress: row.dealsInProgress,
    leadsSuccessful: row.leadsSuccessful,
    leadsLost: row.leadsLost,
    leadsInProgress: row.leadsInProgress,
  }));

  const managerMeetingData = meetingsByManager.length ? meetingsByManager : baseManagerData.map((row) => ({
    manager: row.manager,
    meetingsCount: row.meetings,
    meetingPlanCompletionPercent: row.meetingPlanCompletion,
    completedMeetings: row.completedMeetings,
    notCompletedMeetings: row.notCompletedMeetings,
    unknownStatusMeetings: row.unknownStatusMeetings,
  }));

  return (
    <div className="charts-grid">
      <ChartCard title="Звонки по менеджерам">
        {baseManagerData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={baseManagerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calls" fill="#1f6feb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Выполнение плана звонков, %">
        {baseManagerData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={baseManagerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="callPlanCompletion" fill="#058527" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Встречи по менеджерам">
        {managerMeetingData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={managerMeetingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="meetingsCount" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Выполнение плана встреч, %">
        {managerMeetingData.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={managerMeetingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="meetingPlanCompletionPercent" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Встречи: выполнено / не выполнено / статус неизвестен">
        {managerMeetingData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={managerMeetingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="completedMeetings" stackId="meetings" fill="#16a34a" />
              <Bar dataKey="notCompletedMeetings" stackId="meetings" fill="#dc2626" />
              <Bar dataKey="unknownStatusMeetings" stackId="meetings" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Динамика встреч по дням">
        {meetingsTrend.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={meetingsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="meetings" stroke="#7c3aed" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Сделки: выиграно / проиграно / в работе">
        {baseManagerData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={baseManagerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="dealsWon" stackId="deals" fill="#058527" />
              <Bar dataKey="dealsLost" stackId="deals" fill="#c93c37" />
              <Bar dataKey="dealsInProgress" stackId="deals" fill="#f4a62a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Лиды: успешные / проигранные / в работе">
        {baseManagerData.length ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={baseManagerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="manager" interval={0} angle={-10} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="leadsSuccessful" stackId="leads" fill="#058527" />
              <Bar dataKey="leadsLost" stackId="leads" fill="#c93c37" />
              <Bar dataKey="leadsInProgress" stackId="leads" fill="#f4a62a" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Динамика звонков по дням">
        {callsTrend.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={callsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="calls" stroke="#1f6feb" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <ChartCard title="Динамика созданных сделок и лидов">
        {createdTrend.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={createdTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="deals" stroke="#1f6feb" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="leads" stroke="#f4a62a" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>
    </div>
  );
}
