import { useEffect, useMemo, useState } from "react";
import {
  actualizarGasto,
  crearGasto,
  eliminarGasto,
  obtenerGastosPorPeriodo,
  reemplazarSalariosDesdeCsv,
} from "../../services/gastosService";
import { leerCsvSueldos } from "../../services/sueldosGastosParser";
import { obtenerEmpresas } from "../../services/empresaService";
import { obtenerPeriodosPorEmpresa } from "../../services/periodoService";
import { obtenerSucursalesPorEmpresa } from "../../services/sucursalService";
import type { GastoEmpresa } from "../../types/gasto";
import type { Periodo } from "../../types/periodo";
import type { Empresa } from "../../types/empresa";
import type { Sucursal } from "../../types/sucursal";

const CATEGORIAS_GENERALES = [
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
  "Jornales extras",
  "Gastos extras",
  "Otros gastos",
] as const;

const CATEGORIAS_DUNA = [
  "Tarifa de saneamiento",
  "Entarimado",
  "Tributos domiciliarios",
  "Adicional Mercantil",
  "Inst Mec y Eléctricas",
  "Alquiler",
  "UTE",
  "OSE",
  "ANTEL fija",
  "ANTEL Móvil",
  "Seguros",
  "SEMM",
  "Residuos",
  "Exterminex",
  "ADT",
  "BPS",
  "DGI/IRAE IVA",
  "SUELDOS LIQ",
  "New age Data",
  "Comisión tarjetas",
  "Comisiones bancarias",
  "Leña",
  "Productos limpieza",
  "GAS",
  "CO2",
  "Bandas DJS/proyector",
  "Mantenimiento",
  "Contadores",
  "Marketing + Publicidad",
  "PedidosYa",
  "Otros Jornales",
  "Otros",
] as const;

const CATEGORIAS_PIU = [
  "Alquiler",
  "OSE",
  "UTE",
  "ANTEL",
  "Redes",
  "Empresa plagas",
  "Comisión tarjetas",
  "POS",
  "Tributos Dom.",
  "BPS",
  "DGI",
  "Contabilidad",
  "Saneamiento",
  "Papelería",
  "BSE",
  "Sueldos",
  "Aguinaldos",
  "Licencias",
  "Otros",
  "Alarma",
  "Recolección basura",
  "Isatech",
  "Seguro",
  "Flete helado",
] as const;

