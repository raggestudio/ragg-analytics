import { useEffect, useState } from "react";
import { obtenerPeriodosConDatosPorEmpresa } from "../../services/periodoService";
import { obtenerEmpresas } from "../../services/empresaService";
import { crearProducto, obtenerProductosPorEmpresa } from "../../services/productoService";
import { obtenerDashboardResumen, type DashboardResumen } from "../../services/dashboardService";
import type { ProductoRentabilidadResumen } from "../../services/productoVentasService";
import type { Periodo } from "../../types/periodo";
import type { Empresa } from "../../types/empresa";
import type { Producto } from "../../types/producto";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

type ProductoConCanal = ProductoRentabilidadResumen & {
  canal?: string | null;
  comision?: number;
};

type SucursalSimple = {
  id: string;
  nombre: string;
};

function obtenerPeriodoPredeterminado(periodos: Periodo[]) {
  const hoy = new Date();
  const actual = periodos.find(
    (p) => Number(p.anio) === hoy.getFullYear() && Number(p.mes) === hoy.getMonth() + 1
  );

  return (
    actual?.id ||
    [...periodos].sort(
      (a, b) =>
        Number(b.anio) * 12 +
        Number(b.mes) -
        (Number(a.anio) * 12 + Number(a.mes))
    )[0]?.id ||
    ""
  );
}

function sumar(items: ProductoConCanal[], campo: "ventas" | "costo_total" | "margen") {
  return items.reduce((total, item) => total + Number(item[campo] || 0), 0);
}

function escalarFilas(
  items: ProductoConCanal[],
  objetivo: { ventas: number; costo: number; margen: number }
) {
  if (items.length === 0) return items;

  const ventasActuales = sumar(items, "ventas");
  const costoActual = sumar(items, "costo_total");
  const margenActual = sumar(items, "margen");

  const factorVentas = ventasActuales !== 0 ? objetivo.ventas / ventasActuales : 1;
  const factorCosto = costoActual !== 0 ? objetivo.costo / costoActual : 1;
  const factorMargen = margenActual !== 0 ? objetivo.margen / margenActual : 1;

  return items.map((item) => {
    const ventas = Number(item.ventas || 0) * factorVentas;
    const costoTotal = Number(item.costo_total || 0) * factorCosto;
    const margen = Number(item.margen || 0) * factorMargen;

    return {
      ...item,
      ventas,
      costo_total: costoTotal,
      margen,
      margen_porcentaje: ventas > 0 ? (margen / ventas) * 100 : 0,
    };
  });
}

