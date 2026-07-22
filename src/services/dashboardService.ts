import { supabase } from "../lib/supabase";

export type DashboardResumen = {
  ventas_totales: number;
  costo_total: number;
  margen_total: number;
  margen_porcentaje: number;
  productos_vendidos: number;
  pedidos_pedidosya: number;
  ventas_pedidosya: number;
  ticket_pedidosya: number;
  delivery_pedidosya: number;
  pickup_pedidosya: number;
  participacion_pedidosya: number;
  ventas_directas: number;
  participacion_directas: number;
  kilos_producidos: number;
  costo_promedio_kg: number;
  sabores_producidos: number;
  productos_sin_revisar: number;
  costos_canal: number;
  ventas_paradise: number;
  es_restaurante: boolean;
  costo_productos_pedidosya: number;
  margen_pedidosya: number;
  margen_porcentaje_pedidosya: number;
};

export type DashboardComparativo = {
  actual: DashboardResumen;
  anterior: DashboardResumen | null;
};
export type EvolucionDashboardItem = {
  periodo_id: string;
  nombre: string;
  anio: number;
  mes: number;
  ventas: number;
  costo: number;
  margen: number;
};
export type RankingItem = {
  nombre: string;
  valor: number;
};
export type RankingCanalItem = {
  nombre: string;
  cantidad: number;
  ventas: number;
  margen: number;
};

function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  }
async function obtenerPeriodoAnterior(
  periodoId: string,
  empresaId: string
) {
  const { data: periodo, error } = await supabase
    .from("periodos")
    .select("*")
    .eq("id", periodoId)
    .single();

  if (error) throw error;

  const fechaAnterior = new Date(
    Number(periodo.anio),
    Number(periodo.mes) - 2,
    1
  );

  const anioAnterior = fechaAnterior.getFullYear();
  const mesAnterior = fechaAnterior.getMonth() + 1;

  const { data: anterior, error: errorAnterior } = await supabase
    .from("periodos")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("anio", anioAnterior)
    .eq("mes", mesAnterior)
    .maybeSingle();

  if (errorAnterior) throw errorAnterior;

  return anterior || null;
}

