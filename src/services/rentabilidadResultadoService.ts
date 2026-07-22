import { supabase } from "../lib/supabase";

export type RentabilidadProducto = {
  id: string;
  nombre_producto: string;
  categoria: string | null;
  cantidad: number;
  ventas: number;
  costo_total: number;
  margen: number;
  margen_porcentaje: number;
};

export async function obtenerRentabilidadPeriodo(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
}): Promise<RentabilidadProducto[]> {
  let query = supabase
    .from("rentabilidad_periodo")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .order("margen", { ascending: false });

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
}