import { supabase } from "../lib/supabase";
import type { ProductoReceta } from "../types/productoReceta";

export async function obtenerVinculaciones(
  empresaId: string
): Promise<ProductoReceta[]> {
  const { data, error } = await supabase
    .from("producto_receta")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("nombre_producto", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function guardarVinculacion(
  empresaId: string,
  nombreProducto: string,
  categoriaProducto: string | null,
  recetaId: string | null
) {
  const { data, error } = await supabase
    .from("producto_receta")
    .upsert(
      {
        empresa_id: empresaId,
        nombre_producto: nombreProducto,
        categoria_producto: categoriaProducto,
        receta_id: recetaId,
      },
      {
        onConflict: "empresa_id,nombre_producto",
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}