export async function obtenerDashboardResumen(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
}): Promise<DashboardResumen> {
  const { data: periodo, error: periodoError } = await supabase
    .from("periodos")
    .select("*")
    .eq("id", input.periodo_id)
    .single();

  if (periodoError) throw periodoError;

  let rentabilidadQuery = supabase
    .from("rentabilidad_periodo")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    rentabilidadQuery = rentabilidadQuery.eq("sucursal_id", input.sucursal_id);
  }

  const { data: rentabilidad, error: rentabilidadError } = await rentabilidadQuery;
  if (rentabilidadError) throw rentabilidadError;

  const { data: fuentes, error: fuentesError } = await supabase
    .from("producto_ventas_resumen")
    .select("fuente")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (fuentesError) throw fuentesError;

  let ventasPyQuery = supabase
    .from("ventas")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .or(
      `periodo_id.eq.${input.periodo_id},and(periodo_anio.eq.${periodo.anio},periodo_mes.eq.${periodo.mes})`
    );

  if (input.sucursal_id) {
    ventasPyQuery = ventasPyQuery.eq("sucursal_id", input.sucursal_id);
  }

  const { data: ventasPy, error: ventasPyError } = await ventasPyQuery;
  if (ventasPyError) throw ventasPyError;

  let pedidosDetalleQuery = supabase
    .from("pedidosya_pedidos")
    .select("id")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);
  if (input.sucursal_id) {
    pedidosDetalleQuery = pedidosDetalleQuery.eq("sucursal_id", input.sucursal_id);
  }
  const { data: pedidosDetalle, error: pedidosDetalleError } = await pedidosDetalleQuery;
  if (pedidosDetalleError) throw pedidosDetalleError;

  const { data: elaboraciones, error: elaboracionesError } = await supabase
    .from("elaboraciones")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (elaboracionesError) throw elaboracionesError;

  const { data: recetas, error: recetasError } = await supabase
    .from("recetas")
    .select("*")
    .eq("empresa_id", input.empresa_id);

  if (recetasError) throw recetasError;

  const { error: reglasError } = await supabase
    .from("producto_costo")
    .select("*")
    .eq("empresa_id", input.empresa_id);

  if (reglasError) throw reglasError;

  const ventasTotales = (rentabilidad || []).reduce(
    (acc, item: any) => acc + Number(item.ventas || 0),
    0
  );

  const costoTotal = (rentabilidad || []).reduce(
    (acc, item: any) => acc + Number(item.costo_total || 0),
    0
  );

  const margenTotal = (rentabilidad || []).reduce(
    (acc, item: any) => acc + Number(item.margen || 0),
    0
  );
  const costosCanal = (rentabilidad || []).reduce(
    (acc, item: any) => acc + Number(item.comision || 0),
    0
  );
  const esRestaurante = (fuentes || []).some(
    (item: any) => item.fuente === "Paradise"
  );
  const ventasPedidosYaRentabilidad = (rentabilidad || [])
    .filter((item: any) => item.canal === "PedidosYa")
    .reduce((acc: number, item: any) => acc + Number(item.ventas || 0), 0);
  const ventasParadise = (rentabilidad || [])
    .filter((item: any) => item.canal === "Paradise")
    .reduce((acc: number, item: any) => acc + Number(item.ventas || 0), 0);
  const filasPedidosYa = (rentabilidad || []).filter(
    (item: any) => item.canal === "PedidosYa"
  );
  const costoProductosPedidosYa = filasPedidosYa.reduce(
    (acc: number, item: any) => acc + Number(item.costo_total || 0), 0
  );
  const margenPedidosYa = filasPedidosYa.reduce(
    (acc: number, item: any) => acc + Number(item.margen || 0), 0
  );

  const pedidosPedidosYaOriginal = (ventasPy || []).reduce(
    (acc, item: any) => acc + Number(item.pedidos || 0),
    0
  );

  const ventasPedidosYaOriginal = (ventasPy || []).reduce(
    (acc, item: any) => acc + Number(item.ventas || item.total || 0),
    0
  );
  const pedidosPedidosYa = esRestaurante
    ? (pedidosDetalle || []).length
    : pedidosPedidosYaOriginal;
  const ventasPedidosYa = esRestaurante
    ? ventasPedidosYaRentabilidad
    : ventasPedidosYaOriginal;

  const deliveryPedidosYa = (ventasPy || []).reduce(
    (acc, item: any) => acc + Number(item.delivery || 0),
    0
  );

  const pickupPedidosYa = (ventasPy || []).reduce(
    (acc, item: any) => acc + Number(item.pickup || 0),
    0
  );

  const recetasPorNombre = new Map<string, any>();
  const recetasPorId = new Map<string, any>();
  for (const receta of recetas || []) {
    recetasPorNombre.set(normalizar(receta.nombre), receta);
    recetasPorId.set(receta.id, receta);
  }

  let kilosProducidos = 0;
  let kilosConCosto = 0;
  let costoProduccion = 0;

  for (const elaboracion of elaboraciones || []) {
    const kilos = Number(elaboracion.kilos || 0);
    if (kilos <= 0) continue;

    let receta = elaboracion.receta_id
      ? recetasPorId.get(elaboracion.receta_id)
      : null;

    if (!receta && elaboracion.producto) {
      receta = recetasPorNombre.get(normalizar(elaboracion.producto));
    }

    if (!receta && elaboracion.producto_original) {
      receta = recetasPorNombre.get(
        normalizar(elaboracion.producto_original)
      );
    }

    const costoKg = Number(receta?.costo_kg || 0);

    kilosProducidos += kilos;

    if (costoKg > 0) {
      kilosConCosto += kilos;
      costoProduccion += kilos * costoKg;
    }
  }

  const saboresProducidos = new Set(
    (elaboraciones || []).map((item: any) => item.producto)
  ).size;

  const costoPromedioKg =
    kilosConCosto > 0 ? costoProduccion / kilosConCosto : 0;

  const productosSinRevisar = (rentabilidad || []).filter(
    (r: any) => r.tipo_calculo === "sin_costo"
  ).length;

  const ventasDirectas = Math.max(ventasTotales - ventasPedidosYa, 0);

  return {
    ventas_totales: ventasTotales,
    costo_total: costoTotal,
    margen_total: margenTotal,
    margen_porcentaje: ventasTotales > 0 ? (margenTotal / ventasTotales) * 100 : 0,
    productos_vendidos: rentabilidad?.length || 0,

    pedidos_pedidosya: pedidosPedidosYa,
    ventas_pedidosya: ventasPedidosYa,
    ticket_pedidosya: pedidosPedidosYa > 0 ? ventasPedidosYa / pedidosPedidosYa : 0,
    delivery_pedidosya: deliveryPedidosYa,
    pickup_pedidosya: pickupPedidosYa,
    participacion_pedidosya:
      ventasTotales > 0 ? (ventasPedidosYa / ventasTotales) * 100 : 0,
    ventas_directas: ventasDirectas,
    participacion_directas:
      ventasTotales > 0 ? (ventasDirectas / ventasTotales) * 100 : 0,

    kilos_producidos: kilosProducidos,
    costo_promedio_kg: costoPromedioKg,
    sabores_producidos: saboresProducidos,

    productos_sin_revisar: productosSinRevisar,
    costos_canal: costosCanal,
    ventas_paradise: ventasParadise,
    es_restaurante: esRestaurante,
    costo_productos_pedidosya: costoProductosPedidosYa,
    margen_pedidosya: margenPedidosYa,
    margen_porcentaje_pedidosya:
      ventasPedidosYa > 0 ? (margenPedidosYa / ventasPedidosYa) * 100 : 0,
  };
}
function sumarResumenes(resumenes: DashboardResumen[]): DashboardResumen {
  const ventasTotales = resumenes.reduce(
    (total, item) => total + Number(item.ventas_totales || 0),
    0
  );

  const costoTotal = resumenes.reduce(
    (total, item) => total + Number(item.costo_total || 0),
    0
  );

  const margenTotal = resumenes.reduce(
    (total, item) => total + Number(item.margen_total || 0), 0
  );
  const costosCanal = resumenes.reduce(
    (total, item) => total + Number(item.costos_canal || 0), 0
  );

  const pedidosPedidosYa = resumenes.reduce(
    (total, item) => total + Number(item.pedidos_pedidosya || 0),
    0
  );

  const ventasPedidosYa = resumenes.reduce(
    (total, item) => total + Number(item.ventas_pedidosya || 0),
    0
  );

  const deliveryPedidosYa = resumenes.reduce(
    (total, item) => total + Number(item.delivery_pedidosya || 0),
    0
  );

  const pickupPedidosYa = resumenes.reduce(
    (total, item) => total + Number(item.pickup_pedidosya || 0),
    0
  );

  const kilosProducidos = resumenes.reduce(
    (total, item) => total + Number(item.kilos_producidos || 0),
    0
  );

  const costoProduccionPonderado = resumenes.reduce(
    (total, item) =>
      total +
      Number(item.costo_promedio_kg || 0) *
        Number(item.kilos_producidos || 0),
    0
  );

  const ventasDirectas = Math.max(ventasTotales - ventasPedidosYa, 0);

  return {
    ventas_totales: ventasTotales,
    costo_total: costoTotal,
    margen_total: margenTotal,
    margen_porcentaje:
      ventasTotales > 0 ? (margenTotal / ventasTotales) * 100 : 0,

    productos_vendidos: resumenes.reduce(
      (total, item) => total + Number(item.productos_vendidos || 0),
      0
    ),

    pedidos_pedidosya: pedidosPedidosYa,
    ventas_pedidosya: ventasPedidosYa,
    ticket_pedidosya:
      pedidosPedidosYa > 0 ? ventasPedidosYa / pedidosPedidosYa : 0,
    delivery_pedidosya: deliveryPedidosYa,
    pickup_pedidosya: pickupPedidosYa,
    participacion_pedidosya:
      ventasTotales > 0 ? (ventasPedidosYa / ventasTotales) * 100 : 0,

    ventas_directas: ventasDirectas,
    participacion_directas:
      ventasTotales > 0 ? (ventasDirectas / ventasTotales) * 100 : 0,

    kilos_producidos: kilosProducidos,
    costo_promedio_kg:
      kilosProducidos > 0
        ? costoProduccionPonderado / kilosProducidos
        : 0,

    sabores_producidos: Math.max(
      0,
      ...resumenes.map((item) => Number(item.sabores_producidos || 0))
    ),

    productos_sin_revisar: Math.max(
      0,
      ...resumenes.map((item) => Number(item.productos_sin_revisar || 0))
    ),
    costos_canal: costosCanal,
    ventas_paradise: resumenes.reduce(
      (total, item) => total + Number(item.ventas_paradise || 0), 0
    ),
    es_restaurante: resumenes.some((item) => item.es_restaurante),
    costo_productos_pedidosya: resumenes.reduce(
      (total, item) => total + Number(item.costo_productos_pedidosya || 0), 0
    ),
    margen_pedidosya: resumenes.reduce(
      (total, item) => total + Number(item.margen_pedidosya || 0), 0
    ),
    margen_porcentaje_pedidosya:
      ventasPedidosYa > 0
        ? (resumenes.reduce((total, item) => total + Number(item.margen_pedidosya || 0), 0) /
            ventasPedidosYa) * 100
        : 0,
  };
}

