import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerCostosManualesPorEmpresa, type CostoProductoManual } from "../../services/costosManualService";
import { guardarConfiguracionBerlin, obtenerConfiguracionBerlin, type BerlinProductoConfig } from "../../services/berlinService";
import { normalizarProductoBerlin } from "../../services/berlinExcelParsers";

const CATEGORIAS = ["HAMBURGUESAS", "OTRAS COMIDAS", "CERVEZAS", "TRAGOS", "BEBIDAS", "POSTRES", "CAFETERIA"];

function similitud(a: string, b: string) {
  const izquierda = normalizarProductoBerlin(a);
  const derecha = normalizarProductoBerlin(b);
  if (izquierda === derecha) return 1;
  const palabrasA = new Set(izquierda.split(" ").filter((p) => p.length > 1));
  const palabrasB = new Set(derecha.split(" ").filter((p) => p.length > 1));
  const comunes = [...palabrasA].filter((p) => palabrasB.has(p)).length;
  const palabras = Math.max(palabrasA.size, palabrasB.size, 1);
  const porPalabras = comunes / palabras;
  const contiene = izquierda.includes(derecha) || derecha.includes(izquierda) ? 0.82 : 0;
  return Math.max(porPalabras, contiene);
}

export default function VinculacionesBerlin({ empresaId }: { empresaId: string }) {
  const [productos, setProductos] = useState<any[]>([]);
  const [costos, setCostos] = useState<CostoProductoManual[]>([]);
  const [config, setConfig] = useState<BerlinProductoConfig[]>([]);
  const [buscar, setBuscar] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    const [{ data, error }, costosData, configData] = await Promise.all([
      supabase.from("berlin_ventas").select("nombre_normalizado,nombre_producto").eq("empresa_id", empresaId),
      obtenerCostosManualesPorEmpresa(empresaId),
      obtenerConfiguracionBerlin(empresaId),
    ]);
    if (error) throw error;
    const map = new Map<string, any>();
    for (const producto of data || []) map.set(producto.nombre_normalizado, producto);
    setProductos([...map.values()]);
    setCostos(costosData);
    setConfig(configData);
  }

  useEffect(() => { cargar().catch((error) => setMensaje(error.message)); }, [empresaId]);

  const configMap = useMemo(() => new Map(config.map((item) => [item.nombre_normalizado, item])), [config]);
  const costoExactoMap = useMemo(() => new Map(
    costos.map((costo) => [normalizarProductoBerlin(costo.nombre_producto), costo])
  ), [costos]);

  const pendientes = productos.filter((producto) => {
    const configuracion = configMap.get(producto.nombre_normalizado);
    return !configuracion?.categoria || !configuracion?.costo_manual_id;
  });
  const visibles = pendientes.filter((producto) => !buscar ||
    producto.nombre_producto.toLowerCase().includes(buscar.toLowerCase()));

  async function guardar(producto: any, categoria: string, costoId: string) {
    if (!categoria || !costoId) {
      setMensaje("Seleccioná la categoría y el costo antes de guardar.");
      return;
    }
    await guardarConfiguracionBerlin({
      empresa_id: empresaId,
      nombre_normalizado: producto.nombre_normalizado,
      nombre_producto: producto.nombre_producto,
      categoria,
      costo_manual_id: costoId,
    });
    setMensaje(`${producto.nombre_producto} vinculado correctamente.`);
    await cargar();
  }

  return <div>
    <h2>Vinculaciones · Berlín</h2>
    <section style={card}>
      <div style={summary}>
        <strong>Productos detectados: {productos.length}</strong>
        <strong>Pendientes: {pendientes.length}</strong>
        <strong>Sin categoría: {productos.filter((p) => !configMap.get(p.nombre_normalizado)?.categoria).length}</strong>
        <strong>Sin costo identificado: {productos.filter((p) =>
          !configMap.get(p.nombre_normalizado)?.costo_manual_id && !costoExactoMap.has(p.nombre_normalizado)
        ).length}</strong>
      </div>
      <input style={input} placeholder="Buscar producto pendiente..." value={buscar}
        onChange={(event) => setBuscar(event.target.value)} />
      {mensaje && <p>{mensaje}</p>}
    </section>

    <section style={card}>
      {visibles.length === 0 ? <p>No quedan productos pendientes con este filtro.</p> : visibles.map((producto) =>
        <ProductoPendiente key={producto.nombre_normalizado} producto={producto} costos={costos}
          configuracion={configMap.get(producto.nombre_normalizado)}
          costoExacto={costoExactoMap.get(producto.nombre_normalizado)} onGuardar={guardar} />
      )}
    </section>
  </div>;
}

