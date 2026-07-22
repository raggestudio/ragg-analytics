import { supabase } from "../lib/supabase";
import type { Periodo } from "../types/periodo";

export async function obtenerPeriodosPorEmpresa(
  empresaId: string
): Promise<Periodo[]> {

  console.log("Empresa:", empresaId);

  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .eq("empresa_id", empresaId);

  if (error) throw error;

  return data ?? [];
}