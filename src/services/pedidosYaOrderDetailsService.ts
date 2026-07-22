import { supabase } from "../lib/supabase";
import {
  esPedidoContabilizable,
  type PedidoYaDetallePedido,
} from "./pedidosYaOrderDetailsParser";

type ReemplazarOrderDetailsInput = {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id: string;
  periodo_anio?: number | null;
  periodo_mes?: number | null;
  pedidos: PedidoYaDetallePedido[];
};

const TAMANIO_LOTE = 300;

function redondearImporte(valor: number) {
  return Math.round(
    (Number(valor || 0) + Number.EPSILON) * 100
  ) / 100;
}

async function insertarEnLotes(
  tabla: string,
  filas: Record<string, unknown>[]
) {
  for (
    let inicio = 0;
    inicio < filas.length;
    inicio += TAMANIO_LOTE
  ) {
    const lote = filas.slice(
      inicio,
      inicio + TAMANIO_LOTE
    );

    const { error } = await supabase
      .from(tabla)
      .insert(lote);

    if (error) throw error;
  }
}

async function eliminarProductosAnteriores(
  idsPedidos: string[]
) {
  for (
    let inicio = 0;
    inicio < idsPedidos.length;
    inicio += TAMANIO_LOTE
  ) {
    const loteIds = idsPedidos.slice(
      inicio,
      inicio + TAMANIO_LOTE
    );

    const { error } = await supabase
      .from("pedidosya_pedido_productos")
      .delete()
      .in("pedido_id", loteIds);

    if (error) throw error;
  }
}

async function insertarPedidosEnLotes(
  filas: Record<string, unknown>[]
) {
  const insertados: Array<{
    id: string;
    numero_pedido: string;
  }> = [];

  for (
    let inicio = 0;
    inicio < filas.length;
    inicio += TAMANIO_LOTE
  ) {
    const lote = filas.slice(
      inicio,
      inicio + TAMANIO_LOTE
    );

    const { data, error } = await supabase
      .from("pedidosya_pedidos")
      .insert(lote)
      .select("id, numero_pedido");

    if (error) throw error;

    for (const pedido of data || []) {
      insertados.push({
        id: String(pedido.id),
        numero_pedido: String(pedido.numero_pedido),
      });
    }
  }

  return insertados;
}

