import { supabase } from "../lib/supabase";
import type { ProductoCosto, TipoCalculoCosto } from "../types/productoCosto";

export async function obtenerReglasCosto(
  empresaId: string
): Promise<ProductoCosto[]> {
  const { data, error } = await supabase
    .from("producto_costo")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre_producto", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function guardarReglaCosto(input: {
  empresa_id: string;
  nombre_producto: string;
  tipo_calculo: TipoCalculoCosto;
  receta_id?: string | null;
  factor?: number | null;
  observaciones?: string | null;
}) {
  const { data, error } = await supabase
    .from("producto_costo")
    .upsert(
      {
        empresa_id: input.empresa_id,
        nombre_producto: input.nombre_producto,
        tipo_calculo: input.tipo_calculo,
        receta_id: input.receta_id || null,
        factor: input.factor ?? null,
        observaciones: input.observaciones || null,
      },
      { onConflict: "empresa_id,nombre_producto" }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}