import { supabase } from "../lib/supabase";

export type ProductoVinculacion = {
  id: string;
  empresa_id: string;
  sistema: string;
  codigo_sistema: string;
  nombre_sistema: string;
  costo_manual_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export async function obtenerVinculacionesProducto(input: {
  empresa_id: string;
  sistema?: string;
}): Promise<ProductoVinculacion[]> {
  let query = supabase
    .from("producto_vinculacion")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("activo", true);

  if (input.sistema) {
    query = query.eq("sistema", input.sistema);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}

export async function guardarVinculacionProducto(input: {
  empresa_id: string;
  sistema: string;
  codigo_sistema: string;
  nombre_sistema: string;
  costo_manual_id: string;
}) {
  const { data, error } = await supabase
    .from("producto_vinculacion")
    .upsert(
      {
        empresa_id: input.empresa_id,
        sistema: input.sistema,
        codigo_sistema: input.codigo_sistema,
        nombre_sistema: input.nombre_sistema,
        costo_manual_id: input.costo_manual_id,
        activo: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "empresa_id,sistema,codigo_sistema",
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function eliminarVinculacionProducto(id: string) {
  const { error } = await supabase
    .from("producto_vinculacion")
    .update({
      activo: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}