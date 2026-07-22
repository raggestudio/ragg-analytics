import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { obtenerRecetasPorEmpresa } from "../../services/costosService";
import {
  guardarReglaCosto,
  obtenerReglasCosto,
} from "../../services/productoCostoService";
import {
  guardarVinculacion,
  obtenerVinculaciones,
} from "../../services/productoRecetaService";
import type { TipoCalculoCosto } from "../../types/productoCosto";

type Props = { empresaId: string };

type ProductoIsatech = {
  nombre_producto: string;
  categoria: string | null;
  ventas: number;
  cantidad: number;
};

type Edicion = {
  tipo_calculo: TipoCalculoCosto;
  receta_id: string;
  factor: string;
  observaciones: string;
};

function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VinculacionesHeladeria({ empresaId }: Props) {
  const [productos, setProductos] = useState<ProductoIsatech[]>([]);
  const [recetas, setRecetas] = useState<any[]>([]);
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});
  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, [empresaId]);

  async function cargarDatos() {
    setCargando(true);
    setMensaje("");

    try {
      const [ventasResultado, recetasData, reglas, vinculaciones] =
        await Promise.all([
          supabase
            .from("producto_ventas_resumen")
            .select("nombre_producto, categoria, cantidad, total")
            .eq("empresa_id", empresaId)
            .eq("fuente", "Isatech"),
          obtenerRecetasPorEmpresa(empresaId),
          obtenerReglasCosto(empresaId),
          obtenerVinculaciones(empresaId),
        ]);

      if (ventasResultado.error) throw ventasResultado.error;

      const agrupados = new Map<string, ProductoIsatech>();
      for (const fila of ventasResultado.data || []) {
        const clave = normalizar(fila.nombre_producto);
        const actual = agrupados.get(clave);
        if (actual) {
          actual.ventas += Number(fila.total || 0);
          actual.cantidad += Number(fila.cantidad || 0);
        } else {
          agrupados.set(clave, {
            nombre_producto: fila.nombre_producto,
            categoria: fila.categoria || null,
            ventas: Number(fila.total || 0),
            cantidad: Number(fila.cantidad || 0),
          });
        }
      }

      const reglaPorNombre = new Map(
        reglas.map((regla) => [normalizar(regla.nombre_producto), regla])
      );
      const vinculacionPorNombre = new Map(
        vinculaciones.map((item) => [normalizar(item.nombre_producto), item])
      );
      const iniciales: Record<string, Edicion> = {};

      for (const producto of agrupados.values()) {
        const clave = normalizar(producto.nombre_producto);
        const regla = reglaPorNombre.get(clave);
        const vinculacion = vinculacionPorNombre.get(clave);
        const recetaId = regla?.receta_id || vinculacion?.receta_id || "";

        iniciales[clave] = {
          tipo_calculo: regla?.tipo_calculo || (recetaId ? "receta" : "estimado"),
          receta_id: recetaId,
          factor: regla?.factor == null ? "1" : String(regla.factor),
          observaciones: regla?.observaciones || "",
        };
      }

      setProductos(
        Array.from(agrupados.values()).sort((a, b) => b.ventas - a.ventas)
      );
      setRecetas(recetasData);
      setEdiciones(iniciales);
    } catch (error: any) {
      setMensaje(error?.message || "No se pudieron cargar las vinculaciones.");
    } finally {
      setCargando(false);
    }
  }

  function estaCompleto(producto: ProductoIsatech) {
    const edicion = ediciones[normalizar(producto.nombre_producto)];
    if (!edicion) return false;
    if (edicion.tipo_calculo === "receta") return Boolean(edicion.receta_id);
    return (
      edicion.tipo_calculo === "promedio" ||
      edicion.tipo_calculo === "estimado"
    );
  }

  const productosFiltrados = useMemo(() => {
    const texto = normalizar(busqueda);
    return productos.filter((producto) => {
      const coincide = normalizar(producto.nombre_producto).includes(texto);
      return coincide && (!soloPendientes || !estaCompleto(producto));
    });
  }, [productos, busqueda, soloPendientes, ediciones]);

  const pendientes = productos.filter((producto) => !estaCompleto(producto)).length;

  function actualizar(clave: string, cambios: Partial<Edicion>) {
    setEdiciones((actual) => ({
      ...actual,
      [clave]: { ...actual[clave], ...cambios },
    }));
  }

  async function guardar(producto: ProductoIsatech) {
    const clave = normalizar(producto.nombre_producto);
    const edicion = ediciones[clave];
    if (!edicion) return;
    if (edicion.tipo_calculo === "receta" && !edicion.receta_id) {
      return alert("Seleccioná una receta.");
    }

    try {
      setGuardando(clave);
      const recetaId = edicion.tipo_calculo === "receta" ? edicion.receta_id : null;

      await guardarReglaCosto({
        empresa_id: empresaId,
        nombre_producto: producto.nombre_producto,
        tipo_calculo: edicion.tipo_calculo,
        receta_id: recetaId,
        factor: Number(edicion.factor || 1),
        observaciones: edicion.observaciones || null,
      });

      await guardarVinculacion(
        empresaId,
        producto.nombre_producto,
        producto.categoria,
        recetaId
      );

      setMensaje(`Vinculación guardada: ${producto.nombre_producto}.`);
      await cargarDatos();
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo guardar la vinculación.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div>
      <h2>Vinculaciones - Heladería</h2>

      <section style={card}>
        <div style={metricGrid}>
          <Metric titulo="Productos Isatech" valor={productos.length} />
          <Metric titulo="Pendientes" valor={pendientes} />
          <Metric titulo="Recetas disponibles" valor={recetas.length} />
        </div>
        {mensaje && <p>{mensaje}</p>}
      </section>

      <section style={card}>
        <input
          style={input}
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />{" "}
          Mostrar solamente pendientes
        </label>
      </section>

      <section style={card}>
        {cargando ? (
          <p>Cargando...</p>
        ) : productosFiltrados.length === 0 ? (
          <p>No hay productos pendientes.</p>
        ) : (
          productosFiltrados.map((producto) => {
            const clave = normalizar(producto.nombre_producto);
            const edicion = ediciones[clave];
            if (!edicion) return null;

            return (
              <div key={clave} style={fila}>
                <div>
                  <strong>{producto.nombre_producto}</strong>
                  <small style={detalle}>
                    {Math.round(producto.cantidad).toLocaleString("es-UY")} unidades ·
                    ${Math.round(producto.ventas).toLocaleString("es-UY")}
                  </small>
                </div>

                <select
                  style={control}
                  value={edicion.tipo_calculo}
                  onChange={(e) =>
                    actualizar(clave, {
                      tipo_calculo: e.target.value as TipoCalculoCosto,
                    })
                  }
                >
                  <option value="receta">Receta específica</option>
                  <option value="promedio">Costo promedio de producción</option>
                  <option value="estimado">
                    Costo informado por Isatech (predeterminado)
                  </option>
                </select>

                {edicion.tipo_calculo === "receta" ? (
                  <select
                    style={control}
                    value={edicion.receta_id}
                    onChange={(e) => actualizar(clave, { receta_id: e.target.value })}
                  >
                    <option value="">Seleccionar receta</option>
                    {recetas.map((receta) => (
                      <option key={receta.id} value={receta.id}>
                        {receta.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={ayuda}>
                    {edicion.tipo_calculo === "promedio"
                      ? "Usa el costo promedio por kg producido."
                      : "Usa el costo calculado por Isatech: venta menos ganancia."}
                  </span>
                )}

                <input
                  style={control}
                  type="number"
                  step="0.01"
                  value={edicion.factor}
                  onChange={(e) => actualizar(clave, { factor: e.target.value })}
                  title="Factor aplicado al costo"
                />

                <button
                  style={button}
                  disabled={guardando === clave}
                  onClick={() => guardar(producto)}
                >
                  {guardando === clave ? "Guardando..." : "Guardar"}
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function Metric({ titulo, valor }: { titulo: string; valor: number }) {
  return <div style={metric}><strong>{titulo}</strong><span>{valor}</span></div>;
}

const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 20, borderRadius: 16 };
const metricGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 };
const metric: React.CSSProperties = { background: "#0f172a", padding: 16, borderRadius: 12, display: "grid", gap: 8 };
const input: React.CSSProperties = { width: "100%", maxWidth: 520, padding: 12, borderRadius: 8, marginBottom: 14 };
const fila: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1.3fr 2fr 90px 100px", gap: 12, alignItems: "center", padding: "14px 0", borderBottom: "1px solid #334155" };
const control: React.CSSProperties = { padding: 10, borderRadius: 7, minWidth: 0 };
const detalle: React.CSSProperties = { display: "block", marginTop: 5, color: "#cbd5e1" };
const ayuda: React.CSSProperties = { color: "#cbd5e1", fontSize: 13 };
const button: React.CSSProperties = { padding: 10, borderRadius: 8, cursor: "pointer", background: "#2563eb", color: "white", border: 0 };