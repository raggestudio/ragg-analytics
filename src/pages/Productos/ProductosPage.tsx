import { obtenerPeriodosPorEmpresa } from "../../services/periodoService";
import type { Periodo } from "../../types/periodo";
import { useEffect, useState } from "react";
import { obtenerEmpresas } from "../../services/empresaService";
import {
  crearProducto,
  obtenerProductosPorEmpresa,
} from "../../services/productoService";
import type { ProductoRentabilidadResumen } from "../../services/productoVentasService";
import type { Empresa } from "../../types/empresa";
import type { Producto } from "../../types/producto";
import { supabase } from "../../lib/supabase";

type ProductoConCanal = ProductoRentabilidadResumen & {
  canal?: string | null;
  comision?: number;
};

function obtenerPeriodoPredeterminado(periodos: Periodo[]) {
  const hoy = new Date();
  const actual = periodos.find(
    (p) => Number(p.anio) === hoy.getFullYear() && Number(p.mes) === hoy.getMonth() + 1
  );
  return actual?.id || [...periodos].sort(
    (a, b) => Number(b.anio) * 12 + Number(b.mes) - (Number(a.anio) * 12 + Number(a.mes))
  )[0]?.id || "";
}

export function ProductosPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ranking, setRanking] =
  useState<ProductoConCanal[]>([]);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState("");
  const [canal, setCanal] = useState("todos");
  const [esRestaurante, setEsRestaurante] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
  const empresasData = await obtenerEmpresas();
  setEmpresas(empresasData);

  if (empresasData.length === 0) return;

  const empresaInicialId = empresasData[0].id;
  setEmpresaId(empresaInicialId);

  const periodosData = await obtenerPeriodosPorEmpresa(empresaInicialId);
  setPeriodos(periodosData);

  const periodoInicialId = obtenerPeriodoPredeterminado(periodosData);
  setPeriodoId(periodoInicialId);

  await cargarDatos(empresaInicialId, periodoInicialId);
}

  async function cargarDatos(
  id: string,
  periodoSeleccionadoId: string
) {
  setProductos(await obtenerProductosPorEmpresa(id));

  if (!periodoSeleccionadoId) {
    setRanking([]);
    return;
  }
console.log("PRODUCTOS - EMPRESA", id);
console.log("PRODUCTOS - PERIODO", periodoSeleccionadoId);
  const [rentabilidadResultado, fuentesResultado] = await Promise.all([
    supabase
      .from("rentabilidad_periodo")
      .select("*")
      .eq("empresa_id", id)
      .eq("periodo_id", periodoSeleccionadoId)
      .order("ventas", { ascending: false }),
    supabase
      .from("producto_ventas_resumen")
      .select("fuente")
      .eq("empresa_id", id)
      .eq("periodo_id", periodoSeleccionadoId),
  ]);

  const { data: filasData, error } = rentabilidadResultado;

  if (error) throw error;
  if (fuentesResultado.error) throw fuentesResultado.error;

  const modoRestaurante = (fuentesResultado.data || []).some(
    (fila: any) => fila.fuente === "Paradise"
  );
  setEsRestaurante(modoRestaurante);

  const filas = (filasData || []).map((fila: any) => ({
    ...fila,
    canal:
      !modoRestaurante && fila.canal === "Paradise"
        ? "Isatech"
        : fila.canal || (modoRestaurante ? "Paradise" : "Isatech"),
  })) as ProductoConCanal[];

console.log("PRODUCTOS - RENTABILIDAD", filas);

  const agrupados = new Map<
    string,
    ProductoConCanal
  >();

  for (const fila of filas) {
    const nombreNormalizado = String(
      fila.nombre_producto || ""
    )
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const categoriaNormalizada = String(
      fila.categoria || ""
    )
      .toLowerCase()
      .trim();

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
        existente.ventas > 0
          ? (existente.margen / existente.ventas) * 100
          : 0;

      if (fila.tipo_calculo === "sin_costo") {
        existente.tipo_calculo = "sin_costo";
      }
    } else {
      agrupados.set(clave, {
        ...fila,
        cantidad: Number(fila.cantidad || 0),
        ventas: Number(fila.ventas || 0),
        costo_total: Number(fila.costo_total || 0),
        margen: Number(fila.margen || 0),
        margen_porcentaje: Number(
          fila.margen_porcentaje || 0
        ),
      });
    }
  }

  setRanking(Array.from(agrupados.values()));
}

  async function cambiarEmpresa(id: string) {
  setEmpresaId(id);
  setCanal("todos");

  const periodosData = await obtenerPeriodosPorEmpresa(id);
  setPeriodos(periodosData);

  const nuevoPeriodoId = obtenerPeriodoPredeterminado(periodosData);
  setPeriodoId(nuevoPeriodoId);

  await cargarDatos(id, nuevoPeriodoId);
}
async function cambiarPeriodo(id: string) {
  setPeriodoId(id);
  await cargarDatos(empresaId, id);
}
  async function guardarProducto() {
    if (!empresaId) return alert("Seleccioná una empresa");
    if (!nombre.trim()) return alert("Ingresá el nombre del producto");

    await crearProducto({ empresa_id: empresaId, codigo, nombre });

    setCodigo("");
    setNombre("");
    await cargarDatos(empresaId, periodoId);
  }

  const rankingDelCanal = ranking.filter(
    (p) => canal === "todos" || String(p.canal || "Isatech") === canal
  );

  const totalVentas = rankingDelCanal.reduce(
  (acc, p) => acc + Number(p.ventas),
  0
);

