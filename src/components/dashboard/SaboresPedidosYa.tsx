import type { SaborPedidosYa } from "../../services/pedidosYaSaboresService";

type Props = {
  sabores: SaborPedidosYa[];
};

export function SaboresPedidosYa({ sabores }: Props) {
  if (sabores.length === 0) return null;

  const top10 = sabores.slice(0, 10);

  const menosVendidos = [...sabores]
    .filter((x) => x.cantidad > 0)
    .sort((a, b) => a.cantidad - b.cantidad)
    .slice(0, 5);

  const lider = top10[0];

  return (
    <section style={card}>
      <h3>🍨 Sabores PedidosYa</h3>

      <div style={metricas}>
        <div style={tarjeta}>
          <strong>Sabor líder</strong>
          <span>{lider.sabor}</span>
        </div>

        <div style={tarjeta}>
          <strong>Selecciones</strong>
          <span>{lider.cantidad}</span>
        </div>

        <div style={tarjeta}>
          <strong>Sabores distintos</strong>
          <span>{sabores.length}</span>
        </div>
      </div>

      <h4>Top 10</h4>

      {top10.map((item) => (
        <div key={item.sabor_normalizado} style={fila}>
          <span>{item.ranking}. {item.sabor}</span>

          <span>
            {item.cantidad} · {item.participacion.toFixed(1)}%
          </span>
        </div>
      ))}

      <h4 style={{ marginTop: 24 }}>Menos elegidos</h4>

      {menosVendidos.map((item) => (
        <div key={item.sabor_normalizado} style={fila}>
          <span>{item.sabor}</span>

          <span>{item.cantidad}</span>
        </div>
      ))}
    </section>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: 16,
  padding: 24,
  marginTop: 20,
};

const metricas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 16,
  marginBottom: 24,
};

const tarjeta: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 12,
  display: "grid",
  gap: 6,
};

const fila: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid #334155",
};