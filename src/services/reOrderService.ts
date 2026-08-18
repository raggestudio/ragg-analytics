import { supabase } from "../lib/supabase";
import type { ProductoReOrder } from "./reOrderParser";

export async function reemplazarVentasReOrder(input: {
  empresa_id: string;
  sucursal_id: string;
  periodo_id: string;
  periodo_anio: number;
  periodo_mes: number;
  productos: ProductoReOrder[];
}) {
  const ventas = input.productos.reduce(
    (total, producto) =>
      total + Number(producto.ventas || 0),
    0
  );

  const unidades = input.productos.reduce(
    (total, producto) =>
      total + Number(producto.cantidad || 0),
    0
  );

  /*
   * Reutilizamos las tablas duna_venta_manual ya existentes.
   * Así rentabilidadService sigue leyendo Re Order por el mismo camino
   * que ya está validado para junio, sin modificar sus cálculos.
   *
   * La carga CSV reemplaza TODO Re Order del período/sucursal para
   * evitar duplicaciones si el archivo se vuelve a subir.
   */
  let existentesQuery = supabase
    .from("duna_venta_manual")
    .select("id")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .eq("canal", "Re Order");

  existentesQuery = existentesQuery.eq(
    "sucursal_id",
    input.sucursal_id
  );

  const {
    data: existentes,
    error: existentesError,
  } = await existentesQuery;

  if (existentesError) throw existentesError;

  const ids = (existentes || []).map(
    (venta: any) => String(venta.id)
  );

  /*
   * El detalle tiene FK con ON DELETE CASCADE, por lo que al borrar
   * las cabeceras desaparecen también sus líneas.
   */
  if (ids.length > 0) {
    const { error: deleteError } = await supabase
      .from("duna_venta_manual")
      .delete()
      .in("id", ids);

    if (deleteError) throw deleteError;
  }

  const comprobanteId =
    `REORDER-CSV-${input.periodo_anio}-${String(
      input.periodo_mes
    ).padStart(2, "0")}`;

  const { data: cabecera, error: cabeceraError } =
    await supabase
      .from("duna_venta_manual")
      .insert({
        empresa_id: input.empresa_id,
        periodo_id: input.periodo_id,
        sucursal_id: input.sucursal_id,
        canal: "Re Order",
        comprobante_id: comprobanteId,
        fecha: null,
        total: ventas,
        envio: 0,
        activo: true,
      })
      .select("id")
      .single();

  if (cabeceraError) throw cabeceraError;

  if (input.productos.length > 0) {
    const detalles = input.productos.map(
      (producto) => ({
        venta_id: cabecera.id,
        nombre_producto:
          producto.nombre_producto,
        categoria: null,
        cantidad: producto.cantidad,
        total: producto.ventas,
      })
    );

    const { error: detalleError } = await supabase
      .from("duna_venta_manual_detalle")
      .insert(detalles);

    if (detalleError) throw detalleError;
  }

  return {
    productos: input.productos.length,
    unidades,
    ventas,
  };
}
