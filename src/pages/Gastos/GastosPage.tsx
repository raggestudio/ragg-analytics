import { useEffect, useMemo, useState } from "react";
import {
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  obtenerGastosPorPeriodo,
} from "../../services/gastosService";
import { obtenerPeriodosPorEmpresa } from "../../services/periodoService";
import type { GastoEmpresa } from "../../types/gasto";
import type { Periodo } from "../../types/periodo";

const BERLIN_ID = "5b66d548-cf91-4262-8e65-2cfd70e9a148";

const CATEGORIAS = [
  "Alquiler",
  "Luz",
  "Agua",
  "Productos de limpieza",
  "DGI",
  "BPS",
  "Wifi",
  "Gas",
  "Marketing",
  "Aceite",
  "Contabilidad/admin",
  "Nafta",
  "Comisión tarjetas",
  "Servicio de facturación",
  "Salarios y jornales",
  "Gastos extras",
  "Otros gastos",
] as const;

type Formulario = {
  categoria: string;
  detalle: string;
  monto: string;
  fecha: string;
  observaciones: string;
};

const FORMULARIO_VACIO: Formulario = {
  categoria: "Alquiler",
  detalle: "",
  monto: "",
  fecha: "",
  observaciones: "",
};

function moneda(valor: number) {
  return valor.toLocaleString("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 2,
  });
}

function convertirImporte(valor: string) {
  let texto = valor.trim().replace(/\s/g, "").replace(/\$/g, "");
  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }
  return Number(texto);
}

function periodoPredeterminado(periodos: Periodo[]) {
  const hoy = new Date();
  const actual = periodos.find(
    (periodo) => periodo.anio === hoy.getFullYear() && periodo.mes === hoy.getMonth() + 1
  );
  if (actual) return actual.id;

  return [...periodos].sort(
    (a, b) => b.anio - a.anio || b.mes - a.mes
  )[0]?.id || "";
}

