import { supabase } from "../lib/supabase";
import type { PedidoYaDetallePedido } from "./pedidosYaOrderDetailsParser";

type ReemplazarOrderDetailsInput = {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id: string;
  periodo_anio?: number | null;
  periodo_mes?: number | null;
  pedidos: PedidoYaDetallePedido[];
};

const TAMANIO_LOTE = 300;

async function insertarEnLotes(tabla: string, filas: any[]) {
  for (let inicio = 0; inicio < filas.length; inicio += TAMANIO_LOTE) {
    const lote = filas.slice(inicio, inicio + TAMANIO_LOTE);
    const { error } = await supabase.from(tabla).insert(lote);
    if (error) throw error;
  }
}

export async function reemplazarOrderDetailsPedidosYa(
  input: ReemplazarOrderDetailsInput
) {
  let buscarQuery = supabase
    .from("pedidosya_pedidos")
    .select("id")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    buscarQuery = buscarQuery.eq("sucursal_id", input.sucursal_id);
  } else {
    buscarQuery = buscarQuery.is("sucursal_id", null);
  }

  const { data: anteriores, error: buscarError } = await buscarQuery;
  if (buscarError) throw buscarError;

  const idsAnteriores = (anteriores || []).map((item: any) => item.id);

  if (idsAnteriores.length > 0) {
    const { error: productosDeleteError } = await supabase
      .from("pedidosya_pedido_productos")
      .delete()
      .in("pedido_id", idsAnteriores);

    if (productosDeleteError) throw productosDeleteError;
  }

  let deleteQuery = supabase
    .from("pedidosya_pedidos")
    .delete()
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    deleteQuery = deleteQuery.eq("sucursal_id", input.sucursal_id);
  } else {
    deleteQuery = deleteQuery.is("sucursal_id", null);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const filasPedidos = input.pedidos.map((pedido) => ({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodo_id: input.periodo_id,
    periodo_anio: input.periodo_anio || null,
    periodo_mes: input.periodo_mes || null,
    numero_pedido: pedido.numero_pedido,
    fecha: pedido.fecha,
    total_parcial: Number(pedido.total_parcial || 0),
    comision: Number(pedido.comision || 0),
    cargos: Number(pedido.cargos || 0),
    impuestos: Number(pedido.impuestos || 0),
    ingreso_estimado: Number(pedido.ingreso_estimado || 0),
    articulos_raw: pedido.articulos_raw || null,
  }));

  const { data: pedidosInsertados, error: insertError } = await supabase
    .from("pedidosya_pedidos")
    .insert(filasPedidos)
    .select("id, numero_pedido");

  if (insertError) throw insertError;

  const idPorNumero = new Map<string, string>();

  for (const pedido of pedidosInsertados || []) {
    idPorNumero.set(String(pedido.numero_pedido), String(pedido.id));
  }

  const filasProductos = input.pedidos.flatMap((pedido) => {
    const pedidoId = idPorNumero.get(pedido.numero_pedido);
    if (!pedidoId) return [];

    return pedido.productos.map((producto) => ({
      pedido_id: pedidoId,
      empresa_id: input.empresa_id,
      sucursal_id: input.sucursal_id || null,
      periodo_id: input.periodo_id,
      numero_pedido: pedido.numero_pedido,
      nombre_producto: producto.nombre_producto,
      cantidad: Number(producto.cantidad || 1),
      detalle: producto.detalle || null,
    }));
  });

  if (filasProductos.length > 0) {
    await insertarEnLotes("pedidosya_pedido_productos", filasProductos);
  }

  return {
    pedidos_importados: filasPedidos.length,
    productos_importados: filasProductos.length,
    total_comision: input.pedidos.reduce(
      (total, pedido) => total + Number(pedido.comision || 0),
      0
    ),
    total_cargos: input.pedidos.reduce(
      (total, pedido) => total + Number(pedido.cargos || 0),
      0
    ),
    total_impuestos: input.pedidos.reduce(
      (total, pedido) => total + Number(pedido.impuestos || 0),
      0
    ),
  };
}