async function obtenerPeriodosDelRango(input: {
  empresa_id: string;
  anio: number;
  mes_desde: number;
  mes_hasta: number;
}) {
  const { data, error } = await supabase
    .from("periodos")
    .select("id, anio, mes")
    .eq("empresa_id", input.empresa_id)
    .eq("anio", input.anio)
    .gte("mes", input.mes_desde)
    .lte("mes", input.mes_hasta)
    .order("mes", { ascending: true });

  if (error) throw error;

  return data || [];
}
async function obtenerPeriodosPersonalizados(input: {
  empresa_id: string;
  periodo_desde_id: string;
  periodo_hasta_id: string;
}) {
  const { data, error } = await supabase
    .from("periodos")
    .select("id, anio, mes")
    .eq("empresa_id", input.empresa_id)
    .order("anio", { ascending: true })
    .order("mes", { ascending: true });

  if (error) throw error;

  const periodos = data || [];

  const indiceDesde = periodos.findIndex(
    (periodo) => periodo.id === input.periodo_desde_id
  );

  const indiceHasta = periodos.findIndex(
    (periodo) => periodo.id === input.periodo_hasta_id
  );

  if (indiceDesde === -1 || indiceHasta === -1) {
    throw new Error("No se pudo identificar el rango personalizado.");
  }

  const inicio = Math.min(indiceDesde, indiceHasta);
  const fin = Math.max(indiceDesde, indiceHasta);

  const actuales = periodos.slice(inicio, fin + 1);
  const cantidadMeses = actuales.length;

  const inicioAnterior = inicio - cantidadMeses;

  const anteriores =
    inicioAnterior >= 0
      ? periodos.slice(inicioAnterior, inicio)
      : [];

  return {
    actuales,
    anteriores:
      anteriores.length === cantidadMeses ? anteriores : [],
  };
}
async function obtenerResumenDePeriodos(input: {
  empresa_id: string;
  sucursal_id?: string | null;
  periodos: Array<{ id: string }>;
}) {
  if (input.periodos.length === 0) return null;

  const resumenes = await Promise.all(
    input.periodos.map((periodo) =>
      obtenerDashboardResumen({
        empresa_id: input.empresa_id,
        periodo_id: periodo.id,
        sucursal_id: input.sucursal_id || null,
      })
    )
  );

  return sumarResumenes(resumenes);
}
export async function obtenerDashboardComparativo(input: {
  empresa_id: string;
periodo_id: string;
sucursal_id?: string | null;
modo?: "mensual" | "trimestral" | "anual" | "personalizado";
periodo_desde_id?: string | null;
periodo_hasta_id?: string | null;
}): Promise<DashboardComparativo> {
  const modo = input.modo || "mensual";

  const { data: periodoSeleccionado, error: periodoError } = await supabase
    .from("periodos")
    .select("id, anio, mes")
    .eq("id", input.periodo_id)
    .single();

  if (periodoError) throw periodoError;

  const anio = Number(periodoSeleccionado.anio);
  const mes = Number(periodoSeleccionado.mes);

  if (modo === "personalizado") {
  if (!input.periodo_desde_id || !input.periodo_hasta_id) {
    throw new Error("Seleccioná el período Desde y el período Hasta.");
  }

  const rango = await obtenerPeriodosPersonalizados({
    empresa_id: input.empresa_id,
    periodo_desde_id: input.periodo_desde_id,
    periodo_hasta_id: input.periodo_hasta_id,
  });

  const actual = await obtenerResumenDePeriodos({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodos: rango.actuales,
  });

  if (!actual) {
    throw new Error("No hay información disponible para el rango seleccionado.");
  }

  const anterior =
    rango.anteriores.length > 0
      ? await obtenerResumenDePeriodos({
          empresa_id: input.empresa_id,
          sucursal_id: input.sucursal_id || null,
          periodos: rango.anteriores,
        })
      : null;

  return {
    actual,
    anterior,
  };
}

if (modo === "mensual") {
    const actual = await obtenerDashboardResumen({
      empresa_id: input.empresa_id,
      periodo_id: input.periodo_id,
      sucursal_id: input.sucursal_id || null,
    });

    const periodoAnterior = await obtenerPeriodoAnterior(
      input.periodo_id,
      input.empresa_id
    );

    if (!periodoAnterior) {
      return {
        actual,
        anterior: null,
      };
    }

    const anterior = await obtenerDashboardResumen({
      empresa_id: input.empresa_id,
      periodo_id: periodoAnterior.id,
      sucursal_id: input.sucursal_id || null,
    });

    return {
      actual,
      anterior,
    };
  }

  if (modo === "trimestral") {
    const inicioTrimestre = Math.floor((mes - 1) / 3) * 3 + 1;
    const finTrimestre = inicioTrimestre + 2;

    const fechaTrimestreAnterior = new Date(
      anio,
      inicioTrimestre - 4,
      1
    );

    const anioAnterior = fechaTrimestreAnterior.getFullYear();
    const inicioAnterior = fechaTrimestreAnterior.getMonth() + 1;
    const finAnterior = inicioAnterior + 2;

    const periodosActuales = await obtenerPeriodosDelRango({
      empresa_id: input.empresa_id,
      anio,
      mes_desde: inicioTrimestre,
      mes_hasta: finTrimestre,
    });

    const periodosAnteriores = await obtenerPeriodosDelRango({
      empresa_id: input.empresa_id,
      anio: anioAnterior,
      mes_desde: inicioAnterior,
      mes_hasta: finAnterior,
    });

    const actual = await obtenerResumenDePeriodos({
      empresa_id: input.empresa_id,
      sucursal_id: input.sucursal_id || null,
      periodos: periodosActuales,
    });

    if (!actual) {
      return {
        actual: await obtenerDashboardResumen({
          empresa_id: input.empresa_id,
          periodo_id: input.periodo_id,
          sucursal_id: input.sucursal_id || null,
        }),
        anterior: null,
      };
    }

    const anterior = await obtenerResumenDePeriodos({
      empresa_id: input.empresa_id,
      sucursal_id: input.sucursal_id || null,
      periodos: periodosAnteriores,
    });

    return {
      actual,
      anterior,
    };
  }

  const periodosActuales = await obtenerPeriodosDelRango({
    empresa_id: input.empresa_id,
    anio,
    mes_desde: 1,
    mes_hasta: 12,
  });

  const periodosAnteriores = await obtenerPeriodosDelRango({
    empresa_id: input.empresa_id,
    anio: anio - 1,
    mes_desde: 1,
    mes_hasta: 12,
  });

  const actual = await obtenerResumenDePeriodos({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodos: periodosActuales,
  });

  if (!actual) {
    return {
      actual: await obtenerDashboardResumen({
        empresa_id: input.empresa_id,
        periodo_id: input.periodo_id,
        sucursal_id: input.sucursal_id || null,
      }),
      anterior: null,
    };
  }

  const anterior = await obtenerResumenDePeriodos({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodos: periodosAnteriores,
  });

  return {
    actual,
    anterior,
  };
}
async function obtenerIdsPeriodosParaModo(input: {
  empresa_id: string;
  periodo_id: string;
  modo?: "mensual" | "trimestral" | "anual" | "personalizado";
  periodo_desde_id?: string | null;
  periodo_hasta_id?: string | null;
}) {
  const modo = input.modo || "mensual";

  if (modo === "personalizado") {
  if (!input.periodo_desde_id || !input.periodo_hasta_id) {
    return [];
  }

  const rango = await obtenerPeriodosPersonalizados({
    empresa_id: input.empresa_id,
    periodo_desde_id: input.periodo_desde_id,
    periodo_hasta_id: input.periodo_hasta_id,
  });

  return rango.actuales.map((periodo) => periodo.id);
}

if (modo === "mensual") {
  return [input.periodo_id];
}

  const { data: periodo, error } = await supabase
    .from("periodos")
    .select("anio, mes")
    .eq("id", input.periodo_id)
    .single();

  if (error) throw error;

  const anio = Number(periodo.anio);
  const mes = Number(periodo.mes);

  if (modo === "trimestral") {
    const mesDesde = Math.floor((mes - 1) / 3) * 3 + 1;
    const mesHasta = mesDesde + 2;

    const periodos = await obtenerPeriodosDelRango({
      empresa_id: input.empresa_id,
      anio,
      mes_desde: mesDesde,
      mes_hasta: mesHasta,
    });

    return periodos.map((item) => item.id);
  }

  const periodos = await obtenerPeriodosDelRango({
    empresa_id: input.empresa_id,
    anio,
    mes_desde: 1,
    mes_hasta: 12,
  });

  return periodos.map((item) => item.id);
}
export async function obtenerTopRentabilidad(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
  modo?: "mensual" | "trimestral" | "anual" | "personalizado";
  periodo_desde_id?: string | null;
  periodo_hasta_id?: string | null;
}): Promise<RankingItem[]> {
  const periodoIds = await obtenerIdsPeriodosParaModo(input);

  if (periodoIds.length === 0) return [];

  let query = supabase
    .from("rentabilidad_periodo")
    .select("nombre_producto, margen")
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", periodoIds);

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  const acumulado = new Map<string, number>();

  for (const item of data || []) {
    const nombre = item.nombre_producto;
    const margen = Number(item.margen || 0);

    acumulado.set(nombre, (acumulado.get(nombre) || 0) + margen);
  }

  return Array.from(acumulado.entries())
    .map(([nombre, valor]) => ({
      nombre,
      valor,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

export async function obtenerTopFacturacion(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
  modo?: "mensual" | "trimestral" | "anual" | "personalizado";
  periodo_desde_id?: string | null;
  periodo_hasta_id?: string | null;
}): Promise<RankingItem[]> {
  const periodoIds = await obtenerIdsPeriodosParaModo(input);

  if (periodoIds.length === 0) return [];

  let query = supabase
    .from("rentabilidad_periodo")
    .select("nombre_producto, ventas")
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", periodoIds);

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  const acumulado = new Map<string, number>();

  for (const item of data || []) {
    const nombre = item.nombre_producto;
    const ventas = Number(item.ventas || 0);

    acumulado.set(nombre, (acumulado.get(nombre) || 0) + ventas);
  }

  return Array.from(acumulado.entries())
    .map(([nombre, valor]) => ({
      nombre,
      valor,
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);
}

export async function obtenerTopPedidosYa(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
  modo?: "mensual" | "trimestral" | "anual" | "personalizado";
  periodo_desde_id?: string | null;
  periodo_hasta_id?: string | null;
}): Promise<RankingCanalItem[]> {
  const periodoIds = await obtenerIdsPeriodosParaModo(input);
  if (periodoIds.length === 0) return [];

  let query = supabase
    .from("rentabilidad_periodo")
    .select("nombre_producto, cantidad, ventas, margen")
    .eq("empresa_id", input.empresa_id)
    .eq("canal", "PedidosYa")
    .in("periodo_id", periodoIds);

  if (input.sucursal_id) query = query.eq("sucursal_id", input.sucursal_id);
  const { data, error } = await query;
  if (error) throw error;

  const agrupados = new Map<string, RankingCanalItem>();
  for (const fila of data || []) {
    const actual = agrupados.get(fila.nombre_producto) || {
      nombre: fila.nombre_producto,
      cantidad: 0,
      ventas: 0,
      margen: 0,
    };
    actual.cantidad += Number(fila.cantidad || 0);
    actual.ventas += Number(fila.ventas || 0);
    actual.margen += Number(fila.margen || 0);
    agrupados.set(fila.nombre_producto, actual);
  }

  return Array.from(agrupados.values())
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 5);
}
export async function obtenerEvolucionDashboard(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
  modo?: "mensual" | "trimestral" | "anual" | "personalizado";
  periodo_desde_id?: string | null;
  periodo_hasta_id?: string | null;
}): Promise<EvolucionDashboardItem[]> {
  const periodoIds = await obtenerIdsPeriodosParaModo(input);

  if (periodoIds.length === 0) return [];

  const { data: periodosData, error: periodosError } = await supabase
    .from("periodos")
    .select("id, nombre, anio, mes")
    .in("id", periodoIds)
    .order("anio", { ascending: true })
    .order("mes", { ascending: true });

  if (periodosError) throw periodosError;

  let rentabilidadQuery = supabase
    .from("rentabilidad_periodo")
    .select("periodo_id, ventas, costo_total, margen")
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", periodoIds);

  if (input.sucursal_id) {
    rentabilidadQuery = rentabilidadQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
  }

  const { data: rentabilidad, error: rentabilidadError } =
    await rentabilidadQuery;

  if (rentabilidadError) throw rentabilidadError;

  const acumulado = new Map<
    string,
    { ventas: number; costo: number; margen: number }
  >();

  for (const item of rentabilidad || []) {
    const actual = acumulado.get(item.periodo_id) || {
      ventas: 0,
      costo: 0,
      margen: 0,
    };

    actual.ventas += Number(item.ventas || 0);
    actual.costo += Number(item.costo_total || 0);
    actual.margen += Number(item.margen || 0);

    acumulado.set(item.periodo_id, actual);
  }

  return (periodosData || []).map((periodo) => {
    const valores = acumulado.get(periodo.id) || {
      ventas: 0,
      costo: 0,
      margen: 0,
    };

    return {
      periodo_id: periodo.id,
      nombre: periodo.nombre,
      anio: Number(periodo.anio),
      mes: Number(periodo.mes),
      ventas: valores.ventas,
      costo: valores.costo,
      margen: valores.margen,
    };
  });
}