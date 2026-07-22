import type { DashboardInsights } from "../../services/dashboardInsights";

type Props = {
  insights: DashboardInsights;
};

export default function ExecutiveSummary({ insights }: Props) {
  return (
    <section style={cardStyle}>
      <h2 style={titleStyle}>📊 Resumen Ejecutivo</h2>

      <div style={sectionStyle}>
        <div>
          <div style={groupTitle}>🟢 Puntos positivos</div>

          {insights.positivas.length > 0 ? (
            <ul style={listStyle}>
              {insights.positivas.map((item, index) => (
                <li key={`positiva-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p style={emptyText}>No se detectaron puntos positivos destacados.</p>
          )}
        </div>

        <div>
          <div style={groupTitle}>🟡 Puntos de atención</div>

          {insights.atencion.length > 0 ? (
            <ul style={listStyle}>
              {insights.atencion.map((item, index) => (
                <li key={`atencion-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p style={emptyText}>No se detectaron alertas importantes.</p>
          )}
        </div>

        <div>
          <div style={groupTitle}>🔴 Acciones sugeridas</div>

          <ul style={listStyle}>
            {insights.acciones.map((item, index) => (
              <li key={`accion-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 16,
  padding: 24,
  marginTop: 24,
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 22px",
  fontSize: 22,
  textAlign: "center",
};

const sectionStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 18,
};

const groupTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  marginBottom: 12,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: "grid",
  gap: 10,
  lineHeight: 1.5,
};

const emptyText: React.CSSProperties = {
  margin: 0,
  color: "#cbd5e1",
  lineHeight: 1.5,
};