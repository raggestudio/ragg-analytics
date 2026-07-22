type MetricCardProps = {
  title: string;
  value: string | number;
};

export function MetricCard({ title, value }: MetricCardProps) {
  return (
    <div style={metricCard}>
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}

const metricCard: React.CSSProperties = {
  background: "#0f172a",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #334155",
  display: "grid",
  gap: "8px",
};