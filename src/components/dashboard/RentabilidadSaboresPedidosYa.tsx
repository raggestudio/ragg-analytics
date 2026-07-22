import type {
  ResumenCostosSaboresPedidosYa,
} from "../../services/pedidosYaRentabilidadService";

type Props = {
  resumen: ResumenCostosSaboresPedidosYa | null;
};

function colorNivel(nivel: string) {
  switch (nivel) {
    case "muy_bajo":
      return "#22c55e";
    case "medio":
      return "#eab308";
    case "alto":
      return "#f97316";
    case "muy_alto":
      return "#ef4444";
    default:
      return "#64748b";
  }
}

function textoNivel(nivel: string) {
  switch (nivel) {
    case "muy_bajo":
      return "Muy bajo";
    case "medio":
      return "Medio";
    case "alto":
      return "Alto";
    case "muy_alto":
      return "Muy alto";
    default:
      return "Sin costo";
  }
}

export function RentabilidadSaboresPedidosYa({ resumen }: Props) {
  if (!resumen || resumen.sabores.length === 0) return null;

  return (
    <section style={card}>
      <h3>💰 Costos estimados de sabores (PedidosYa)</h3>

      <div style={metricas}>
        <div style={tarjeta}>
          <strong>Costo promedio</strong>
          <span>
            ${resumen.costo_promedio_kg.toFixed(0)}/kg
          </span>
        </div>

        <div style={tarjeta}>
          <strong>Más barato</strong>
          <span>
            {resumen.sabor_mas_barato?.sabor ?? "-"}
          </span>
        </div>

        <div style={tarjeta}>
          <strong>Más caro</strong>
          <span>
            {resumen.sabor_mas_caro?.sabor ?? "-"}
          </span>
        </div>

        <div style={tarjeta}>
          <strong>Vinculados</strong>
          <span>
            {resumen.sabores_vinculados} / {resumen.sabores_totales}
          </span>
        </div>
      </div>

      <div style={header}>
        <strong>Sabor</strong>
        <strong>Selecciones</strong>
        <strong>Costo/kg</strong>
        <strong>Nivel</strong>
      </div>

      {resumen.sabores.map((item) => (
        <div
          key={item.sabor_normalizado}
          style={fila}
        >
          <span>{item.sabor}</span>

          <span>{item.selecciones}</span>

          <span>
            {item.costo_kg === null
              ? "-"
              : `$${item.costo_kg.toFixed(0)}`}
          </span>

          <span
            style={{
              color: colorNivel(item.nivel),
              fontWeight: 700,
            }}
          >
            {textoNivel(item.nivel)}
          </span>
        </div>
      ))}
    </section>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  borderRadius: 16,
  marginTop: 20,
};

const metricas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 16,
  marginBottom: 20,
};

const tarjeta: React.CSSProperties = {
  background: "#0f172a",
  borderRadius: 12,
  padding: 16,
  display: "grid",
  gap: 6,
};

const header: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr",
  gap: 12,
  padding: "10px 0",
  borderBottom: "2px solid #475569",
};

const fila: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #334155",
};