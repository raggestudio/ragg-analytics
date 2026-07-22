import { supabase } from "../lib/supabase";
import type { CostosExcelParseResult } from "./excelCostosParser";
import type { Insumo, Receta } from "../types/costos";

type DetalleValido = {
  receta_id: string;
  insumo_id: string | null;
  seccion: string | null;
  insumo_receta: string | null;
  cantidad: number;
  precio_unitario: number;
  costo: number;
  nota: string | null;
};

export async function importarCostosExcel(input: {
  empresa_id: string;
  data: CostosExcelParseResult;
}) {
  const empresaId = input.empresa_id;

  await supabase.from("recetas").delete().eq("empresa_id", empresaId);
  await supabase.from("insumos").delete().eq("empresa_id", empresaId);

  const { data: insumosInsertados, error: errorInsumos } = await supabase
    .from("insumos")
    .insert(
      input.data.insumos.map((insumo) => ({
        empresa_id: empresaId,
        nombre: insumo.nombre,
        unidad: "kg",
        precio: insumo.precio,
        observaciones: insumo.observaciones,
        origen: "excel_import",
        activo: true,
      }))
    )
    .select();

  if (errorInsumos) throw errorInsumos;

  const { data: recetasInsertadas, error: errorRecetas } = await supabase
    .from("recetas")
    .insert(
      input.data.recetas.map((receta) => ({
        empresa_id: empresaId,
        nombre: receta.nombre,
        rendimiento: receta.rendimiento,
        costo_total: receta.costo_total,
        costo_kg: receta.costo_kg,
        origen: "excel_import",
        activo: true,
      }))
    )
    .select();

  if (errorRecetas) throw errorRecetas;

  const insumoPorNombre = new Map<string, string>();

  for (const insumo of insumosInsertados || []) {
    insumoPorNombre.set(insumo.nombre, insumo.id);
  }

  const recetaPorNombre = new Map<string, string>();

  for (const receta of recetasInsertadas || []) {
    recetaPorNombre.set(receta.nombre, receta.id);
  }

  const detalles: DetalleValido[] = [];

  for (const detalle of input.data.detalles) {
    const recetaId = recetaPorNombre.get(detalle.receta_nombre);

    if (!recetaId) continue;

    detalles.push({
      receta_id: recetaId,
      insumo_id: detalle.insumo_costo
        ? insumoPorNombre.get(detalle.insumo_costo) || null
        : null,
      seccion: detalle.seccion,
      insumo_receta: detalle.insumo_receta,
      cantidad: detalle.cantidad,
      precio_unitario: detalle.precio_unitario,
      costo: detalle.costo,
      nota: detalle.nota,
    });
  }

  if (detalles.length > 0) {
    const { error: errorDetalles } = await supabase
      .from("receta_detalle")
      .insert(detalles);

    if (errorDetalles) throw errorDetalles;
  }

  if (insumosInsertados && insumosInsertados.length > 0) {
    await supabase.from("historial_costos").insert(
      insumosInsertados.map((insumo) => ({
        insumo_id: insumo.id,
        precio: insumo.precio,
        origen: "excel_import",
      }))
    );
  }

  return {
    insumos: input.data.insumos.length,
    recetas: input.data.recetas.length,
    detalles: detalles.length,
  };
}

export async function obtenerInsumosPorEmpresa(
  empresaId: string
): Promise<Insumo[]> {
  const { data, error } = await supabase
    .from("insumos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function obtenerRecetasPorEmpresa(
  empresaId: string
): Promise<Receta[]> {
  const { data, error } = await supabase
    .from("recetas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });

  if (error) throw error;

  return data || [];
}