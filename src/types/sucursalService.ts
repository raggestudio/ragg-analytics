import { supabase } from "../lib/supabase";
import type { Sucursal } from "../types/sucursal";

export async function obtenerSucursalesPorEmpresa(
  empresaId: string
): Promise<Sucursal[]> {
  const { data, error } = await supabase
    .from("sucursales")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activa", true)
    .order("nombre", { ascending: true });

  if (error) throw error;

  return data || [];
}