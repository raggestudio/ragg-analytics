import { supabase } from "../lib/supabase";

export type TurnoPedidosYa = "mediodia" | "noche";
export type VistaTurnoPedidosYa = "total" | TurnoPedidosYa;

export type ResumenTurnoPedidosYa = {
  turno: VistaTurnoPedidosYa;
  pedidos: number;
  facturacion: number;
  ticket_promedio: number;
  ventas_brutas: number;
  descuento_local: number;
  venta_efectiva: number;
  comision: number;
  iva_comision: number;
  tarifa_pago_linea: number;
  retencion_recuperable: number;
  ingreso_estimado: number;
  unidades: number;
  costo_productos: number;
  ganancia_neta: number;
  margen_porcentaje: number;
  productos_sin_costo: number;
  top_productos: Array<{
    nombre: string;
    unidades: number;
    facturacion: number;
    ganancia: number;
  }>;
  pedidos_detalle: number;
  detalle_disponible: boolean;
};

export type ResumenPedidosYaPorTurno = {
  total: ResumenTurnoPedidosYa;
  mediodia: ResumenTurnoPedidosYa;
  noche: ResumenTurnoPedidosYa;
};

function normalizar(texto: unknown) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function nombreProductoBase(texto: unknown) {
  return String(texto || "Sin nombre")
    .replace(/^\s*\d+(?:[.,]\d+)?\s*[xX×]?\s+/, "")
    .replace(/\s*\[[^\]]*\]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pedidoContabilizable(estado: unknown) {
  const valor = normalizar(estado);
  if (!valor) return true;

  return [
    "entregado",
    "realizado",
    "completado",
    "completed",
    "delivered",
  ].includes(valor);
}

function resumenVacio(
  turno: VistaTurnoPedidosYa
): ResumenTurnoPedidosYa {
  return {
    turno,
    pedidos: 0,
    facturacion: 0,
    ticket_promedio: 0,
    ventas_brutas: 0,
    descuento_local: 0,
    venta_efectiva: 0,
    comision: 0,
    iva_comision: 0,
    tarifa_pago_linea: 0,
    retencion_recuperable: 0,
    ingreso_estimado: 0,
    unidades: 0,
    costo_productos: 0,
    ganancia_neta: 0,
    margen_porcentaje: 0,
    productos_sin_costo: 0,
    top_productos: [],
    pedidos_detalle: 0,
    detalle_disponible: false,
  };
}

function sumar(
  turno: VistaTurnoPedidosYa,
  resumenes: ResumenTurnoPedidosYa[]
) {
  const resultado = resumenes.reduce(
    (total, item) => ({
      ...total,
      pedidos: total.pedidos + item.pedidos,
      facturacion: total.facturacion + item.facturacion,
      ventas_brutas: total.ventas_brutas + item.ventas_brutas,
      descuento_local:
        total.descuento_local + item.descuento_local,
      venta_efectiva:
        total.venta_efectiva + item.venta_efectiva,
      comision: total.comision + item.comision,
      iva_comision:
        total.iva_comision + item.iva_comision,
      tarifa_pago_linea:
        total.tarifa_pago_linea +
        item.tarifa_pago_linea,
      retencion_recuperable:
        total.retencion_recuperable +
        item.retencion_recuperable,
      ingreso_estimado:
        total.ingreso_estimado +
        item.ingreso_estimado,
      unidades: total.unidades + item.unidades,
      costo_productos:
        total.costo_productos + item.costo_productos,
      productos_sin_costo:
        total.productos_sin_costo +
        item.productos_sin_costo,
      pedidos_detalle:
        total.pedidos_detalle + item.pedidos_detalle,
    }),
    resumenVacio(turno)
  );

  resultado.ticket_promedio =
    resultado.pedidos > 0
      ? resultado.facturacion / resultado.pedidos
      : 0;
  resultado.detalle_disponible = resumenes.every(
    (item) =>
      item.facturacion <= 0 ||
      item.detalle_disponible
  );
  resultado.ganancia_neta =
    resultado.venta_efectiva -
    resultado.comision -
    resultado.iva_comision -
    resultado.tarifa_pago_linea -
    resultado.costo_productos;
  resultado.margen_porcentaje =
    resultado.venta_efectiva > 0
      ? (resultado.ganancia_neta /
          resultado.venta_efectiva) *
        100
      : 0;

  const productos = new Map<
    string,
    {
      nombre: string;
      unidades: number;
      facturacion: number;
      ganancia: number;
    }
  >();
  for (const resumen of resumenes) {
    for (const producto of resumen.top_productos) {
      const clave = normalizar(producto.nombre);
      const existente = productos.get(clave);
      productos.set(clave, {
        nombre: existente?.nombre || producto.nombre,
        unidades:
          Number(existente?.unidades || 0) +
          producto.unidades,
        facturacion:
          Number(existente?.facturacion || 0) +
          producto.facturacion,
        ganancia:
          Number(existente?.ganancia || 0) +
          producto.ganancia,
      });
    }
  }
  resultado.top_productos = Array.from(
    productos.values()
  )
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 5);

  return resultado;
}

