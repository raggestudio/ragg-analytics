import { useEffect, useState } from "react";
import { obtenerEmpresas } from "../../services/empresaService";
import { obtenerSucursalesPorEmpresa } from "../../services/sucursalService";
import { obtenerPeriodosPorEmpresa } from "../../services/periodoService";
import { SaboresPedidosYa } from "../../components/dashboard/SaboresPedidosYa";
import { RentabilidadSaboresPedidosYa } from "../../components/dashboard/RentabilidadSaboresPedidosYa";

import {
  obtenerCostosSaboresPedidosYa,
  type ResumenCostosSaboresPedidosYa,
} from "../../services/pedidosYaRentabilidadService";

import {
  obtenerSaboresPedidosYaPorPeriodos,
  agruparSaboresPedidosYa,
  type SaborPedidosYa,
} from "../../services/pedidosYaSaboresService";
import {
  obtenerDashboardComparativo,
  obtenerTopFacturacion,
  obtenerTopRentabilidad,
  type DashboardComparativo,
  type RankingItem,
  obtenerEvolucionDashboard,
  type EvolucionDashboardItem,
  obtenerTopPedidosYa,
  type RankingCanalItem,
} from "../../services/dashboardService";
import ExecutiveSummary from "../../components/dashboard/ExecutiveSummary";
import { generarInsights } from "../../services/dashboardInsights";
import type { Empresa } from "../../types/empresa";
import type { Sucursal } from "../../types/sucursal";
import type { Periodo } from "../../types/periodo";

function obtenerPeriodoPredeterminado(periodos: Periodo[]) {
  const hoy = new Date();
  const actual = periodos.find(
    (p) => Number(p.anio) === hoy.getFullYear() && Number(p.mes) === hoy.getMonth() + 1
  );
  return actual?.id || [...periodos].sort(
    (a, b) => Number(b.anio) * 12 + Number(b.mes) - (Number(a.anio) * 12 + Number(a.mes))
  )[0]?.id || "";
}