function categoriasParaEmpresa(empresa?: Empresa) {
  const nombre = String(empresa?.nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (nombre.includes("duna")) return CATEGORIAS_DUNA;
  if (nombre.includes("piu")) return CATEGORIAS_PIU;

  return CATEGORIAS_GENERALES;
}

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
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState("");
  const [gastos, setGastos] = useState<GastoEmpresa[]>([]);
  const [formulario, setFormulario] = useState<Formulario>(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const empresaActual = empresas.find((empresa) => empresa.id === empresaId);
  const categoriasDisponibles = categoriasParaEmpresa(empresaActual);

  useEffect(() => {
    obtenerEmpresas()
      .then((data) => {
        setEmpresas(data);
        const guardada = localStorage.getItem("gastos-empresa-seleccionada");
        const inicial = data.some((empresa) => empresa.id === guardada) ? guardada! : data[0]?.id || "";
        setEmpresaId(inicial);
      })
      .catch((error) => setMensaje(error?.message || "No se pudieron cargar las empresas."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!empresaId) return;
    localStorage.setItem("gastos-empresa-seleccionada", empresaId);
    setPeriodoId("");
    setSucursalId("");
    setGastos([]);
    setCargando(true);
    Promise.all([
      obtenerPeriodosPorEmpresa(empresaId),
      obtenerSucursalesPorEmpresa(empresaId),
    ])
      .then(([data, sucursalesData]) => {
        const ordenados = [...data].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
        setPeriodos(ordenados);
        const sucursalesActivas = sucursalesData.filter(
          (sucursal) => sucursal.activa !== false
        );
        setSucursales(sucursalesActivas);
        const sucursalGuardada = localStorage.getItem(
          `gastos-sucursal-seleccionada-${empresaId}`
        );
        setSucursalId(
          sucursalesActivas.some((sucursal) => sucursal.id === sucursalGuardada)
            ? sucursalGuardada!
            : sucursalesActivas[0]?.id || ""
        );
        const periodoGuardado = localStorage.getItem(
          `gastos-periodo-seleccionado-${empresaId}`
        );
        const periodoInicial = ordenados.some(
          (periodo) => periodo.id === periodoGuardado
        )
          ? periodoGuardado!
          : periodoPredeterminado(ordenados);
        setPeriodoId(periodoInicial);
      })
      .catch((error) => setMensaje(error?.message || "No se pudieron cargar los períodos."))
      .finally(() => setCargando(false));
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId) return;
    localStorage.setItem(
      `gastos-sucursal-seleccionada-${empresaId}`,
      sucursalId
    );
  }, [empresaId, sucursalId]);

  useEffect(() => {
    if (!empresaId || !periodoId) return;
    localStorage.setItem(
      `gastos-periodo-seleccionado-${empresaId}`,
      periodoId
    );
  }, [empresaId, periodoId]);

  useEffect(() => {
    if (editandoId || categoriasDisponibles.includes(
      formulario.categoria as never
    )) return;

    setFormulario((actual) => ({
      ...actual,
      categoria: categoriasDisponibles[0],
    }));
  }, [categoriasDisponibles, editandoId, formulario.categoria]);

  useEffect(() => {
    if (!periodoId) {
      setGastos([]);
      return;
    }
    setCargando(true);
    obtenerGastosPorPeriodo({
      empresa_id: empresaId,
      periodo_id: periodoId,
      sucursal_id: sucursalId || null,
    })
      .then(setGastos)
      .catch((error) => setMensaje(error?.message || "No se pudieron cargar los gastos."))
      .finally(() => setCargando(false));
  }, [empresaId, periodoId, sucursalId]);

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
        empresa_id: empresaId,
        sucursal_id: sucursalId || null,
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
      setGastos(await obtenerGastosPorPeriodo({
        empresa_id: empresaId,
        periodo_id: periodoId,
        sucursal_id: sucursalId || null,
      }));
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
      await eliminarGasto(gasto.id, empresaId);
      setGastos((actuales) => actuales.filter((item) => item.id !== gasto.id));
      setMensaje("Gasto eliminado.");
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo eliminar el gasto.");
    }
  }

  async function importarSueldos(archivo: File) {
    if (!empresaId || !periodoId) {
      setMensaje("Seleccioná una empresa y un período antes de importar.");
      return;
    }

    try {
      setMensaje("Leyendo archivo de sueldos...");
      const filas = await leerCsvSueldos(archivo);
      const periodosArchivo = new Set(filas.map((fila) => `${fila.periodo_anio}-${fila.periodo_mes}`));
      if (periodosArchivo.size !== 1) {
        throw new Error("El archivo debe contener una única liquidación mensual.");
      }

      const periodoSeleccionado = periodos.find((periodo) => periodo.id === periodoId);
      const primera = filas[0];
      if (!periodoSeleccionado || periodoSeleccionado.anio !== primera.periodo_anio || periodoSeleccionado.mes !== primera.periodo_mes) {
        throw new Error(`El archivo corresponde a ${primera.periodo_mes}/${primera.periodo_anio}. Seleccioná ese período antes de importarlo.`);
      }

      const empresa = empresas.find((item) => item.id === empresaId);
      const totalLiquido = filas.reduce((total, fila) => total + fila.liquido, 0);
      const confirmar = window.confirm(
        `Se importarán ${filas.length} empleados en ${empresa?.nombre || "la empresa"} por un total líquido de ${moneda(totalLiquido)}.\n\nLa importación anterior de sueldos de este período será reemplazada. Los aportes de BPS se registran por separado.`
      );
      if (!confirmar) {
        setMensaje("Importación cancelada.");
        return;
      }

      const cantidad = await reemplazarSalariosDesdeCsv({
        empresa_id: empresaId,
        periodo_id: periodoId,
        sucursal_id: sucursalId || null,
        filas,
      });
      setGastos(await obtenerGastosPorPeriodo({
        empresa_id: empresaId,
        periodo_id: periodoId,
        sucursal_id: sucursalId || null,
      }));
      setMensaje(`Sueldos importados correctamente: ${cantidad} empleados · ${moneda(totalLiquido)} de salarios líquidos.`);
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo importar el archivo de sueldos.");
    }
  }

  return (
    <div>
      <h2>Gastos</h2>

      <section style={card}>
        <h3>Empresa y período</h3>
        <div style={formGrid}>
        <label style={label}>Empresa
        <select style={input} value={empresaId} onChange={(event) => setEmpresaId(event.target.value)}>
          {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
        </select>
        </label>
        <label style={label}>Período
        <select style={input} value={periodoId} onChange={(event) => setPeriodoId(event.target.value)}>
          {periodos.map((periodo) => (
            <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
          ))}
        </select>
        </label>
        <label style={label}>Sucursal
        <select style={input} value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}>
          <option value="">Gastos generales de la empresa</option>
          {sucursales.map((sucursal) => (
            <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
          ))}
        </select>
        </label>
        </div>
      </section>

      <section style={card}>
        <h3>Importar salarios y jornales</h3>
        <p>Subí el CSV mensual generado por el sistema de sueldos. Se contabilizará únicamente la columna <strong>Líquido</strong>. La nómina y los aportes de BPS se registran por separado para no duplicarlos.</p>
        <p>Si volvés a importar el mismo mes, se reemplaza únicamente la importación anterior de salarios; los demás gastos no se modifican.</p>
        <input type="file" accept=".csv,text/csv" disabled={!empresaId || !periodoId}
          onChange={(event) => {
            const archivo = event.target.files?.[0];
            if (archivo) void importarSueldos(archivo);
            event.currentTarget.value = "";
          }} />
      </section>

      <section style={card}>
        <h3>{editandoId ? "Editar gasto" : "Registrar gasto"}</h3>
        <p>Para personal eventual o días especiales, elegí <strong>Jornales extras</strong> e ingresá solamente el importe. El detalle y las observaciones son opcionales.</p>
        <div style={formGrid}>
          <label style={label}>Categoría
            <select style={input} value={formulario.categoria} onChange={(e) => cambiar("categoria", e.target.value)}>
              {categoriasDisponibles.map((categoria) => <option key={categoria}>{categoria}</option>)}
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
              <thead><tr><th>Categoría</th><th>Detalle</th><th>Origen</th><th>Fecha</th><th>Importe</th><th>Observaciones</th><th>Acciones</th></tr></thead>
              <tbody>{gastos.map((gasto) => (
                <tr key={gasto.id}>
                  <td>{gasto.categoria}</td><td>{gasto.detalle || "-"}</td><td>{gasto.origen === "sueldos_csv" ? "Sistema de sueldos" : "Manual"}</td><td>{gasto.fecha || "-"}</td>
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