export function GastosPage() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [gastos, setGastos] = useState<GastoEmpresa[]>([]);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerPeriodosPorEmpresa(BERLIN_ID)
      .then((data) => {
        const ordenados = [...data].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
        setPeriodos(ordenados);
        setPeriodoId(periodoPredeterminado(ordenados));
      })
      .catch((error) => setMensaje(error?.message || "No se pudieron cargar los períodos."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!periodoId) {
      setGastos([]);
      return;
    }
    setCargando(true);
    obtenerGastosPorPeriodo({ empresa_id: BERLIN_ID, periodo_id: periodoId })
      .then(setGastos)
      .catch((error) => setMensaje(error?.message || "No se pudieron cargar los gastos."))
      .finally(() => setCargando(false));
  }, [periodoId]);

  const total = useMemo(
    () => gastos.reduce((suma, gasto) => suma + gasto.monto, 0),
    [gastos]
  );

  const porCategoria = useMemo(() => {
    const totales = new Map<string, number>();
    for (const gasto of gastos) {
      totales.set(gasto.categoria, (totales.get(gasto.categoria) || 0) + gasto.monto);
    }
    return Array.from(totales.entries()).sort((a, b) => b[1] - a[1]);
  }, [gastos]);

  function cambiar(campo: keyof Formulario, valor: string) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function guardar() {
    if (!periodoId) return setMensaje("Seleccioná un período.");

    try {
      setMensaje("Guardando...");
      const input = {
        empresa_id: BERLIN_ID,
        periodo_id: periodoId,
        categoria: formulario.categoria,
        detalle: formulario.detalle,
        monto: convertirImporte(formulario.monto),
        fecha: formulario.fecha || null,
        observaciones: formulario.observaciones,
      };

      if (editandoId) await actualizarGasto(editandoId, input);
      else await crearGasto(input);

      setFormulario(FORMULARIO_VACIO);
      setEditandoId(null);
      setGastos(await obtenerGastosPorPeriodo({ empresa_id: BERLIN_ID, periodo_id: periodoId }));
      setMensaje(editandoId ? "Gasto actualizado." : "Gasto registrado.");
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo guardar el gasto.");
    }
  }

  function editar(gasto: GastoEmpresa) {
    setEditandoId(gasto.id);
    setFormulario({
      categoria: gasto.categoria,
      detalle: gasto.detalle || "",
      monto: String(gasto.monto),
      fecha: gasto.fecha || "",
      observaciones: gasto.observaciones || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function borrar(gasto: GastoEmpresa) {
    if (!window.confirm(`¿Eliminar ${gasto.categoria} por ${moneda(gasto.monto)}?`)) return;
    try {
      await eliminarGasto(gasto.id, BERLIN_ID);
      setGastos((actuales) => actuales.filter((item) => item.id !== gasto.id));
      setMensaje("Gasto eliminado.");
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo eliminar el gasto.");
    }
  }

  return (
    <div>
      <h2>Gastos · Berlín</h2>

      <section style={card}>
        <h3>Período</h3>
        <select style={input} value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
          {periodos.map((periodo) => (
            <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
          ))}
        </select>
      </section>

      <section style={card}>
        <h3>{editandoId ? "Editar gasto" : "Registrar gasto"}</h3>
        <div style={formGrid}>
          <label style={label}>Categoría
            <select style={input} value={formulario.categoria} onChange={(e) => cambiar("categoria", e.target.value)}>
              {CATEGORIAS.map((categoria) => <option key={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label style={label}>Importe
            <input style={input} inputMode="decimal" placeholder="0" value={formulario.monto}
              onChange={(e) => cambiar("monto", e.target.value)} />
          </label>
          <label style={label}>Fecha (opcional)
            <input style={input} type="date" value={formulario.fecha}
              onChange={(e) => cambiar("fecha", e.target.value)} />
          </label>
          <label style={label}>Detalle
            <input style={input} placeholder="Ej.: factura de UTE" value={formulario.detalle}
              onChange={(e) => cambiar("detalle", e.target.value)} />
          </label>
          <label style={{ ...label, gridColumn: "1 / -1" }}>Observaciones
            <textarea style={{ ...input, minHeight: 70 }} value={formulario.observaciones}
              onChange={(e) => cambiar("observaciones", e.target.value)} />
          </label>
        </div>
        <div style={actions}>
          <button style={primaryButton} type="button" onClick={() => void guardar()}>
            {editandoId ? "Guardar cambios" : "Agregar gasto"}
          </button>
          {editandoId && <button style={secondaryButton} type="button" onClick={() => {
            setEditandoId(null);
            setFormulario(FORMULARIO_VACIO);
          }}>Cancelar</button>}
        </div>
        {mensaje && <p>{mensaje}</p>}
      </section>

      <section style={card}>
        <h3>Resumen mensual</h3>
        <div style={metrics}>
          <div style={metric}><strong>Total de gastos</strong><span>{moneda(total)}</span></div>
          <div style={metric}><strong>Movimientos</strong><span>{gastos.length}</span></div>
          <div style={metric}><strong>Categorías utilizadas</strong><span>{porCategoria.length}</span></div>
        </div>
        {porCategoria.length > 0 && <div style={categoryGrid}>
          {porCategoria.map(([categoria, monto]) => (
            <div key={categoria} style={categoryRow}><span>{categoria}</span><strong>{moneda(monto)}</strong></div>
          ))}
        </div>}
      </section>

      <section style={card}>
        <h3>Detalle de gastos</h3>
        {cargando ? <p>Cargando...</p> : gastos.length === 0 ? <p>No hay gastos registrados en este período.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead><tr><th>Categoría</th><th>Detalle</th><th>Fecha</th><th>Importe</th><th>Observaciones</th><th>Acciones</th></tr></thead>
              <tbody>{gastos.map((gasto) => (
                <tr key={gasto.id}>
                  <td>{gasto.categoria}</td><td>{gasto.detalle || "-"}</td><td>{gasto.fecha || "-"}</td>
                  <td>{moneda(gasto.monto)}</td><td>{gasto.observaciones || "-"}</td>
                  <td><div style={actions}><button style={smallButton} onClick={() => editar(gasto)}>Editar</button>
                    <button style={dangerButton} onClick={() => void borrar(gasto)}>Eliminar</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 20, borderRadius: 16 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 8, border: "1px solid #64748b" };
const formGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 7, fontWeight: 600 };
const actions: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 };
const primaryButton: React.CSSProperties = { padding: "10px 16px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" };
const secondaryButton: React.CSSProperties = { ...primaryButton, background: "#475569" };
const smallButton: React.CSSProperties = { ...primaryButton, padding: "7px 10px" };
const dangerButton: React.CSSProperties = { ...smallButton, background: "#be123c" };
const metrics: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 };
const metric: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, padding: 18, borderRadius: 12, background: "#0f172a", textAlign: "center", fontSize: 18 };
const categoryGrid: React.CSSProperties = { marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 };
const categoryRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: 12, borderBottom: "1px solid #475569" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 850 };
