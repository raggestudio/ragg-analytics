import { supabase } from "../lib/supabase";
import type { Importacion } from "../types/importacion";

export async function crearImportacion(input: {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id?: string | null;
  periodo_anio?: number | null;
  periodo_mes?: number | null;
  archivo_nombre: string;
  tipo: string;
  registros_importados?: number;
  errores?: number;
}) {
  console.log("INPUT RECIBIDO EN crearImportacion", input);
  
  const { data, error } = await supabase
    .from("importaciones")
    .insert({
      empresa_id: input.empresa_id,
      sucursal_id: input.sucursal_id || null,
      periodo_id: input.periodo_id || null,
      periodo_anio: input.periodo_anio || null,
      periodo_mes: input.periodo_mes || null,
      archivo_nombre: input.archivo_nombre,
      tipo: input.tipo,
      estado: "importado",
      registros_importados: input.registros_importados || 0,
      errores: input.errores || 0,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function obtenerImportacionesPorEmpresa(
  empresaId: string
): Promise<Importacion[]> {
  const { data, error } = await supabase
    .from("importaciones")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}