export async function obtenerResumenPedidosYaPorTurno(input: {
  empresa_id: string;
  periodo_ids: string[];
  sucursal_id?: string | null;
}): Promise<ResumenPedidosYaPorTurno> {
  if (input.periodo_ids.length === 0) {
    const mediodia = resumenVacio("mediodia");
    const noche = resumenVacio("noche");
    return {
      mediodia,
      noche,
      total: sumar("total", [mediodia, noche]),
    };
  }

  const { data: periodos, error: periodosError } =
    await supabase
      .from("periodos")
      .select("id, anio, mes")
      .in("id", input.periodo_ids);

  if (periodosError) throw periodosError;

  const periodosSeleccionados = new Set(
    (periodos || []).map(
      (periodo) =>
        `${Number(periodo.anio)}-${Number(periodo.mes)}`
    )
  );

  let ventasQuery = supabase
    .from("ventas")
    .select(`
      turno,
      pedidos,
      ventas,
      total,
      periodo_id,
      periodo_anio,
      periodo_mes
    `)
    .eq("empresa_id", input.empresa_id)
    .eq("origen", "PedidosYa");

  let pedidosQuery = supabase
    .from("pedidosya_pedidos")
    .select(`
      turno,
      estado_pedido,
      total_parcial,
      descuento_local,
      comision,
      iva_comision,
      tarifa_pago_linea,
      retencion_recuperable,
      ingreso_estimado
    `)
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", input.periodo_ids);

  let productosQuery = supabase
    .from("pedidosya_pedido_productos")
    .select("turno, nombre_producto, cantidad")
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", input.periodo_ids);

  let resumenProductosQuery = supabase
    .from("pedidosya_producto_resumen")
    .select(`
      turno,
      nombre_producto,
      cantidad,
      ventas
    `)
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", input.periodo_ids);

  if (input.sucursal_id) {
    ventasQuery = ventasQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
    pedidosQuery = pedidosQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
    productosQuery = productosQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
    resumenProductosQuery = resumenProductosQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
  }

  const [
    { data: ventas, error: ventasError },
    { data: pedidos, error: pedidosError },
    { data: productos, error: productosError },
    {
      data: resumenProductos,
      error: resumenProductosError,
    },
    { data: costos, error: costosError },
    { data: vinculaciones, error: vinculacionesError },
  ] = await Promise.all([
    ventasQuery,
    pedidosQuery,
    productosQuery,
    resumenProductosQuery,
    supabase
      .from("producto_costo_manual")
      .select("id, nombre_producto, costo")
      .eq("empresa_id", input.empresa_id)
      .eq("activo", true),
    supabase
      .from("producto_vinculacion")
      .select(`
        codigo_sistema,
        nombre_sistema,
        costo_manual_id
      `)
      .eq("empresa_id", input.empresa_id)
      .eq("sistema", "pedidosya")
      .eq("activo", true),
  ]);

  if (ventasError) throw ventasError;
  if (pedidosError) throw pedidosError;
  if (productosError) throw productosError;
  if (resumenProductosError) throw resumenProductosError;
  if (costosError) throw costosError;
  if (vinculacionesError) throw vinculacionesError;

  const porTurno = {
    mediodia: resumenVacio("mediodia"),
    noche: resumenVacio("noche"),
  };

  for (const venta of ventas || []) {
    const perteneceAlPeriodo =
      input.periodo_ids.includes(
        String(venta.periodo_id || "")
      ) ||
      periodosSeleccionados.has(
        `${Number(venta.periodo_anio)}-${Number(
          venta.periodo_mes
        )}`
      );

    if (!perteneceAlPeriodo) continue;

    const turno =
      venta.turno === "noche" ? "noche" : "mediodia";
    porTurno[turno].pedidos += Number(venta.pedidos || 0);
    porTurno[turno].facturacion += Number(
      venta.ventas ?? venta.total ?? 0
    );
  }

  for (const pedido of pedidos || []) {
    if (!pedidoContabilizable(pedido.estado_pedido)) continue;

    const turno =
      pedido.turno === "noche" ? "noche" : "mediodia";
    const resumen = porTurno[turno];

    resumen.detalle_disponible = true;
    resumen.pedidos_detalle += 1;
    resumen.ventas_brutas += Number(
      pedido.total_parcial || 0
    );
    resumen.descuento_local += Number(
      pedido.descuento_local || 0
    );
    resumen.comision += Number(pedido.comision || 0);
    resumen.iva_comision += Number(
      pedido.iva_comision || 0
    );
    resumen.tarifa_pago_linea += Number(
      pedido.tarifa_pago_linea || 0
    );
    resumen.retencion_recuperable += Number(
      pedido.retencion_recuperable || 0
    );
    resumen.ingreso_estimado += Number(
      pedido.ingreso_estimado || 0
    );
  }

  const costoPorId = new Map<string, number>();
  const costoPorNombre = new Map<string, number>();

  for (const costo of costos || []) {
    const valor = Number(costo.costo || 0);
    costoPorId.set(String(costo.id), valor);
    costoPorNombre.set(
      normalizar(costo.nombre_producto),
      valor
    );
  }

  const costoVinculado = new Map<string, number>();
  for (const vinculacion of vinculaciones || []) {
    const costo = costoPorId.get(
      String(vinculacion.costo_manual_id || "")
    );
    if (costo === undefined) continue;

    for (const nombre of [
      vinculacion.codigo_sistema,
      vinculacion.nombre_sistema,
    ]) {
      const clave = normalizar(nombre);
      if (clave) costoVinculado.set(clave, costo);
    }
  }

  const productosPorTurno = {
    mediodia: new Map<
      string,
      { nombre: string; unidades: number; ventas: number }
    >(),
    noche: new Map<
      string,
      { nombre: string; unidades: number; ventas: number }
    >(),
  };
  const sinCostoPorTurno = {
    mediodia: new Set<string>(),
    noche: new Set<string>(),
  };

  for (const producto of productos || []) {
    const turno =
      producto.turno === "noche" ? "noche" : "mediodia";
    const nombre = nombreProductoBase(
      producto.nombre_producto
    );
    const clave = normalizar(nombre);
    const cantidad = Number(producto.cantidad || 0);
    const costoUnitario =
      costoVinculado.get(clave) ??
      costoPorNombre.get(clave);

    if (
      costoUnitario === undefined ||
      costoUnitario <= 0
    ) {
      sinCostoPorTurno[turno].add(nombre);
      continue;
    }

    porTurno[turno].costo_productos +=
      costoUnitario * cantidad;
  }

  for (const producto of resumenProductos || []) {
    const turno =
      producto.turno === "noche" ? "noche" : "mediodia";
    const nombre = nombreProductoBase(
      producto.nombre_producto
    );
    const clave = normalizar(nombre);
    const cantidad = Number(producto.cantidad || 0);
    const ventasProducto = Number(producto.ventas || 0);
    const existente = productosPorTurno[turno].get(clave);

    productosPorTurno[turno].set(clave, {
      nombre: existente?.nombre || nombre,
      unidades:
        Number(existente?.unidades || 0) + cantidad,
      ventas:
        Number(existente?.ventas || 0) + ventasProducto,
    });
  }

  for (const resumen of Object.values(porTurno)) {
    resumen.ticket_promedio =
      resumen.pedidos > 0
        ? resumen.facturacion / resumen.pedidos
        : 0;
    resumen.venta_efectiva =
      resumen.ventas_brutas - resumen.descuento_local;
    resumen.ganancia_neta =
      resumen.venta_efectiva -
      resumen.comision -
      resumen.iva_comision -
      resumen.tarifa_pago_linea -
      resumen.costo_productos;
    resumen.margen_porcentaje =
      resumen.venta_efectiva > 0
        ? (resumen.ganancia_neta /
            resumen.venta_efectiva) *
          100
        : 0;
  }

  for (const turno of ["mediodia", "noche"] as const) {
    const facturacionProductos = Array.from(
      productosPorTurno[turno].values()
    ).reduce(
      (total, producto) => total + producto.ventas,
      0
    );

    if (facturacionProductos > 0) {
      porTurno[turno].facturacion =
        facturacionProductos;
      porTurno[turno].ticket_promedio =
        porTurno[turno].pedidos > 0
          ? facturacionProductos /
            porTurno[turno].pedidos
          : 0;
    }

    porTurno[turno].productos_sin_costo =
      sinCostoPorTurno[turno].size;
    porTurno[turno].top_productos = Array.from(
      productosPorTurno[turno].values()
    )
      .map((producto) => {
        const clave = normalizar(producto.nombre);
        const costoUnitario =
          costoVinculado.get(clave) ??
          costoPorNombre.get(clave) ??
          0;
        const costo = costoUnitario * producto.unidades;

        return {
          nombre: producto.nombre,
          unidades: producto.unidades,
          facturacion: producto.ventas,
          ganancia: producto.ventas - costo,
        };
      })
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 5);
  }

  return {
    ...porTurno,
    total: sumar("total", [
      porTurno.mediodia,
      porTurno.noche,
    ]),
  };
}
