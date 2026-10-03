import { supabase } from "../lib/supabase";

export const FUENTE_VENTA_MANUAL_PIU = "Venta manual PIÚ";

export type RecetaVentaManualPiu = {
  id: string;
  nombre: string;
  costo_kg: number;
};

export type VentaManualPiu = {
  id: string;
  codigo_producto: string;
  nombre_producto: string;
  cantidad: number;
  total: number;
  sucursal_id: string | null;
  created_at: string;
};

export async function obtenerRecetasVentaManualPiu(
  empresaId: string
): Promise<RecetaVentaManualPiu[]> {
  const { data, error } = await supabase
    .from("recetas")
    .select("id, nombre, costo_kg")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });

  if (error) throw error;

  return (data || [])
    .map((receta: any) => ({
      id: String(receta.id),
      nombre: String(receta.nombre || ""),
      costo_kg: Number(receta.costo_kg || 0),
    }))
    .filter((receta) => receta.nombre && receta.costo_kg > 0);
}

export async function obtenerVentasManualesPiu(input: {
  empresa_id: string;
  periodo_id: string;
}): Promise<VentaManualPiu[]> {
  const { data, error } = await supabase
    .from("producto_ventas_resumen")
    .select(
      "id, codigo_producto, nombre_producto, cantidad, total, sucursal_id, created_at"
    )
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .eq("fuente", FUENTE_VENTA_MANUAL_PIU)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((venta: any) => ({
    id: String(venta.id),
    codigo_producto: String(venta.codigo_producto || ""),
    nombre_producto: String(venta.nombre_producto || ""),
    cantidad: Number(venta.cantidad || 0),
    total: Number(venta.total || 0),
    sucursal_id: venta.sucursal_id || null,
    created_at: String(venta.created_at || ""),
  }));
}

async function asegurarReglaDeCosto(input: {
  empresa_id: string;
  nombre_producto: string;
  receta_id: string;
}) {
  const { data: existentes, error: errorExistentes } = await supabase
    .from("producto_costo")
    .select("id")
    .eq("empresa_id", input.empresa_id)
    .eq("nombre_producto", input.nombre_producto)
    .limit(1);

  if (errorExistentes) throw errorExistentes;

  const valores = {
    tipo_calculo: "receta",
    receta_id: input.receta_id,
    factor: 1,
    observaciones: "Costo por kilo tomado de la receta para una venta manual",
    activo: true,
    pendiente_revision: false,
  };

  const existente = existentes?.[0];

  if (existente) {
    const { error } = await supabase
      .from("producto_costo")
      .update(valores)
      .eq("id", existente.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("producto_costo").insert({
    empresa_id: input.empresa_id,
    nombre_producto: input.nombre_producto,
    ...valores,
  });

  if (error) throw error;
}

export async function registrarVentaManualPiu(input: {
  empresa_id: string;
  periodo_id: string;
  periodo_anio: number;
  periodo_mes: number;
  receta: RecetaVentaManualPiu;
  kilos: number;
  precio_kg: number;
  sucursal_ids: string[];
}) {
  if (input.kilos <= 0) throw new Error("Ingresá una cantidad de kilos mayor a cero.");
  if (input.precio_kg <= 0) throw new Error("Ingresá un precio por kilo mayor a cero.");
  if (input.sucursal_ids.length === 0) {
    throw new Error("La empresa no tiene sucursales para distribuir la venta.");
  }

  const nombreProducto = `Venta manual · ${input.receta.nombre}`;
  await asegurarReglaDeCosto({
    empresa_id: input.empresa_id,
    nombre_producto: nombreProducto,
    receta_id: input.receta.id,
  });

  const codigoGrupo = `MANUAL-${crypto.randomUUID()}`;
  const kilosPorSucursal = input.kilos / input.sucursal_ids.length;
  const ventaPorSucursal =
    (input.kilos * input.precio_kg) / input.sucursal_ids.length;

  const filas = input.sucursal_ids.map((sucursalId) => ({
    empresa_id: input.empresa_id,
    sucursal_id: sucursalId,
    periodo_id: input.periodo_id,
    periodo_anio: input.periodo_anio,
    periodo_mes: input.periodo_mes,
    importacion_id: null,
    fuente: FUENTE_VENTA_MANUAL_PIU,
    periodo_inicio: null,
    periodo_fin: null,
    categoria: "Venta manual",
    codigo_producto: codigoGrupo,
    nombre_producto: nombreProducto,
    cantidad: kilosPorSucursal,
    total: ventaPorSucursal,
    ganancia: 0,
  }));

  const { error } = await supabase
    .from("producto_ventas_resumen")
    .insert(filas);

  if (error) throw error;

  return {
    codigo_grupo: codigoGrupo,
    kilos_totales: input.kilos,
    venta_total: input.kilos * input.precio_kg,
    kilos_por_sucursal: kilosPorSucursal,
    venta_por_sucursal: ventaPorSucursal,
  };
}

export async function eliminarVentaManualPiu(input: {
  empresa_id: string;
  periodo_id: string;
  codigo_grupo: string;
}) {
  const { error } = await supabase
    .from("producto_ventas_resumen")
    .delete()
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .eq("fuente", FUENTE_VENTA_MANUAL_PIU)
    .eq("codigo_producto", input.codigo_grupo);

  if (error) throw error;
}
