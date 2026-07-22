import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { Venta } from "../services/ventaService";

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function VentasPorDiaChart({ ventas }: { ventas: Venta[] }) {
  const data = ventas.map((v) => ({
    fecha: formatearFecha(v.fecha),
    ventas: Number(v.ventas),
    pedidos: Number(v.pedidos),
  }));

  return (
    <div style={{ width: "100%", height: 320, marginTop: 24 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="fecha" />
          <YAxis />
          <Tooltip
            formatter={(value, name) => {
              if (name === "ventas") return [`$${Number(value).toLocaleString("es-UY")}`, "Ventas"];
              return [value, "Pedidos"];
            }}
          />
          <Line type="monotone" dataKey="ventas" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}