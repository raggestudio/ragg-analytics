import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerCostosManualesPorEmpresa, type CostoProductoManual } from "../../services/costosManualService";
import { guardarConfiguracionBerlin, obtenerConfiguracionBerlin, type BerlinProductoConfig } from "../../services/berlinService";
import { normalizarProductoBerlin } from "../../services/berlinExcelParsers";

const CATEGORIAS = ["HAMBURGUESAS", "OTRAS COMIDAS", "CERVEZAS", "TRAGOS", "BEBIDAS", "POSTRES", "CAFETERIA"];

export default function VinculacionesBerlin({ empresaId }: { empresaId: string }) {
  const [productos, setProductos] = useState<any[]>([]);
  const [costos, setCostos] = useState<CostoProductoManual[]>([]);
  const [config, setConfig] = useState<BerlinProductoConfig[]>([]);
  const [buscar, setBuscar] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [{ data, error }, costosData, configData] = await Promise.all([
      supabase.from("berlin_ventas").select("nombre_normalizado,nombre_producto").eq("empresa_id", empresaId),
      obtenerCostosManualesPorEmpresa(empresaId), obtenerConfiguracionBerlin(empresaId),
    ]);
    if (error) throw error;
    const map = new Map<string, any>();
    for (const p of data || []) map.set(p.nombre_normalizado, p);
    setProductos([...map.values()]); setCostos(costosData); setConfig(configData);
  }
  useEffect(() => { cargar().catch((e) => setMensaje(e.message)); }, [empresaId]);
  const configMap = useMemo(() => new Map(config.map((c) => [c.nombre_normalizado, c])), [config]);
  const costoExactoMap = useMemo(() => new Map(
    costos.map((costo) => [normalizarProductoBerlin(costo.nombre_producto), costo])
  ), [costos]);
  const visibles = productos.filter((p) => !buscar || p.nombre_producto.toLowerCase().includes(buscar.toLowerCase()));

  async function guardar(producto: any, categoria: string, costoId: string) {
    await guardarConfiguracionBerlin({ empresa_id: empresaId, nombre_normalizado: producto.nombre_normalizado,
      nombre_producto: producto.nombre_producto, categoria: categoria || null, costo_manual_id: costoId || null });
    setMensaje(`${producto.nombre_producto} actualizado.`); await cargar();
  }

  return <div><h2>Vinculaciones · Berlín</h2>
    <section style={card}><div style={summary}>
      <strong>Productos detectados: {productos.length}</strong>
      <strong>Sin categoría: {productos.filter((p) => !configMap.get(p.nombre_normalizado)?.categoria).length}</strong>
      <strong>Sin costo identificado: {productos.filter((p) =>
        !configMap.get(p.nombre_normalizado)?.costo_manual_id && !costoExactoMap.has(p.nombre_normalizado)
      ).length}</strong>
    </div><input style={input} placeholder="Buscar producto..." value={buscar} onChange={(e) => setBuscar(e.target.value)} />
    {mensaje && <p>{mensaje}</p>}</section>
    <section style={card}>{visibles.map((p) => {
      const cfg = configMap.get(p.nombre_normalizado);
      const costoExacto = costoExactoMap.get(p.nombre_normalizado);
      let categoria = cfg?.categoria || ""; let costoId = cfg?.costo_manual_id || costoExacto?.id || "";
      return <div key={p.nombre_normalizado} style={row}>
        <strong>{p.nombre_producto}</strong>
        <select defaultValue={categoria} onChange={(e) => { categoria = e.target.value; }} style={input}>
          <option value="">Seleccionar categoría</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select defaultValue={costoId} onChange={(e) => { costoId = e.target.value; }} style={input}>
          <option value="">Seleccionar costo</option>{costos.map((c) => <option key={c.id} value={c.id}>{c.nombre_producto} · ${Number(c.costo).toFixed(2)}</option>)}
        </select>
        <button style={button} onClick={() => guardar(p, categoria, costoId)}>Guardar</button>
      </div>;
    })}</section>
  </div>;
}
const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 20, borderRadius: 16 };
const summary: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1.5fr 1fr 2fr auto", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #334155" };
const input: React.CSSProperties = { width: "100%", padding: 10, borderRadius: 8 };
const button: React.CSSProperties = { padding: "10px 16px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 700 };
