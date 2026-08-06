import { useEffect, useMemo, useState } from "react";
import { obtenerCostosManualesPorEmpresa } from "../../services/costosManualService";
import {
  obtenerConfiguracionBerlin,
  obtenerVentasBerlin,
  type BerlinProductoConfig,
} from "../../services/berlinService";
import { normalizarProductoBerlin } from "../../services/berlinExcelParsers";

type Vista = "total" | "salon" | "delivery" | "take_away";
type Props = { empresaId: string; periodoIds: string[]; sucursalId?: string | null };

const nombresVista: Record<Vista, string> = {
  total: "Total restaurante", salon: "Salón", delivery: "Delivery", take_away: "Take away",
};

function moneda(value: number) {
  return `$${Math.round(Number(value || 0)).toLocaleString("es-UY")}`;
}

export default function BerlinDashboard({ empresaId, periodoIds, sucursalId }: Props) {
  const [ventas, setVentas] = useState<any[]>([]);
  const [costos, setCostos] = useState<any[]>([]);
  const [config, setConfig] = useState<BerlinProductoConfig[]>([]);
  const [vista, setVista] = useState<Vista>("total");
  const [mensaje, setMensaje] = useState("Cargando análisis de Berlín...");

  useEffect(() => {
    let activo = true;
    Promise.all([
      obtenerVentasBerlin({ empresa_id: empresaId, periodo_ids: periodoIds, sucursal_id: sucursalId }),
      obtenerCostosManualesPorEmpresa(empresaId),
      obtenerConfiguracionBerlin(empresaId),
    ]).then(([ventasData, costosData, configData]) => {
      if (!activo) return;
      setVentas(ventasData); setCostos(costosData); setConfig(configData); setMensaje("");
    }).catch((error) => activo && setMensaje(error?.message || "No se pudo cargar Berlín."));
    return () => { activo = false; };
  }, [empresaId, periodoIds.join("|"), sucursalId]);

  const analisis = useMemo(() => {
    const costosId = new Map(costos.map((c) => [c.id, c]));
    const costosNombre = new Map(costos.map((c) => [normalizarProductoBerlin(c.nombre_producto), c]));
    const configNombre = new Map(config.map((c) => [c.nombre_normalizado, c]));
    const filtradas = vista === "total" ? ventas : ventas.filter((v) => v.modalidad === vista);
    const productos = new Map<string, any>();
    const tickets = new Set<string>();
    for (const venta of filtradas) {
      const key = venta.nombre_normalizado || normalizarProductoBerlin(venta.nombre_producto);
      const cfg = configNombre.get(key);
      const costo = (cfg?.costo_manual_id && costosId.get(cfg.costo_manual_id)) || costosNombre.get(key);
      const cantidad = Number(venta.cantidad || 0);
      const facturacion = Number(venta.venta_total || 0);
      const costoTotal = costo ? Number(costo.costo || 0) * cantidad : 0;
      tickets.add(`${venta.fuente}:${venta.documento}`);
      const current = productos.get(key) || {
        nombre: venta.nombre_producto, categoria: cfg?.categoria || "Sin categoría", unidades: 0,
        facturacion: 0, costo: 0, tieneCosto: Boolean(costo),
      };
      current.unidades += cantidad; current.facturacion += facturacion; current.costo += costoTotal;
      current.tieneCosto = current.tieneCosto && Boolean(costo);
      productos.set(key, current);
    }
    const lista = [...productos.values()].map((p) => ({
      ...p, ganancia: p.facturacion - p.costo,
      margen: p.facturacion > 0 ? ((p.facturacion - p.costo) / p.facturacion) * 100 : 0,
    }));
    const facturacion = lista.reduce((s, p) => s + p.facturacion, 0);
    const costo = lista.reduce((s, p) => s + p.costo, 0);
    const facturacionConCosto = lista.filter((p) => p.tieneCosto).reduce((s, p) => s + p.facturacion, 0);
    const unidades = lista.reduce((s, p) => s + p.unidades, 0);
    const categorias = new Map<string, any>();
    for (const p of lista) {
      const c = categorias.get(p.categoria) || { nombre: p.categoria, facturacion: 0, costo: 0, unidades: 0 };
      c.facturacion += p.facturacion; c.costo += p.costo; c.unidades += p.unidades; categorias.set(p.categoria, c);
    }
    return { lista, facturacion, costo, ganancia: facturacion - costo, unidades, tickets: tickets.size,
      margen: facturacion ? ((facturacion - costo) / facturacion) * 100 : 0,
      coberturaCosto: facturacion ? (facturacionConCosto / facturacion) * 100 : 0,
      sinCosto: lista.filter((p) => !p.tieneCosto).length,
      sinCategoria: lista.filter((p) => p.categoria === "Sin categoría").length,
      categorias: [...categorias.values()].map((c) => ({ ...c, ganancia: c.facturacion - c.costo,
        margen: c.facturacion ? ((c.facturacion - c.costo) / c.facturacion) * 100 : 0 })).sort((a, b) => b.facturacion - a.facturacion),
    };
  }, [ventas, costos, config, vista]);

  const topVendidos = [...analisis.lista].sort((a, b) => b.unidades - a.unidades).slice(0, 10);
  const topFacturacion = [...analisis.lista].sort((a, b) => b.facturacion - a.facturacion).slice(0, 10);
  const topMargen = [...analisis.lista].filter((p) => p.tieneCosto && p.facturacion > 0)
    .sort((a, b) => b.ganancia - a.ganancia).slice(0, 10);

  return <>
    <section style={card}>
      <h3>Análisis de Berlín</h3>
      <label style={{ display: "block", marginBottom: 6 }}>Modalidad</label>
      <select value={vista} onChange={(e) => setVista(e.target.value as Vista)} style={select}>
        {(Object.keys(nombresVista) as Vista[]).map((key) => <option key={key} value={key}>{nombresVista[key]}</option>)}
      </select>
      {mensaje && <p>{mensaje}</p>}
      <div style={metrics}>
        <Metric title="Facturación" value={moneda(analisis.facturacion)} />
        <Metric title="Costo de productos" value={moneda(analisis.costo)} />
        <Metric title="Ganancia" value={moneda(analisis.ganancia)} />
        <Metric title={analisis.sinCosto ? "Margen provisorio" : "Margen"} value={`${analisis.margen.toFixed(1)}%`} />
        <Metric title="Cobertura de costos" value={`${analisis.coberturaCosto.toFixed(1)}%`} />
        <Metric title="Tickets" value={analisis.tickets.toLocaleString("es-UY")} />
        <Metric title="Ticket promedio" value={moneda(analisis.tickets ? analisis.facturacion / analisis.tickets : 0)} />
        <Metric title="Unidades" value={analisis.unidades.toLocaleString("es-UY")} />
        <Metric title="Productos sin costo" value={analisis.sinCosto} />
        <Metric title="Productos sin categoría" value={analisis.sinCategoria} />
      </div>
      {analisis.sinCosto > 0 && <p style={{ color: "#fbbf24" }}>
        El margen es provisorio: faltan costos para {analisis.sinCosto} productos. Completalos en Vinculaciones.
      </p>}
    </section>

    <section style={card}><h3>Resultado por categoría · {nombresVista[vista]}</h3>
      <Table rows={analisis.categorias} category />
    </section>
    <section style={card}><h3>Rankings generales · {nombresVista[vista]}</h3>
      <div style={columns}>
        <Ranking title="Más vendidos" rows={topVendidos} value={(p) => `${p.unidades} u.`} />
        <Ranking title="Top facturación" rows={topFacturacion} value={(p) => moneda(p.facturacion)} />
        <Ranking title="Top ganancia" rows={topMargen} value={(p) => `${moneda(p.ganancia)} · ${p.margen.toFixed(1)}%`} />
      </div>
    </section>
  </>;
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return <div style={metric}><strong>{title}</strong><span>{value}</span></div>;
}
function Table({ rows }: { rows: any[]; category?: boolean }) {
  return <div>{rows.map((r) => <div key={r.nombre} style={row}>
    <strong>{r.nombre}</strong><span>{r.unidades.toLocaleString("es-UY")} u.</span>
    <span>{moneda(r.facturacion)}</span><span>{moneda(r.costo)}</span>
    <span>{moneda(r.ganancia)}</span><span>{r.margen.toFixed(1)}%</span>
  </div>)}</div>;
}
function Ranking({ title, rows, value }: { title: string; rows: any[]; value: (row: any) => string }) {
  return <div><h4>{title}</h4>{rows.map((r, i) => <div key={`${r.nombre}-${i}`} style={rankRow}>
    <span>{i + 1}. {r.nombre}</span><strong>{value(r)}</strong>
  </div>)}</div>;
}
const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 24, borderRadius: 16 };
const select: React.CSSProperties = { width: "100%", maxWidth: 420, padding: 12, borderRadius: 8 };
const metrics: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, marginTop: 18 };
const metric: React.CSSProperties = { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 16, display: "grid", gap: 8 };
const columns: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr repeat(5, 1fr)", gap: 12, padding: "10px 0", borderBottom: "1px solid #334155" };
const rankRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #334155" };
