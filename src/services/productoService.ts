import { supabase } from "../lib/supabase";
import type { Producto } from "../types/producto";

export async function obtenerProductosPorEmpresa(
  empresaId: string
): Promise<Producto[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("id, empresa_id, codigo, nombre, activo, created_at")
    .eq("empresa_id", empresaId)
    .order("nombre", { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function crearProducto(input: {
  empresa_id: string;
  codigo?: string;
  nombre: string;
}) {
  const { data, error } = await supabase
    .from("productos")
    .insert({
      empresa_id: input.empresa_id,
      codigo: input.codigo || null,
      nombre: input.nombre,
      activo: true,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}