function ProductoPendiente({ producto, costos, configuracion, costoExacto, onGuardar }: {
  producto: any;
  costos: CostoProductoManual[];
  configuracion?: BerlinProductoConfig;
  costoExacto?: CostoProductoManual;
  onGuardar: (producto: any, categoria: string, costoId: string) => Promise<void>;
}) {
  const sugerencia = useMemo(() => {
    if (costoExacto) return { costo: costoExacto, puntaje: 1 };
    return costos.map((costo) => ({ costo, puntaje: similitud(producto.nombre_producto, costo.nombre_producto) }))
      .sort((a, b) => b.puntaje - a.puntaje)[0];
  }, [producto.nombre_producto, costos, costoExacto]);

  const sugerenciaUtil = sugerencia && sugerencia.puntaje >= 0.45 ? sugerencia : undefined;
  const [categoria, setCategoria] = useState(configuracion?.categoria || "");
  const [costoId, setCostoId] = useState(configuracion?.costo_manual_id || costoExacto?.id || "");
  const [busquedaCosto, setBusquedaCosto] = useState("");
  const resultados = busquedaCosto.trim() ? costos.filter((costo) =>
    normalizarProductoBerlin(costo.nombre_producto).includes(normalizarProductoBerlin(busquedaCosto))
  ).slice(0, 8) : [];
  const costoSeleccionado = costos.find((costo) => costo.id === costoId);

  return <div style={productCard}>
    <h3 style={{ marginTop: 0 }}>{producto.nombre_producto}</h3>
    <label>Categoría</label>
    <select value={categoria} onChange={(event) => setCategoria(event.target.value)} style={input}>
      <option value="">Seleccionar categoría</option>
      {CATEGORIAS.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>

    {sugerenciaUtil && !costoSeleccionado && <button type="button" style={suggestion}
      onClick={() => setCostoId(sugerenciaUtil.costo.id)}>
      <strong>✓ Sugerencia automática: {sugerenciaUtil.costo.nombre_producto}</strong>
      <span>Costo unitario: ${Number(sugerenciaUtil.costo.costo).toLocaleString("es-UY", { maximumFractionDigits: 2 })}</span>
      <span>Coincidencia: {Math.round(sugerenciaUtil.puntaje * 100)}%</span>
    </button>}

    <label>Buscar producto costeado</label>
    <input style={input} value={busquedaCosto} onChange={(event) => setBusquedaCosto(event.target.value)}
      placeholder="Escribí el nombre del producto..." />
    {resultados.map((costo) => <button type="button" key={costo.id}
      style={costo.id === costoId ? selectedResult : result}
      onClick={() => { setCostoId(costo.id); setBusquedaCosto(costo.nombre_producto); }}>
      <span>{costo.nombre_producto}</span>
      <strong>${Number(costo.costo).toLocaleString("es-UY", { maximumFractionDigits: 2 })}</strong>
    </button>)}

    {costoSeleccionado && <p><strong>Seleccionado:</strong> {costoSeleccionado.nombre_producto} ·
      ${Number(costoSeleccionado.costo).toLocaleString("es-UY", { maximumFractionDigits: 2 })}</p>}
    <button style={saveButton} onClick={() => onGuardar(producto, categoria, costoId)}>Guardar vinculación</button>
  </div>;
}

const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 20, borderRadius: 16 };
const summary: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 10, margin: "7px 0 12px", borderRadius: 8 };
const productCard: React.CSSProperties = { background: "#0f172a", padding: 20, marginBottom: 16, borderRadius: 14, border: "1px solid #334155" };
const suggestion: React.CSSProperties = { width: "100%", display: "flex", gap: 16, flexWrap: "wrap", padding: 14, margin: "10px 0", border: 0, borderRadius: 10, background: "#155e75", color: "white", cursor: "pointer", textAlign: "left" };
const result: React.CSSProperties = { width: "100%", display: "flex", justifyContent: "space-between", padding: 10, marginBottom: 6, borderRadius: 8, border: "1px solid #475569", background: "#1e293b", color: "white", cursor: "pointer" };
const selectedResult: React.CSSProperties = { ...result, background: "#166534", borderColor: "#22c55e" };
const saveButton: React.CSSProperties = { padding: "11px 18px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" };