export function DashboardPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [periodoId, setPeriodoId] = useState("");
  const [periodoDesdeId, setPeriodoDesdeId] = useState("");
  const [periodoHastaId, setPeriodoHastaId] = useState("");
  const [comparativo, setComparativo] = useState<DashboardComparativo | null>(null);
  const [topRentabilidad, setTopRentabilidad] = useState<RankingItem[]>([]);
  const [topFacturacion, setTopFacturacion] = useState<RankingItem[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [evolucion, setEvolucion] = useState<EvolucionDashboardItem[]>([]);
  const [topPedidosYa, setTopPedidosYa] = useState<RankingCanalItem[]>([]);
  const [insights, setInsights] = useState({
  positivas: [] as string[],
  atencion: [] as string[],
  acciones: [] as string[],
});

const [saboresPedidosYa, setSaboresPedidosYa] =
  useState<SaborPedidosYa[]>([]);
  const [costosSaboresPedidosYa, setCostosSaboresPedidosYa] =
  useState<ResumenCostosSaboresPedidosYa | null>(null);
  const [modoAnalisis, setModoAnalisis] = useState<
  "mensual" | "trimestral" | "anual" | "personalizado"
>(() => {
  const guardado = localStorage.getItem(
    "dashboard-modo-analisis"
  );

  if (
    guardado === "mensual" ||
    guardado === "trimestral" ||
    guardado === "anual" ||
    guardado === "personalizado"
  ) {
    return guardado;
  }

  return "mensual";
});

  useEffect(() => {
  cargarInicial();
}, []);

useEffect(() => {
  if (empresaId && periodoId) {
    cargarDashboard();
  }
}, [
  empresaId,
  periodoId,
  sucursalId,
  modoAnalisis,
  periodoDesdeId,
  periodoHastaId,
]);

useEffect(() => {
  if (!empresaId || !periodoId) return;

  localStorage.setItem(
    `dashboard-periodo-${empresaId}`,
    periodoId
  );
}, [empresaId, periodoId]);

useEffect(() => {
  localStorage.setItem(
    "dashboard-modo-analisis",
    modoAnalisis
  );
}, [modoAnalisis]);

  async function cargarInicial() {
    const empresasData = await obtenerEmpresas();
    setEmpresas(empresasData);

    if (empresasData.length > 0) {
  const empresaGuardadaId =
    localStorage.getItem(
      "dashboard-empresa-seleccionada"
    );

  const empresa =
    empresasData.find(
      (item) =>
        item.id === empresaGuardadaId
    ) || empresasData[0];

  setEmpresaId(empresa.id);

      const sucursalesData = await obtenerSucursalesPorEmpresa(empresa.id);
      const periodosData = await obtenerPeriodosPorEmpresa(empresa.id);

      setSucursales(sucursalesData);
      setPeriodos(periodosData);
      setSucursalId("");
      const periodoGuardado = localStorage.getItem(
  `dashboard-periodo-${empresa.id}`
);

const actualId =
  periodoGuardado &&
  periodosData.some(
    (periodo) => periodo.id === periodoGuardado
  )
    ? periodoGuardado
    : obtenerPeriodoPredeterminado(periodosData);
      setPeriodoId(actualId);
      setPeriodoDesdeId(actualId);
      setPeriodoHastaId(actualId);
    }
  }

  async function cambiarEmpresa(id: string) {
    localStorage.setItem(
  "dashboard-empresa-seleccionada",
  id
);
    setEmpresaId(id);
    setSucursalId("");

    const sucursalesData = await obtenerSucursalesPorEmpresa(id);
    const periodosData = await obtenerPeriodosPorEmpresa(id);

    setSucursales(sucursalesData);
    setPeriodos(periodosData);
    const periodoGuardado = localStorage.getItem(
  `dashboard-periodo-${id}`
);

const actualId =
  periodoGuardado &&
  periodosData.some(
    (periodo) => periodo.id === periodoGuardado
  )
    ? periodoGuardado
    : obtenerPeriodoPredeterminado(periodosData);
    setPeriodoId(actualId);
    setPeriodoDesdeId(actualId);
    setPeriodoHastaId(actualId);
  }
function obtenerPeriodoIdsSeleccionados(): string[] {
  const periodoSeleccionado = periodos.find(
    (periodo) => periodo.id === periodoId
  );

  if (!periodoSeleccionado) return [];

  const periodosOrdenados = [...periodos].sort(
    (a, b) =>
      Number(a.anio) * 12 +
      Number(a.mes) -
      (Number(b.anio) * 12 + Number(b.mes))
  );

  if (modoAnalisis === "mensual") {
    return [periodoId];
  }

  if (modoAnalisis === "trimestral") {
    const anio = Number(periodoSeleccionado.anio);
    const mes = Number(periodoSeleccionado.mes);
    const mesInicial = Math.floor((mes - 1) / 3) * 3 + 1;
    const mesFinal = mesInicial + 2;

    return periodosOrdenados
      .filter(
        (periodo) =>
          Number(periodo.anio) === anio &&
          Number(periodo.mes) >= mesInicial &&
          Number(periodo.mes) <= mesFinal
      )
      .map((periodo) => periodo.id);
  }

  if (modoAnalisis === "anual") {
    return periodosOrdenados
      .filter(
        (periodo) =>
          Number(periodo.anio) === Number(periodoSeleccionado.anio)
      )
      .map((periodo) => periodo.id);
  }

  const indiceDesde = periodosOrdenados.findIndex(
    (periodo) => periodo.id === periodoDesdeId
  );

  const indiceHasta = periodosOrdenados.findIndex(
    (periodo) => periodo.id === periodoHastaId
  );

  if (indiceDesde === -1 || indiceHasta === -1) return [];

  const inicio = Math.min(indiceDesde, indiceHasta);
  const fin = Math.max(indiceDesde, indiceHasta);

  return periodosOrdenados
    .slice(inicio, fin + 1)
    .map((periodo) => periodo.id);
}
  async function cargarDashboard(
  forzarActualizacion = false
) {
  const claveCache = [
    "dashboard-cache",
    empresaId,
    periodoId,
    sucursalId || "todas",
    modoAnalisis,
    periodoDesdeId || "-",
    periodoHastaId || "-",
  ].join(":");

  if (!forzarActualizacion) {
    try {
      const cacheTexto =
        sessionStorage.getItem(claveCache);

      if (cacheTexto) {
        const cache = JSON.parse(cacheTexto);

        /*
         * La información se reutiliza durante 30 minutos.
         */
        const cacheVigente =
          Date.now() - Number(cache.guardadoEn || 0) <
          30 * 60 * 1000;

        if (cacheVigente) {
          setComparativo(cache.comparativo);
          setTopRentabilidad(
            cache.topRentabilidad || []
          );
          setTopFacturacion(
            cache.topFacturacion || []
          );
          setEvolucion(cache.evolucion || []);
          setTopPedidosYa(
            cache.topPedidosYa || []
          );
          setSaboresPedidosYa(
            cache.saboresPedidosYa || []
          );
          setCostosSaboresPedidosYa(
            cache.costosSaboresPedidosYa || null
          );
          setInsights(
            cache.insights || {
              positivas: [],
              atencion: [],
              acciones: [],
            }
          );

          return;
        }
      }
    } catch (error) {
      console.warn(
        "No se pudo recuperar el dashboard guardado",
        error
      );
    }
  }

  try {
 
      setMensaje("");

      const input = {
  empresa_id: empresaId,
  periodo_id: periodoId,
  sucursal_id: sucursalId || null,
  modo: modoAnalisis,
  periodo_desde_id:
    modoAnalisis === "personalizado" ? periodoDesdeId : null,
  periodo_hasta_id:
    modoAnalisis === "personalizado" ? periodoHastaId : null,
};

      const comparativoData = await obtenerDashboardComparativo(input);
      const topRentabilidadData = await obtenerTopRentabilidad(input);
      const topFacturacionData = await obtenerTopFacturacion(input);
      const evolucionData = await obtenerEvolucionDashboard(input);
      const topPedidosYaData = await obtenerTopPedidosYa(input);
      const periodoIdsSabores = obtenerPeriodoIdsSeleccionados();

const filasSabores = await obtenerSaboresPedidosYaPorPeriodos({
  empresa_id: empresaId,
  periodo_ids: periodoIdsSabores,
  sucursal_id: sucursalId || null,
});

const sabores = agruparSaboresPedidosYa(filasSabores);

const costosSabores = await obtenerCostosSaboresPedidosYa({
  empresa_id: empresaId,
  periodo_ids: periodoIdsSabores,
  sucursal_id: sucursalId || null,
});

setSaboresPedidosYa(sabores);
setCostosSaboresPedidosYa(costosSabores);

      setComparativo(comparativoData);
      setTopRentabilidad(topRentabilidadData);
      setTopFacturacion(topFacturacionData);
      setEvolucion(evolucionData);
      setTopPedidosYa(topPedidosYaData);
      const insightsCalculados = generarInsights(
  comparativoData.actual,
  comparativoData.anterior
);

setInsights(insightsCalculados);

sessionStorage.setItem(
  claveCache,
  JSON.stringify({
    guardadoEn: Date.now(),
    comparativo: comparativoData,
    topRentabilidad:
      topRentabilidadData,
    topFacturacion:
      topFacturacionData,
    evolucion: evolucionData,
    topPedidosYa:
      topPedidosYaData,
    saboresPedidosYa: sabores,
    costosSaboresPedidosYa:
      costosSabores,
    insights: insightsCalculados,
  })
);
    } catch (error: any) {
      console.error(error);
      setMensaje(error?.message || "Error cargando dashboard");
    }
  }

  function moneda(valor: number) {
    return `$${Math.round(Number(valor || 0)).toLocaleString("es-UY")}`;
  }

  function porcentaje(valor: number) {
    return `${Number(valor || 0).toFixed(1)}%`;
  }

  function variacionPorcentual(actual: number, anterior?: number | null) {
    if (!anterior || anterior === 0) return null;
    return ((actual - anterior) / anterior) * 100;
  }

  function variacionPuntos(actual: number, anterior?: number | null) {
    if (anterior === null || anterior === undefined) return null;
    return actual - anterior;
  }

  function textoVariacion(valor: number | null, tipo: "porcentaje" | "puntos" | "moneda") {
    if (valor === null || Number.isNaN(valor)) return "";

    const signo = valor >= 0 ? "▲" : "▼";
    const abs = Math.abs(valor);

    if (tipo === "puntos") {
      return `${signo} ${abs.toFixed(1)} pts`;
    }

    if (tipo === "moneda") {
      return `${signo} ${moneda(abs)}`;
    }

    return `${signo} ${abs.toFixed(1)}%`;
  }

  function colorVariacion(valor: number | null) {
    if (valor === null || Number.isNaN(valor)) return "#cbd5e1";
    return valor >= 0 ? "#86efac" : "#fca5a5";
  }

  const periodoActual = periodos.find((p) => p.id === periodoId);
  function tituloVista() {
  if (modoAnalisis === "personalizado") {
    const desde = periodos.find((p) => p.id === periodoDesdeId);
    const hasta = periodos.find((p) => p.id === periodoHastaId);

    if (!desde || !hasta) {
      return "Rango personalizado";
    }

    if (desde.id === hasta.id) {
      return desde.nombre;
    }

    return `${desde.nombre} a ${hasta.nombre}`;
  }

  if (!periodoActual) {
    return "-";
  }

  const anio = Number(periodoActual.anio);
  const mes = Number(periodoActual.mes);

  if (modoAnalisis === "trimestral") {
    const trimestre = Math.floor((mes - 1) / 3) + 1;
    return `${trimestre}° trimestre ${anio}`;
  }

  if (modoAnalisis === "anual") {
    return `Año ${anio}`;
  }

  return periodoActual.nombre;
}

function textoComparacion() {
  if (!anterior) {
    return " · Sin comparación disponible";
  }

  if (modoAnalisis === "trimestral") {
    return " · Comparado con el trimestre anterior";
  }

  if (modoAnalisis === "anual") {
    return " · Comparado con el año anterior";
  }

  if (modoAnalisis === "personalizado") {
    return " · Comparado con un rango anterior de igual duración";
  }

  return " · Comparado con el mes anterior";
}
  const empresaActual = empresas.find((e) => e.id === empresaId);
  const sucursalActual = sucursales.find((s) => s.id === sucursalId);
  const resumen = comparativo?.actual || null;
  const anterior = comparativo?.anterior || null;

  return (
    <div>
      <div style={titleRow}>
  <h2 style={title}>Dashboard Ejecutivo</h2>

  <button
    type="button"
    style={pdfButton}
    onClick={() => window.print()}
  >
    Exportar PDF
  </button>
  <button
  type="button"
  style={pdfButton}
  onClick={() => cargarDashboard(true)}
>
  Actualizar datos
</button>
</div>

      <section style={card}>
        <h3>Vista</h3>
        <div className="printHeader">
  <div>
    <strong>Empresa</strong>
    <br />
    {empresaActual?.nombre}
  </div>

  <div>
    <strong>Período</strong>
    <br />
    {tituloVista()}
  </div>

  <div>
    <strong>Sucursal</strong>
    <br />
    {sucursalActual?.nombre || "Todas"}
  </div>
</div>  
        <div style={filtersGrid} className="no-print">
  <div>
    <label style={label}>Tipo de análisis</label>
    <select
      style={input}
      value={modoAnalisis}
      onChange={(e) =>
        setModoAnalisis(
          e.target.value as
            | "mensual"
            | "trimestral"
            | "anual"
            | "personalizado"
        )
      }
    >
      <option value="mensual">Mensual</option>
      <option value="trimestral">Trimestral</option>
      <option value="anual">Anual</option>
      <option value="personalizado">Personalizado</option>
    </select>
  </div>

  <div>
    <label style={label}>Empresa</label>
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
  </div>

  {modoAnalisis === "personalizado" ? (
  <>
    <div>
      <label style={label}>Desde</label>
      <select
        style={input}
        value={periodoDesdeId}
        onChange={(e) => setPeriodoDesdeId(e.target.value)}
      >
        {periodos.map((periodo) => (
          <option key={periodo.id} value={periodo.id}>
            {periodo.nombre}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label style={label}>Hasta</label>
      <select
        style={input}
        value={periodoHastaId}
        onChange={(e) => setPeriodoHastaId(e.target.value)}
      >
        {periodos.map((periodo) => (
          <option key={periodo.id} value={periodo.id}>
            {periodo.nombre}
          </option>
        ))}
      </select>
    </div>
  </>
) : (
  <div>
    <label style={label}>
      {modoAnalisis === "trimestral"
        ? "Trimestre"
        : modoAnalisis === "anual"
        ? "Año"
        : "Período"}
    </label>

    <select
      style={input}
      value={periodoId}
      onChange={(e) => setPeriodoId(e.target.value)}
    >
      {modoAnalisis === "mensual" ? (
        periodos.map((periodo) => (
          <option key={periodo.id} value={periodo.id}>
            {periodo.nombre}
          </option>
        ))
      ) : modoAnalisis === "trimestral" ? (
        Array.from(
          new Map(
            periodos.map((periodo) => {
              const trimestre =
                Math.floor((Number(periodo.mes) - 1) / 3) + 1;
              const clave = `${periodo.anio}-${trimestre}`;

              return [
                clave,
                {
                  id: periodo.id,
                  nombre: `${trimestre}° trimestre ${periodo.anio}`,
                },
              ];
            })
          ).values()
        ).map((item) => (
          <option key={item.nombre} value={item.id}>
            {item.nombre}
          </option>
        ))
      ) : (
        Array.from(
          new Map(
            periodos.map((periodo) => [
              String(periodo.anio),
              {
                id: periodo.id,
                nombre: String(periodo.anio),
              },
            ])
          ).values()
        ).map((item) => (
          <option key={item.nombre} value={item.id}>
            {item.nombre}
          </option>
        ))
      )}
    </select>
  </div>
)}

  <div>
    <label style={label}>Sucursal</label>
    <select
      style={input}
      value={sucursalId}
      onChange={(e) => setSucursalId(e.target.value)}
    >
      <option value="">Todas</option>
      {sucursales.map((sucursal) => (
        <option key={sucursal.id} value={sucursal.id}>
          {sucursal.nombre}
        </option>
      ))}
    </select>
  </div>
</div>

<p style={hint} className="no-print">
  Mostrando {tituloVista()} ·{" "}
  {sucursalActual?.nombre || "Todas las sucursales"}
  {textoComparacion()}
</p>

        {mensaje && <p>{mensaje}</p>}
      </section>
<ExecutiveSummary insights={insights} />

{!resumen ? (
  <section style={card}>
    <p>No hay datos calculados para este período todavía.</p>
  </section>
) : (
  <>
    <section style={card}>
      <h3>Resultado del negocio</h3>

            <div style={metricGrid}>
              <Metric
                title="Facturación total"
                value={moneda(resumen.ventas_totales)}
                variation={textoVariacion(
                  variacionPorcentual(resumen.ventas_totales, anterior?.ventas_totales),
                  "porcentaje"
                )}
                variationColor={colorVariacion(
                  variacionPorcentual(resumen.ventas_totales, anterior?.ventas_totales)
                )}
              />

              <Metric
                title="Costo"
                value={moneda(resumen.costo_total)}
                variation={textoVariacion(
                  variacionPorcentual(resumen.costo_total, anterior?.costo_total),
                  "porcentaje"
                )}
                variationColor={colorVariacion(
                  variacionPorcentual(resumen.costo_total, anterior?.costo_total)
                )}
              />

              <Metric
                title="Ganancia bruta"
                value={moneda(resumen.margen_total)}
                variation={textoVariacion(
                  variacionPorcentual(resumen.margen_total, anterior?.margen_total),
                  "porcentaje"
                )}
                variationColor={colorVariacion(
                  variacionPorcentual(resumen.margen_total, anterior?.margen_total)
                )}
              />

              {resumen.es_restaurante && (
                <Metric
                  title="Facturación PedidosYa"
                  value={moneda(resumen.ventas_pedidosya)}
                />
              )}

              <Metric
                title="Margen"
                value={porcentaje(resumen.margen_porcentaje)}
                variation={textoVariacion(
                  variacionPuntos(resumen.margen_porcentaje, anterior?.margen_porcentaje),
                  "puntos"
                )}
                variationColor={colorVariacion(
                  variacionPuntos(resumen.margen_porcentaje, anterior?.margen_porcentaje)
                )}
              />

              <Metric title="Productos vendidos" value={resumen.productos_vendidos} />

              <Metric
                title="Productos sin revisar"
                value={resumen.productos_sin_revisar}
              />
            </div>
          </section>

          <section style={card}>
            <h3>PedidoYa</h3>

            <div style={metricGrid}>
  {resumen.es_restaurante ? (
    <>
      <Metric
        title="Facturación bruta PedidosYa"
        value={moneda(
          resumen.ventas_brutas_pedidosya
        )}
      />

      <Metric
        title="Descuentos financiados por Duna"
        value={moneda(
          resumen.descuento_local_pedidosya
        )}
      />

      <Metric
        title="Venta efectiva PedidosYa"
        value={moneda(
          resumen.ventas_pedidosya
        )}
        variation={textoVariacion(
          variacionPorcentual(
            resumen.ventas_pedidosya,
            anterior?.ventas_pedidosya
          ),
          "porcentaje"
        )}
        variationColor={colorVariacion(
          variacionPorcentual(
            resumen.ventas_pedidosya,
            anterior?.ventas_pedidosya
          )
        )}
      />

      <Metric
        title="Pedidos entregados"
        value={resumen.pedidos_pedidosya}
      />

      <Metric
        title="Ticket efectivo promedio"
        value={moneda(
          resumen.ticket_pedidosya
        )}
      />

      <Metric
        title="Participación"
        value={porcentaje(
          resumen.participacion_pedidosya
        )}
      />

      <Metric
        title="Comisión PedidosYa 23%"
        value={moneda(
          resumen.comision_pedidosya
        )}
      />

      <Metric
        title="IVA de la comisión"
        value={moneda(
          resumen.iva_comision_pedidosya
        )}
      />

      <Metric
        title="Comisión 23% + IVA"
        value={moneda(
          resumen.comision_mas_iva_pedidosya
        )}
      />

      <Metric
        title="Tarifa de pago en línea"
        value={moneda(
          resumen.tarifa_pago_linea_pedidosya
        )}
      />

      <Metric
        title="Retención recuperable"
        value={moneda(
          resumen.retencion_recuperable_pedidosya
        )}
      />

      <Metric
        title="Costo de productos"
        value={moneda(
          resumen.costo_productos_pedidosya
        )}
      />

      <Metric
        title="Ganancia neta PedidosYa"
        value={moneda(
          resumen.margen_pedidosya
        )}
      />

      <Metric
        title="Margen neto PedidosYa"
        value={porcentaje(
          resumen.margen_porcentaje_pedidosya
        )}
      />
    </>
  ) : (
    <>
      <Metric
        title="Facturación PedidosYa"
        value={moneda(
          resumen.ventas_pedidosya
        )}
      />

      <Metric
        title="Pedidos"
        value={resumen.pedidos_pedidosya}
      />

      <Metric
        title="Ticket promedio"
        value={moneda(
          resumen.ticket_pedidosya
        )}
      />

      <Metric
        title="Delivery"
        value={moneda(
          resumen.delivery_pedidosya
        )}
      />

      <Metric
        title="Pickup"
        value={moneda(
          resumen.pickup_pedidosya
        )}
      />

      <Metric
        title="Participación"
        value={porcentaje(
          resumen.participacion_pedidosya
        )}
      />
    </>
  )}
</div>

            {resumen.es_restaurante && topPedidosYa.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4>Top 5 más vendidos por PedidosYa</h4>
                <div style={pyTableHeader}>
                  <strong>Producto</strong>
                  <strong>Unidades</strong>
                  <strong>Facturación</strong>
                  <strong>Ganancia</strong>
                </div>
                {topPedidosYa.map((item, index) => (
                  <div key={item.nombre} style={pyTableRow}>
                    <span>{index + 1}. {item.nombre}</span>
                    <span>{item.cantidad.toLocaleString("es-UY")}</span>
                    <span>{moneda(item.ventas)}</span>
                    <span>{moneda(item.margen)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

{!resumen.es_restaurante && (
  <>
    <SaboresPedidosYa sabores={saboresPedidosYa} />
    <RentabilidadSaboresPedidosYa resumen={costosSaboresPedidosYa} />
  </>
)}

          <section style={card}>
            <h3>Canales</h3>

            <div style={metricGrid}>
              <Metric
                title={resumen.es_restaurante ? "Facturación total" : "Total Isatech"}
                value={moneda(
                  resumen.es_restaurante
                    ? resumen.ventas_totales
                    : resumen.ventas_totales
                )}
              />
              <Metric title="PedidoYa" value={moneda(resumen.ventas_pedidosya)} />
              <Metric
                title={resumen.es_restaurante ? "Paradise" : "Ventas directas"}
                value={moneda(resumen.ventas_directas)}
              />
              <Metric
                title="% PedidoYa"
                value={porcentaje(resumen.participacion_pedidosya)}
              />
              <Metric
                title={resumen.es_restaurante ? "% Paradise" : "% Ventas directas"}
                value={porcentaje(resumen.participacion_directas)}
              />
            </div>
          </section>

          {!resumen.es_restaurante && <section style={card}>
            <h3>Producción</h3>

            <div style={metricGrid}>
              <Metric
                title="Kg producidos"
                value={Number(resumen.kilos_producidos).toLocaleString("es-UY")}
                variation={textoVariacion(
                  variacionPorcentual(resumen.kilos_producidos, anterior?.kilos_producidos),
                  "porcentaje"
                )}
                variationColor={colorVariacion(
                  variacionPorcentual(resumen.kilos_producidos, anterior?.kilos_producidos)
                )}
              />

              <Metric
                title="Costo promedio/kg"
                value={moneda(resumen.costo_promedio_kg)}
                variation={textoVariacion(
                  variacionPorcentual(resumen.costo_promedio_kg, anterior?.costo_promedio_kg),
                  "porcentaje"
                )}
                variationColor={colorVariacion(
                  variacionPorcentual(resumen.costo_promedio_kg, anterior?.costo_promedio_kg)
                )}
              />

              <Metric title="Sabores producidos" value={resumen.sabores_producidos} />
            </div>
            {evolucion.length > 0 && (
  <section style={card}>
    <h3>Evolución del período</h3>

    <EvolucionChart
      datos={evolucion}
      moneda={moneda}
    />
  </section>
)}
          </section>}

          <section style={card}>
            <h3>Rankings</h3>

            <div style={rankingGrid}>
              <div>
                <h4>Top margen bruto</h4>
                {topRentabilidad.length === 0 ? (
                  <p>Sin datos</p>
                ) : (
                  topRentabilidad.map((item, index) => (
                    <div key={item.nombre} style={row}>
                      <strong>
                        {index + 1}. {item.nombre}
                      </strong>
                      <span>{moneda(item.valor)}</span>
                    </div>
                  ))
                )}
              </div>

              <div>
                <h4>Top facturación</h4>
                {topFacturacion.length === 0 ? (
                  <p>Sin datos</p>
                ) : (
                  topFacturacion.map((item, index) => (
                    <div key={item.nombre} style={row}>
                      <strong>
                        {index + 1}. {item.nombre}
                      </strong>
                      <span>{moneda(item.valor)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section style={card}>
            <h3>Observaciones automáticas</h3>

            <div style={alerts}>
              {resumen.productos_sin_revisar > 0 && (
                <div style={alertItem}>
                  ⚠ Hay {resumen.productos_sin_revisar} productos sin revisar en
                  Vinculaciones.
                </div>
              )}

              {resumen.participacion_pedidosya > 0 && (
                <div style={alertItem}>
                  🛵 PedidoYa representa{" "}
                  {porcentaje(resumen.participacion_pedidosya)} de la facturación.
                </div>
              )}

              {anterior && resumen.ventas_totales > anterior.ventas_totales && (
                <div style={alertItem}>
                  📈 La facturación aumentó{" "}
                  {textoVariacion(
                    variacionPorcentual(resumen.ventas_totales, anterior.ventas_totales),
                    "porcentaje"
                  )}{" "}
                  contra el período anterior.
                </div>
              )}

              {resumen.margen_porcentaje > 0 && resumen.margen_porcentaje < 50 && (
                <div style={alertItem}>⚠ El margen bruto está por debajo del 50%.</div>
              )}

              {resumen.margen_porcentaje >= 50 && (
                <div style={alertItem}>
                  ✅ Margen bruto del período: {porcentaje(resumen.margen_porcentaje)}.
                </div>
              )}

              {resumen.kilos_producidos > 0 && (
                <div style={alertItem}>
                  🍦 Se produjeron{" "}
                  {Number(resumen.kilos_producidos).toLocaleString("es-UY")} kg en el
                  período.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function EvolucionChart({
  datos,
  moneda,
}: {
  datos: EvolucionDashboardItem[];
  moneda: (valor: number) => string;
}) {
  const anchoPorMes = 140;
  const anchoTotal = Math.max(720, datos.length * anchoPorMes);
  const altoGrafico = 240;

  const maxVentas = Math.max(
    1,
    ...datos.map((item) => Number(item.ventas || 0))
  );

  const margenesPorcentaje = datos.map((item) =>
    Number(item.ventas || 0) > 0
      ? (Number(item.margen || 0) / Number(item.ventas || 0)) * 100
      : 0
  );

  const maxMargen = Math.max(100, ...margenesPorcentaje);

  const puntosMargen = margenesPorcentaje
    .map((margen, index) => {
      const x = index * anchoPorMes + anchoPorMes / 2;
      const y = 25 + (1 - margen / maxMargen) * 170;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <div style={chartLegend}>
        <div style={legendItem}>
          <span
            style={{
              ...legendSwatch,
              background: "#2563eb",
            }}
          />
          Facturación
        </div>

        <div style={legendItem}>
          <span
            style={{
              ...legendSwatch,
              background: "#22c55e",
            }}
          />
          Margen bruto %
        </div>
      </div>

      <div style={chartViewport}>
        <div
          style={{
            ...chartInner,
            width: anchoTotal,
          }}
        >
          <div style={chartBars}>
            {datos.map((item, index) => {
              const alturaBarra = Math.max(
                4,
                (Number(item.ventas || 0) / maxVentas) * 210
              );

              const margenPorcentaje = margenesPorcentaje[index];

              return (
                <div
                  key={item.periodo_id}
                  style={{
                    ...chartColumn,
                    width: anchoPorMes,
                  }}
                >
                  <span style={chartValue}>
                    {moneda(item.ventas)}
                  </span>

                  <div style={chartBarArea}>
                    <div
                      style={{
                        ...chartBar,
                        height: `${alturaBarra}px`,
                      }}
                      title={`${item.nombre}: ${moneda(item.ventas)}`}
                    />
                  </div>

                  <strong style={chartLabel}>
                    {item.nombre}
                  </strong>

                  <small style={chartDetail}>
                    Margen: {moneda(item.margen)}
                  </small>

                  <small style={chartMarginDetail}>
                    {margenPorcentaje.toFixed(1)}%
                  </small>
                </div>
              );
            })}
          </div>

          <svg
            style={chartLine}
            viewBox={`0 0 ${anchoTotal} ${altoGrafico}`}
            preserveAspectRatio="none"
          >
            <polyline
              points={puntosMargen}
              fill="none"
              stroke="#22c55e"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {margenesPorcentaje.map((margen, index) => {
              const x = index * anchoPorMes + anchoPorMes / 2;
              const y = 25 + (1 - margen / maxMargen) * 170;

              return (
                <g key={`${datos[index].periodo_id}-margen`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#22c55e"
                    stroke="#0f172a"
                    strokeWidth="2"
                  />

                  <text
                    x={x}
                    y={y - 11}
                    textAnchor="middle"
                    fill="#86efac"
                    fontSize="12"
                    fontWeight="700"
                  >
                    {margen.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
function Metric({
  title,
  value,
  variation,
  variationColor,
}: {
  title: string;
  value: string | number;
  variation?: string;
  variationColor?: string;
}) {
  return (
    <div style={metricCard}>
      <strong>{title}</strong>
      <span>{value}</span>
      {variation && <small style={{ color: variationColor || "#cbd5e1" }}>{variation}</small>}
    </div>
  );
}

const title: React.CSSProperties = {
  marginTop: 0,
};

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  marginTop: 24,
  borderRadius: 16,
};

const filtersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: 12,
  alignItems: "end",
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#cbd5e1",
  fontSize: 14,
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  borderRadius: 8,
};

const hint: React.CSSProperties = {
  marginTop: 12,
  color: "#cbd5e1",
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

const rankingGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 140px",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #334155",
};

const alerts: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const alertItem: React.CSSProperties = {
  background: "#0f172a",
  padding: 14,
  borderRadius: 10,
  border: "1px solid #334155",
};
const chartLegend: React.CSSProperties = {
  display: "flex",
  gap: 24,
  alignItems: "center",
  marginBottom: 16,
  color: "#cbd5e1",
  fontSize: 14,
};

const legendItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const legendSwatch: React.CSSProperties = {
  display: "inline-block",
  width: 14,
  height: 14,
  borderRadius: 4,
};

const chartViewport: React.CSSProperties = {
  overflowX: "auto",
  paddingBottom: 8,
};

const chartInner: React.CSSProperties = {
  position: "relative",
  minHeight: 360,
};

const chartBars: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  minHeight: 360,
};

const chartColumn: React.CSSProperties = {
  flexShrink: 0,
  display: "grid",
  justifyItems: "center",
  gap: 7,
  position: "relative",
  zIndex: 1,
};

const chartBarArea: React.CSSProperties = {
  height: 220,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  borderBottom: "1px solid #475569",
};

const chartBar: React.CSSProperties = {
  width: "55%",
  maxWidth: 70,
  minWidth: 34,
  background: "#2563eb",
  borderRadius: "8px 8px 0 0",
  transition: "height 0.25s ease",
};

const chartLine: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 18,
  width: "100%",
  height: 240,
  zIndex: 2,
  pointerEvents: "none",
  overflow: "visible",
};

const chartValue: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const chartLabel: React.CSSProperties = {
  textAlign: "center",
  fontSize: 13,
};

const chartDetail: React.CSSProperties = {
  color: "#cbd5e1",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const chartMarginDetail: React.CSSProperties = {
  color: "#86efac",
  fontWeight: 700,
  textAlign: "center",
};

const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  marginBottom: 24,
};

const pdfButton: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const pyTableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 100px 130px 130px",
  gap: 12,
  padding: "10px 0",
  borderBottom: "2px solid #475569",
};

const pyTableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 100px 130px 130px",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #334155",
};
export default DashboardPage;