import { supabase } from "../lib/supabase";
import type { VentaBerlinImportada } from "./berlinExcelParsers";
import { normalizarProductoBerlin } from "./berlinExcelParsers";

export type FuenteBerlin = "infoclub" | "historico_no" | "ocr_salon" | "ocr_delivery" | "ocr_takeaway";

export async function reemplazarVentasBerlin(input: {
  empresa_id: string; sucursal_id?: string | null; periodo_id: string;
  periodo_anio: number; periodo_mes: number; fuente: FuenteBerlin; ventas: VentaBerlinImportada[];
}) {
  let deletion = supabase.from("berlin_ventas").delete()
    .eq("empresa_id", input.empresa_id).eq("periodo_id", input.periodo_id).eq("fuente", input.fuente);
  deletion = input.sucursal_id ? deletion.eq("sucursal_id", input.sucursal_id) : deletion.is("sucursal_id", null);
  const { error: deleteError } = await deletion;
  if (deleteError) throw deleteError;

  const rows = input.ventas.map((v) => ({
    empresa_id: input.empresa_id, sucursal_id: input.sucursal_id || null,
    periodo_id: input.periodo_id, periodo_anio: input.periodo_anio, periodo_mes: input.periodo_mes,
    fuente: input.fuente, documento: v.documento, fecha: v.fecha, modalidad: v.modalidad,
    nombre_producto: v.nombre_producto, nombre_normalizado: normalizarProductoBerlin(v.nombre_producto),
    cantidad: v.cantidad, precio_unitario: v.precio_unitario, venta_total: v.venta_total,
  }));
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from("berlin_ventas").insert(rows.slice(i, i + 400));
    if (error) throw error;
  }
  return { importados: rows.length, ventas: rows.reduce((sum, row) => sum + row.venta_total, 0) };
}

export type BerlinProductoConfig = {
  id?: string; empresa_id: string; nombre_normalizado: string; nombre_producto: string;
  categoria: string | null; costo_manual_id: string | null;
};

export async function obtenerConfiguracionBerlin(empresaId: string) {
  const { data, error } = await supabase.from("berlin_producto_config").select("*").eq("empresa_id", empresaId);
  if (error) throw error;
  return (data || []) as BerlinProductoConfig[];
}

export async function guardarConfiguracionBerlin(input: BerlinProductoConfig) {
  const { data, error } = await supabase.from("berlin_producto_config").upsert({
    ...input, updated_at: new Date().toISOString(),
  }, { onConflict: "empresa_id,nombre_normalizado" }).select().single();
  if (error) throw error;
  return data;
}

export async function obtenerVentasBerlin(input: { empresa_id: string; periodo_ids: string[]; sucursal_id?: string | null }) {
  if (!input.periodo_ids.length) return [];
  let query = supabase.from("berlin_ventas").select("*").eq("empresa_id", input.empresa_id).in("periodo_id", input.periodo_ids);
  if (input.sucursal_id) query = query.eq("sucursal_id", input.sucursal_id);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
