interface KpiCardProps {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "success";
}

export function KpiCard({ title, value, hint, tone = "default" }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-card--${tone}`}>
      <span className="kpi-title">{title}</span>
      <strong className="kpi-value">{value}</strong>
      {hint ? <span className="kpi-hint">{hint}</span> : null}
    </article>
  );
}