export function ProductosPage() {
  const { soloLectura } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ranking, setRanking] = useState<ProductoConCanal[]>([]);
  const [resumenDashboard, setResumenDashboard] = useState<DashboardResumen | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [canal, setCanal] = useState("todos");
  const [esRestaurante, setEsRestaurante] = useState(false);
  const [sucursales, setSucursales] = useState<SucursalSimple[]>([]);
  const [sucursalId, setSucursalId] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    void cargar();
  }, []);

  async function cargarSucursales(id: string) {
    const { data, error } = await supabase
      .from("sucursales")
      .select("id,nombre")
      .eq("empresa_id", id)
      .order("nombre", { ascending: true });

    if (error) throw error;
    setSucursales((data || []) as SucursalSimple[]);
  }

  async function cargar() {
    try {
      setMensaje("");
      const empresasData = await obtenerEmpresas();
      setEmpresas(empresasData);
      if (empresasData.length === 0) return;

      // RLS/usuario_empresa hace que un cliente reciba únicamente su empresa asignada.
      // El administrador conserva la selección recordada.
      const empresaGuardadaId = localStorage.getItem("productos-empresa-seleccionada");
      const empresaInicialId = soloLectura
        ? empresasData[0].id
        : empresasData.find((empresa) => empresa.id === empresaGuardadaId)?.id || empresasData[0].id;

      setEmpresaId(empresaInicialId);
      localStorage.setItem("productos-empresa-seleccionada", empresaInicialId);

      await cargarSucursales(empresaInicialId);

      const periodosData = await obtenerPeriodosConDatosPorEmpresa(empresaInicialId);
      setPeriodos(periodosData);

      const periodoGuardadoId = localStorage.getItem(`productos-periodo-${empresaInicialId}`);
      const periodoInicialId =
        periodosData.find((periodo) => periodo.id === periodoGuardadoId)?.id ||
        obtenerPeriodoPredeterminado(periodosData);

      const canalInicial = localStorage.getItem(`productos-canal-${empresaInicialId}`) || "todos";
      setCanal(canalInicial);
      setPeriodoId(periodoInicialId);

      await cargarDatos(empresaInicialId, periodoInicialId, "");
    } catch (error: any) {
      console.error(error);
      setMensaje(error?.message || "Error cargando productos");
    }
  }

  async function cargarDatos(id: string, periodoSeleccionadoId: string, sucursalSeleccionadaId: string) {
    if (!periodoSeleccionadoId) {
      setRanking([]);
      setResumenDashboard(null);
      return;
    }

    try {
      setMensaje("");

      const productosPromise = soloLectura
        ? Promise.resolve([] as Producto[])
        : obtenerProductosPorEmpresa(id);

      let rentabilidadQuery = supabase
        .from("rentabilidad_periodo")
        .select("*")
        .eq("empresa_id", id)
        .eq("periodo_id", periodoSeleccionadoId)
        .order("ventas", { ascending: false });

      if (sucursalSeleccionadaId) {
        rentabilidadQuery = rentabilidadQuery.eq("sucursal_id", sucursalSeleccionadaId);
      }

      let fuentesQuery = supabase
        .from("producto_ventas_resumen")
        .select("fuente")
        .eq("empresa_id", id)
        .eq("periodo_id", periodoSeleccionadoId);

      if (sucursalSeleccionadaId) {
        fuentesQuery = fuentesQuery.eq("sucursal_id", sucursalSeleccionadaId);
      }

      const [productosData, rentabilidadResultado, fuentesResultado, dashboardResultado] =
        await Promise.all([
          productosPromise,
          rentabilidadQuery,
          fuentesQuery,
          obtenerDashboardResumen({
            empresa_id: id,
            periodo_id: periodoSeleccionadoId,
            sucursal_id: sucursalSeleccionadaId || null,
          }),
        ]);

      if (rentabilidadResultado.error) throw rentabilidadResultado.error;
      if (fuentesResultado.error) throw fuentesResultado.error;

      setProductos(productosData);
      setResumenDashboard(dashboardResultado);

      const modoRestaurante = (fuentesResultado.data || []).some(
        (fila: any) => fila.fuente === "Paradise"
      );
      setEsRestaurante(modoRestaurante);

      const filas = (rentabilidadResultado.data || []).map((fila: any) => ({
        ...fila,
        canal:
          !modoRestaurante && fila.canal === "Paradise"
            ? "Isatech"
            : fila.canal || (modoRestaurante ? "Paradise" : "Isatech"),
      })) as ProductoConCanal[];

      const agrupados = new Map<string, ProductoConCanal>();

      for (const fila of filas) {
        const nombreNormalizado = String(fila.nombre_producto || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const categoriaNormalizada = String(fila.categoria || "").toLowerCase().trim();
        const canalNormalizado = String(fila.canal || "Isatech");
        const clave = `${canalNormalizado}__${categoriaNormalizada}__${nombreNormalizado}`;
        const existente = agrupados.get(clave);

        if (existente) {
          existente.cantidad += Number(fila.cantidad || 0);
          existente.ventas += Number(fila.ventas || 0);
          existente.costo_total += Number(fila.costo_total || 0);
          existente.margen += Number(fila.margen || 0);
          existente.comision = Number(existente.comision || 0) + Number(fila.comision || 0);
          existente.margen_porcentaje =
            existente.ventas > 0 ? (existente.margen / existente.ventas) * 100 : 0;
          if (fila.tipo_calculo === "sin_costo") existente.tipo_calculo = "sin_costo";
        } else {
          agrupados.set(clave, {
            ...fila,
            cantidad: Number(fila.cantidad || 0),
            ventas: Number(fila.ventas || 0),
            costo_total: Number(fila.costo_total || 0),
            margen: Number(fila.margen || 0),
            margen_porcentaje: Number(fila.margen_porcentaje || 0),
          });
        }
      }

      let filasAgrupadas = Array.from(agrupados.values());

      // Para restaurantes, el Dashboard usa el resumen efectivo de PedidosYa por turnos.
      // Ajustamos las filas del canal a esos mismos totales para que Productos y Dashboard
      // no vuelvan a mostrar cifras distintas.
      if (modoRestaurante) {
        const paradise = filasAgrupadas.filter((p) => p.canal === "Paradise");
        const pedidosYa = filasAgrupadas.filter((p) => p.canal === "PedidosYa");
        const otros = filasAgrupadas.filter(
          (p) => p.canal !== "Paradise" && p.canal !== "PedidosYa"
        );

        filasAgrupadas = [
          ...escalarFilas(paradise, {
            ventas: Number(dashboardResultado.ventas_paradise || 0),
            costo: Number(dashboardResultado.costo_productos_paradise || 0),
            margen: Number(dashboardResultado.margen_paradise || 0),
          }),
          ...escalarFilas(pedidosYa, {
            ventas: Number(dashboardResultado.ventas_pedidosya || 0),
            costo: Number(dashboardResultado.costo_productos_pedidosya || 0),
            margen: Number(dashboardResultado.margen_pedidosya || 0),
          }),
          ...otros,
        ];
      }

      setRanking(filasAgrupadas);
    } catch (error: any) {
      console.error(error);
      setMensaje(error?.message || "Error cargando el análisis de productos");
    }
  }

  async function cambiarEmpresa(id: string) {
    setEmpresaId(id);
    setSucursalId("");
    localStorage.setItem("productos-empresa-seleccionada", id);
    await cargarSucursales(id);

    const periodosData = await obtenerPeriodosConDatosPorEmpresa(id);
    setPeriodos(periodosData);
    const periodoGuardadoId = localStorage.getItem(`productos-periodo-${id}`);
    const nuevoPeriodoId =
      periodosData.find((periodo) => periodo.id === periodoGuardadoId)?.id ||
      obtenerPeriodoPredeterminado(periodosData);

    setCanal(localStorage.getItem(`productos-canal-${id}`) || "todos");
    setPeriodoId(nuevoPeriodoId);
    await cargarDatos(id, nuevoPeriodoId, "");
  }

  async function cambiarPeriodo(id: string) {
    setPeriodoId(id);
    localStorage.setItem(`productos-periodo-${empresaId}`, id);
    await cargarDatos(empresaId, id, sucursalId);
  }

  async function cambiarSucursal(id: string) {
    setSucursalId(id);
    await cargarDatos(empresaId, periodoId, id);
  }

  function cambiarCanal(id: string) {
    setCanal(id);
    localStorage.setItem(`productos-canal-${empresaId}`, id);
  }

  async function guardarProducto() {
    if (soloLectura) return;
    if (!empresaId) return alert("Seleccioná una empresa");
    if (!nombre.trim()) return alert("Ingresá el nombre del producto");

    await crearProducto({ empresa_id: empresaId, codigo, nombre });
    setCodigo("");
    setNombre("");
    await cargarDatos(empresaId, periodoId, sucursalId);
  }

  const rankingDelCanal = ranking.filter(
    (p) => canal === "todos" || String(p.canal || "Isatech") === canal
  );

  let totalVentas = rankingDelCanal.reduce((acc, p) => acc + Number(p.ventas), 0);
  let totalCosto = rankingDelCanal.reduce((acc, p) => acc + Number(p.costo_total), 0);
  let totalGanancia = rankingDelCanal.reduce((acc, p) => acc + Number(p.margen), 0);

  // Las tarjetas resumen toman literalmente los mismos totales que Dashboard.
  if (resumenDashboard) {
    if (esRestaurante && canal === "Paradise") {
      totalVentas = Number(resumenDashboard.ventas_paradise || 0);
      totalCosto = Number(resumenDashboard.costo_productos_paradise || 0);
      totalGanancia = Number(resumenDashboard.margen_paradise || 0);
    } else if (esRestaurante && canal === "PedidosYa") {
      totalVentas = Number(resumenDashboard.ventas_pedidosya || 0);
      totalCosto = Number(resumenDashboard.costo_productos_pedidosya || 0);
      totalGanancia = Number(resumenDashboard.margen_pedidosya || 0);
    } else if (canal === "todos" || !esRestaurante) {
      totalVentas = Number(resumenDashboard.ventas_totales || 0);
      totalCosto = Number(resumenDashboard.costo_total || 0);
      totalGanancia = Number(resumenDashboard.margen_total || 0);
    }
  }

  const totalComision = rankingDelCanal.reduce(
    (acc, p) => acc + Number(p.comision || 0),
    0
  );
  const totalCantidad = rankingDelCanal.reduce((acc, p) => acc + Number(p.cantidad), 0);
  const productosSinCosto = rankingDelCanal.filter((p) => p.tipo_calculo === "sin_costo").length;

  const rankingFiltrado = rankingDelCanal.filter((p) =>
    p.nombre_producto.toLowerCase().includes(busqueda.toLowerCase())
  );

  const topVentas = [...rankingFiltrado]
    .sort((a, b) => Number(b.ventas) - Number(a.ventas))
    .slice(0, 10);
  const topGanancia = [...rankingFiltrado]
    .sort((a, b) => Number(b.margen) - Number(a.margen))
    .slice(0, 10);
  const menosVendidos = [...rankingFiltrado]
    .filter((p) => Number(p.cantidad) > 0)
    .sort((a, b) => Number(a.cantidad) - Number(b.cantidad))
    .slice(0, 10);

  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <h2>Productos</h2>

      {mensaje && <p style={{ color: "#fca5a5" }}>{mensaje}</p>}

      <section style={card}>
        <h3>Filtros</h3>

        {!soloLectura && (
          <select style={input} value={empresaId} onChange={(e) => void cambiarEmpresa(e.target.value)}>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
            ))}
          </select>
        )}

        {soloLectura && empresas[0] && (
          <p style={{ marginTop: 0, color: "#cbd5e1" }}>
            Empresa: <strong>{empresas[0].nombre}</strong>
          </p>
        )}

        <select style={input} value={canal} onChange={(e) => cambiarCanal(e.target.value)}>
          <option value="todos">Todos los canales</option>
          {esRestaurante ? (
            <>
              <option value="Paradise">Paradise</option>
              <option value="PedidosYa">PedidosYa</option>
            </>
          ) : (
            <option value="Isatech">Isatech</option>
          )}
        </select>

        <select style={input} value={periodoId} onChange={(e) => void cambiarPeriodo(e.target.value)}>
          {periodos.map((periodo) => (
            <option key={periodo.id} value={periodo.id}>{periodo.nombre}</option>
          ))}
        </select>

        {sucursales.length > 0 && (
          <select style={input} value={sucursalId} onChange={(e) => void cambiarSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>
            ))}
          </select>
        )}

        <input
          style={input}
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </section>

      <section style={card}>
        <h3>Resumen de productos</h3>
        <div style={metricGrid}>
          <Metric title="Ventas productos" value={`$${Math.round(totalVentas).toLocaleString("es-UY")}`} />
          <Metric title="Costo" value={`$${Math.round(totalCosto).toLocaleString("es-UY")}`} />
          <Metric title="Ganancia" value={`$${Math.round(totalGanancia).toLocaleString("es-UY")}`} />
          {esRestaurante && (
            <Metric title="Comisión PedidosYa" value={`$${Math.round(totalComision).toLocaleString("es-UY")}`} />
          )}
          <Metric
            title="Margen"
            value={`${totalVentas > 0 ? ((totalGanancia / totalVentas) * 100).toFixed(1) : "0"}%`}
          />
          <Metric title="Cantidad vendida" value={totalCantidad.toLocaleString("es-UY")} />
          <Metric title="Productos sin costo" value={productosSinCosto} />
        </div>
      </section>

      <section style={card}>
        <h3>Top 10 por ventas</h3>
        <TablaProductos items={topVentas} mostrarComision={esRestaurante} />
      </section>

      <section style={card}>
        <h3>Top 10 por ganancia</h3>
        <TablaProductos items={topGanancia} mostrarComision={esRestaurante} />
      </section>

      <section style={card}>
        <h3>Menos vendidos</h3>
        <TablaProductos items={menosVendidos} mostrarComision={esRestaurante} />
      </section>

      {!soloLectura && (
        <>
          <section style={card}>
            <h3>Nuevo producto manual</h3>
            <input style={input} placeholder="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <input style={input} placeholder="Nombre del producto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <button style={button} onClick={() => void guardarProducto()}>Guardar producto</button>
          </section>

          <section style={card}>
            <h3>Productos registrados manualmente</h3>
            {productos.length === 0 ? (
              <p>No hay productos cargados manualmente todavía.</p>
            ) : (
              productos.map((producto) => (
                <div key={producto.id} style={productoItem}>
                  <strong>{producto.nombre}</strong>
                  <span>Código: {producto.codigo || "-"}</span>
                  <span>Estado: {producto.activo ? "Activo" : "Inactivo"}</span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={metricCard}>
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}

function TablaProductos({ items, mostrarComision }: { items: ProductoConCanal[]; mostrarComision: boolean }) {
  if (items.length === 0) return <p>No hay datos para mostrar.</p>;

  const columnas = mostrarComision
    ? "minmax(220px,2fr) 100px 80px 105px 105px 130px 105px 80px"
    : "minmax(220px,2fr) 100px 80px 105px 105px 105px 80px";

  return (
    <div style={tableScroll}>
      <div style={{ minWidth: mostrarComision ? 980 : 820 }}>
        <div style={{ ...tableHeader, gridTemplateColumns: columnas }}>
          <strong>Producto</strong>
          <strong>Canal</strong>
          <strong>Cantidad</strong>
          <strong>Ventas</strong>
          <strong>Costo</strong>
          {mostrarComision && <strong>Comisión PedidosYa</strong>}
          <strong>Ganancia</strong>
          <strong>Margen</strong>
        </div>

        {items.map((item, index) => {
          const sinCosto = item.tipo_calculo === "sin_costo";
          return (
            <div key={`${item.id}-${item.nombre_producto}-${item.canal}`} style={{ ...tableRow, gridTemplateColumns: columnas }}>
              <span>{index + 1}. {item.nombre_producto}</span>
              <span>{item.canal || "Isatech"}</span>
              <span>{Number(item.cantidad).toLocaleString("es-UY")}</span>
              <span>${Math.round(Number(item.ventas)).toLocaleString("es-UY")}</span>
              <span>{sinCosto ? "Sin costo" : `$${Math.round(Number(item.costo_total)).toLocaleString("es-UY")}`}</span>
              {mostrarComision && <span>${Math.round(Number(item.comision || 0)).toLocaleString("es-UY")}</span>}
              <span>{sinCosto ? "-" : `$${Math.round(Number(item.margen)).toLocaleString("es-UY")}`}</span>
              <span>{sinCosto ? "-" : `${Number(item.margen_porcentaje).toFixed(1)}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  marginTop: 20,
  borderRadius: 16,
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 520,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
  boxSizing: "border-box",
};

const button: React.CSSProperties = { padding: 12, borderRadius: 8, cursor: "pointer" };

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 15,
};

const metricCard: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #334155",
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const tableScroll: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  overflowX: "auto",
  overflowY: "hidden",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "12px 0",
  borderBottom: "2px solid #475569",
  alignItems: "center",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #334155",
  alignItems: "center",
};

const productoItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "14px 0",
  borderBottom: "1px solid #334155",
};