const totalCosto = rankingDelCanal.reduce(
  (acc, p) => acc + Number(p.costo_total),
  0
);

const totalGanancia = rankingDelCanal.reduce(
  (acc, p) => acc + Number(p.margen),
  0
);

const totalComision = rankingDelCanal.reduce(
  (acc, p) => acc + Number(p.comision || 0),
  0
);

const totalCantidad = rankingDelCanal.reduce(
  (acc, p) => acc + Number(p.cantidad),
  0
);

const productosSinCosto = rankingDelCanal.filter(
  (p) => p.tipo_calculo === "sin_costo"
).length;

  const rankingFiltrado = ranking.filter((p) => {
    const coincideBusqueda = p.nombre_producto
      .toLowerCase()
      .includes(busqueda.toLowerCase());

    const coincideCanal =
      canal === "todos" || String(p.canal || "Isatech") === canal;

    return coincideBusqueda && coincideCanal;
  });

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
    <div>
      <h2>Productos</h2>

      <section style={card}>
        <h3>Filtros</h3>

        <select
          style={input}
          value={empresaId}
          onChange={(e) => cambiarEmpresa(e.target.value)}
        >
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>
        <select style={input} value={canal} onChange={(e) => setCanal(e.target.value)}>
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
<select
  style={input}
  value={periodoId}
  onChange={(e) => cambiarPeriodo(e.target.value)}
>
  {periodos.map((periodo) => (
    <option key={periodo.id} value={periodo.id}>
      {periodo.nombre}
    </option>
  ))}
</select>
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
  <Metric
    title="Ventas productos"
    value={`$${Math.round(totalVentas).toLocaleString("es-UY")}`}
  />

  <Metric
    title="Costo"
    value={`$${Math.round(totalCosto).toLocaleString("es-UY")}`}
  />

  <Metric
    title="Ganancia"
    value={`$${Math.round(totalGanancia).toLocaleString("es-UY")}`}
  />

  {esRestaurante && (
    <Metric
      title="Comisión PedidosYa"
      value={`$${Math.round(totalComision).toLocaleString("es-UY")}`}
    />
  )}

  <Metric
    title="Margen"
    value={`${
      totalVentas > 0
        ? ((totalGanancia / totalVentas) * 100).toFixed(1)
        : "0"
    }%`}
  />

  <Metric
    title="Cantidad vendida"
    value={totalCantidad.toLocaleString("es-UY")}
  />

  <Metric
    title="Productos sin costo"
    value={productosSinCosto}
  />
</div>
      </section>

      <section style={card}>
        <h3>Top 10 por ventas</h3>
        <TablaProductos items={topVentas} totalVentas={totalVentas} mostrarComision={esRestaurante} />
      </section>

      <section style={card}>
        <h3>Top 10 por ganancia</h3>
        <TablaProductos items={topGanancia} totalVentas={totalVentas} mostrarComision={esRestaurante} />
      </section>

      <section style={card}>
        <h3>Menos vendidos</h3>
        <TablaProductos items={menosVendidos} totalVentas={totalVentas} mostrarComision={esRestaurante} />
      </section>

      <section style={card}>
        <h3>Nuevo producto manual</h3>

        <input
          style={input}
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />

        <input
          style={input}
          placeholder="Nombre del producto"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <button style={button} onClick={guardarProducto}>
          Guardar producto
        </button>
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

function TablaProductos({
  items,
  mostrarComision,
}: {
  items: ProductoConCanal[];
  totalVentas: number;
  mostrarComision: boolean;
}) {
  if (items.length === 0) {
    return <p>No hay datos para mostrar.</p>;
  }

  return (
    <div>
      <div style={{
        ...tableHeader,
        gridTemplateColumns: mostrarComision
          ? "2fr 100px 80px 105px 105px 105px 105px 80px"
          : "2fr 100px 80px 105px 105px 105px 80px",
      }}>
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
        const sinCosto =
          item.tipo_calculo === "sin_costo";

        return (
          <div
            key={`${item.id}-${item.nombre_producto}`}
            style={{
              ...tableRow,
              gridTemplateColumns: mostrarComision
                ? "2fr 100px 80px 105px 105px 105px 105px 80px"
                : "2fr 100px 80px 105px 105px 105px 80px",
            }}
          >
            <span>
              {index + 1}. {item.nombre_producto}
            </span>

            <span>{item.canal || "Isatech"}</span>

            <span>
              {Number(item.cantidad).toLocaleString("es-UY")}
            </span>

            <span>
              ${Math.round(Number(item.ventas)).toLocaleString("es-UY")}
            </span>

            <span>
              {sinCosto
                ? "Sin costo"
                : `$${Math.round(Number(item.costo_total)).toLocaleString(
                    "es-UY"
                  )}`}
            </span>

            {mostrarComision && (
              <span>${Math.round(Number(item.comision || 0)).toLocaleString("es-UY")}</span>
            )}

            <span>
              {sinCosto
                ? "-"
                : `$${Math.round(Number(item.margen)).toLocaleString(
                    "es-UY"
                  )}`}
            </span>

            <span>
              {sinCosto
                ? "-"
                : `${Number(item.margen_porcentaje).toFixed(
                    1
                  )}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  marginTop: 20,
  borderRadius: 16,
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 520,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
};

const button: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  cursor: "pointer",
};

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 15,
};

const metricCard: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #334155",
  display: "grid",
  gap: 8,
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 100px 80px 105px 105px 105px 105px 80px",
  gap: 12,
  padding: "12px 0",
  borderBottom: "2px solid #475569",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 100px 80px 105px 105px 105px 105px 80px",
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