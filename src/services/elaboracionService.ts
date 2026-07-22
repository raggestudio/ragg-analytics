import { supabase } from "../lib/supabase";
import type { ElaboracionExcel } from "./excelProduccionParser";

export async function importarElaboraciones(input: {
  empresa_id: string;
  periodo_id?: string | null;
  periodo_anio: number;
  periodo_mes: number;
  archivo_nombre: string;
  elaboraciones: ElaboracionExcel[];
}) {
  await supabase
    .from("elaboraciones")
    .delete()
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_anio", input.periodo_anio)
    .eq("periodo_mes", input.periodo_mes);

  let importadas = 0;
  let sin_receta = 0;

  const filas = input.elaboraciones.map((e) => {
    importadas++;

    return {
      empresa_id: input.empresa_id,
      periodo_id: input.periodo_id ?? null,
      periodo_anio: input.periodo_anio,
      periodo_mes: input.periodo_mes,
      fecha: e.fecha,
      producto: e.producto,
      kilos: e.kilos,
      responsable: e.responsable,
    };
  });

  if (filas.length > 0) {
    const { error } = await supabase
      .from("elaboraciones")
      .insert(filas);

    if (error) throw error;
  }

  return {
    importadas,
    sin_receta,
  };
}