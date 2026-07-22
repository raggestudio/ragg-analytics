import { supabase } from "../lib/supabase";
import type { ProductoResumenPedidosYa } from "./pedidosYaProductosParser";

type ReemplazarProductosPedidosYaInput = {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id: string;
  periodo_anio?: number | null;
  periodo_mes?: number | null;
  productos: ProductoResumenPedidosYa[];
};

export async function reemplazarProductosPedidosYa(
  input: ReemplazarProductosPedidosYaInput
) {
  let deleteQuery = supabase
    .from("pedidosya_producto_resumen")
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

  const filas = input.productos.map((producto) => ({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodo_id: input.periodo_id,
    periodo_anio: input.periodo_anio || null,
    periodo_mes: input.periodo_mes || null,
    codigo_producto: producto.codigo_producto || null,
    nombre_producto: producto.nombre_producto,
    categoria: producto.categoria || null,
    cantidad: Number(producto.cantidad || 0),
    ventas: Number(producto.ventas || 0),
  }));

  if (filas.length > 0) {
    const { error: insertError } = await supabase
      .from("pedidosya_producto_resumen")
      .insert(filas);

    if (insertError) throw insertError;
  }

  return { importados: filas.length };
}