export async function reemplazarOrderDetailsPedidosYa(
  input: ReemplazarOrderDetailsInput
) {
  /*
   * Primero buscamos y eliminamos todos los pedidos
   * correspondientes exclusivamente al período y sucursal.
   */
  let buscarQuery = supabase
    .from("pedidosya_pedidos")
    .select("id")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    buscarQuery = buscarQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
  } else {
    buscarQuery = buscarQuery.is("sucursal_id", null);
  }

  const {
    data: anteriores,
    error: buscarError,
  } = await buscarQuery;

  if (buscarError) throw buscarError;

  const idsAnteriores = (anteriores || []).map(
    (item: { id: string }) => String(item.id)
  );

  if (idsAnteriores.length > 0) {
    await eliminarProductosAnteriores(idsAnteriores);
  }

  let deleteQuery = supabase
    .from("pedidosya_pedidos")
    .delete()
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    deleteQuery = deleteQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
  } else {
    deleteQuery = deleteQuery.is(
      "sucursal_id",
      null
    );
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) throw deleteError;

  /*
   * Se guardan todos los pedidos, incluidos los cancelados,
   * para conservar la trazabilidad del archivo.
   *
   * Los cancelados no se incluirán en productos ni cálculos.
   */
  const filasPedidos = input.pedidos.map((pedido) => ({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodo_id: input.periodo_id,
    periodo_anio: input.periodo_anio ?? null,
    periodo_mes: input.periodo_mes ?? null,

    numero_pedido: pedido.numero_pedido,
    fecha: pedido.fecha,
    estado_pedido: pedido.estado_pedido || null,

    total_parcial: Number(
      pedido.total_parcial || 0
    ),

    descuento_local: Number(
      pedido.descuento_local || 0
    ),

    descuento_pedidosya: Number(
      pedido.descuento_pedidosya || 0
    ),

    comision: Number(
      pedido.comision || 0
    ),

    iva_comision: Number(
      pedido.iva_comision || 0
    ),

    tarifa_pago_linea: Number(
      pedido.tarifa_pago_linea || 0
    ),

    cargos: Number(
      pedido.cargos || 0
    ),

    /*
     * Se conserva impuestos para compatibilidad.
     */
    impuestos: Number(
      pedido.cargo_impositivo ||
        pedido.impuestos ||
        0
    ),

    cargo_impositivo: Number(
      pedido.cargo_impositivo ||
        pedido.impuestos ||
        0
    ),

    retencion_recuperable: Number(
      pedido.retencion_recuperable || 0
    ),

    ingreso_estimado: Number(
      pedido.ingreso_estimado || 0
    ),

    articulos_raw:
      pedido.articulos_raw || null,
  }));

  const pedidosInsertados =
    await insertarPedidosEnLotes(filasPedidos);

  const idPorNumero = new Map<string, string>();

  for (const pedido of pedidosInsertados) {
    idPorNumero.set(
      pedido.numero_pedido,
      pedido.id
    );
  }

  /*
   * Solamente los pedidos entregados generan ventas,
   * unidades y productos para la rentabilidad.
   */
  const pedidosContabilizables = input.pedidos.filter(
    esPedidoContabilizable
  );

  const filasProductos =
    pedidosContabilizables.flatMap((pedido) => {
      const pedidoId = idPorNumero.get(
        pedido.numero_pedido
      );

      if (!pedidoId) return [];

      return pedido.productos.map((producto) => ({
        pedido_id: pedidoId,
        empresa_id: input.empresa_id,
        sucursal_id:
          input.sucursal_id || null,
        periodo_id: input.periodo_id,
        numero_pedido:
          pedido.numero_pedido,
        nombre_producto:
          producto.nombre_producto,
        cantidad: Number(
          producto.cantidad || 1
        ),
        detalle:
          producto.detalle || null,
      }));
    });

  if (filasProductos.length > 0) {
    await insertarEnLotes(
      "pedidosya_pedido_productos",
      filasProductos
    );
  }

  const resumen = pedidosContabilizables.reduce(
    (total, pedido) => ({
      ventas_brutas:
        total.ventas_brutas +
        Number(pedido.total_parcial || 0),

      descuento_local:
        total.descuento_local +
        Number(pedido.descuento_local || 0),

      descuento_pedidosya:
        total.descuento_pedidosya +
        Number(pedido.descuento_pedidosya || 0),

      comision:
        total.comision +
        Number(pedido.comision || 0),

      iva_comision:
        total.iva_comision +
        Number(pedido.iva_comision || 0),

      tarifa_pago_linea:
        total.tarifa_pago_linea +
        Number(pedido.tarifa_pago_linea || 0),

      cargos:
        total.cargos +
        Number(pedido.cargos || 0),

      cargo_impositivo:
        total.cargo_impositivo +
        Number(pedido.cargo_impositivo || 0),

      retencion_recuperable:
        total.retencion_recuperable +
        Number(
          pedido.retencion_recuperable || 0
        ),

      ingreso_estimado:
        total.ingreso_estimado +
        Number(pedido.ingreso_estimado || 0),
    }),
    {
      ventas_brutas: 0,
      descuento_local: 0,
      descuento_pedidosya: 0,
      comision: 0,
      iva_comision: 0,
      tarifa_pago_linea: 0,
      cargos: 0,
      cargo_impositivo: 0,
      retencion_recuperable: 0,
      ingreso_estimado: 0,
    }
  );

  const ventaEfectiva =
    resumen.ventas_brutas -
    resumen.descuento_local;

  const costoPedidosYa =
    resumen.comision +
    resumen.iva_comision +
    resumen.tarifa_pago_linea;

  return {
    pedidos_importados: filasPedidos.length,

    pedidos_contabilizados:
      pedidosContabilizables.length,

    pedidos_omitidos:
      input.pedidos.length -
      pedidosContabilizables.length,

    productos_importados:
      filasProductos.length,

    ventas_brutas: redondearImporte(
      resumen.ventas_brutas
    ),

    descuento_local: redondearImporte(
      resumen.descuento_local
    ),

    descuento_pedidosya: redondearImporte(
      resumen.descuento_pedidosya
    ),

    venta_efectiva: redondearImporte(
      ventaEfectiva
    ),

    total_comision: redondearImporte(
      resumen.comision
    ),

    total_iva_comision: redondearImporte(
      resumen.iva_comision
    ),

    total_comision_mas_iva:
      redondearImporte(
        resumen.comision +
          resumen.iva_comision
      ),

    total_tarifa_pago_linea:
      redondearImporte(
        resumen.tarifa_pago_linea
      ),

    costo_pedidosya:
      redondearImporte(costoPedidosYa),

    total_cargos: redondearImporte(
      resumen.cargos
    ),

    total_cargo_impositivo:
      redondearImporte(
        resumen.cargo_impositivo
      ),

    total_retencion_recuperable:
      redondearImporte(
        resumen.retencion_recuperable
      ),

    total_ingreso_estimado:
      redondearImporte(
        resumen.ingreso_estimado
      ),

    /*
     * Se conserva para cualquier pantalla antigua
     * que todavía lea total_impuestos.
     */
    total_impuestos:
      redondearImporte(
        resumen.cargo_impositivo
      ),
  };
}