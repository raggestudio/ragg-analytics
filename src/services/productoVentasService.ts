import { supabase } from "../lib/supabase";
import type { ProductoVentaResumen } from "../types/productoVentaResumen";

type ProductoVentaInput = {
  fuente: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  categoria: string | null;
  codigo_producto: string | null;
  nombre_producto: string;
  cantidad: number;
  total: number;
  ganancia: number;
};

async function crearReglasCostoPendientes(input: {
  empresa_id: string;
  productos: ProductoVentaInput[];
}) {
  const nombresUnicos = Array.from(
    new Set(
      input.productos
        .map((p) => p.nombre_producto?.trim())
        .filter((nombre): nombre is string => Boolean(nombre))
    )
  );

  if (nombresUnicos.length === 0) return;

  const { data: existentes, error: errorExistentes } = await supabase
    .from("producto_costo")
    .select("nombre_producto")
    .eq("empresa_id", input.empresa_id)
    .in("nombre_producto", nombresUnicos);

  if (errorExistentes) throw errorExistentes;

  const existentesSet = new Set(
    (existentes || []).map((item) => item.nombre_producto)
  );

  const nuevos = nombresUnicos
    .filter((nombre) => !existentesSet.has(nombre))
    .map((nombre) => ({
      empresa_id: input.empresa_id,
      nombre_producto: nombre,
      tipo_calculo: "estimado",
      receta_id: null,
      factor: null,
      observaciones: "Creado automáticamente desde Isatech",
      activo: true,
      pendiente_revision: true,
    }));

  if (nuevos.length === 0) return;

  const { error } = await supabase.from("producto_costo").insert(nuevos);

  if (error) throw error;
}

export async function guardarProductosVentaResumen(input: {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id?: string | null;
  periodo_anio?: number | null;
  periodo_mes?: number | null;
  importacion_id?: string | null;
  productos: ProductoVentaInput[];
}) {
  if (input.productos.length === 0) return;

  await crearReglasCostoPendientes({
    empresa_id: input.empresa_id,
    productos: input.productos,
  });

  const { error } = await supabase.from("producto_ventas_resumen").insert(
    input.productos.map((p) => ({
      empresa_id: input.empresa_id,
      sucursal_id: input.sucursal_id || null,
      periodo_id: input.periodo_id || null,
      periodo_anio: input.periodo_anio || null,
      periodo_mes: input.periodo_mes || null,
      importacion_id: input.importacion_id || null,
      fuente: p.fuente,
      periodo_inicio: p.periodo_inicio,
      periodo_fin: p.periodo_fin,
      categoria: p.categoria,
      codigo_producto: p.codigo_producto,
      nombre_producto: p.nombre_producto,
      cantidad: p.cantidad,
      total: p.total,
      ganancia: p.ganancia,
    }))
  );

  if (error) throw error;
}

export async function reemplazarProductosIsatech(input: {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id?: string | null;
  periodo_anio?: number | null;
  periodo_mes?: number | null;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  importacion_id?: string | null;
  productos: ProductoVentaInput[];
}) {
  if (input.productos.length === 0) return;

  const fuente = input.productos[0]?.fuente || "Isatech";

  let query = supabase
    .from("producto_ventas_resumen")
    .delete()
    .eq("empresa_id", input.empresa_id)
    .eq("fuente", fuente);

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  } else {
    query = query.is("sucursal_id", null);
  }

  if (input.periodo_id) {
    query = query.eq("periodo_id", input.periodo_id);
  }

  const { error: deleteError } = await query;

  if (deleteError) throw deleteError;

  await guardarProductosVentaResumen({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodo_id: input.periodo_id || null,
    periodo_anio: input.periodo_anio || null,
    periodo_mes: input.periodo_mes || null,
    importacion_id: input.importacion_id || null,
    productos: input.productos,
  });
}

export async function obtenerProductosVentaPorEmpresa(
  input:
    | string
    | {
        empresa_id: string;
        periodo_ids: string[];
        sucursal_id?: string | null;
      }
): Promise<ProductoVentaResumen[]> {
  if (typeof input === "string") {
    const { data, error } = await supabase
      .from("producto_ventas_resumen")
      .select("*")
      .eq("empresa_id", input)
      .order("total", { ascending: false });

    if (error) throw error;

    return data || [];
  }

  if (input.periodo_ids.length === 0) return [];

  let query = supabase
    .from("producto_ventas_resumen")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", input.periodo_ids)
    .order("total", { ascending: false });

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}
export type ProductoRentabilidadResumen = {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  periodo_id: string;
  nombre_producto: string;
  categoria: string | null;
  cantidad: number;
  ventas: number;
  costo_total: number;
  margen: number;
  margen_porcentaje: number;
  tipo_calculo: string;
  origen_costo: string | null;
};

export async function obtenerRentabilidadProductosPorEmpresa(input: {
  empresa_id: string;
  periodo_ids: string[];
  sucursal_id?: string | null;
}): Promise<ProductoRentabilidadResumen[]> {
  if (input.periodo_ids.length === 0) return [];

  let query = supabase
    .from("rentabilidad_periodo")
    .select(`
      id,
      empresa_id,
      sucursal_id,
      periodo_id,
      nombre_producto,
      categoria,
      cantidad,
      ventas,
      costo_total,
      margen,
      margen_porcentaje,
      tipo_calculo,
      origen_costo
    `)
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", input.periodo_ids)
    .order("ventas", { ascending: false });

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((fila: any) => ({
    ...fila,
    cantidad: Number(fila.cantidad || 0),
    ventas: Number(fila.ventas || 0),
    costo_total: Number(fila.costo_total || 0),
    margen: Number(fila.margen || 0),
    margen_porcentaje: Number(fila.margen_porcentaje || 0),
  }));
}