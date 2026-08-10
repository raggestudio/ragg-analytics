import { supabase } from "../lib/supabase";
import type { GastoEmpresa, GastoEmpresaInput, SueldoGastoImportado } from "../types/gasto";

function convertir(fila: any): GastoEmpresa {
  return {
    ...fila,
    monto: Number(fila.monto || 0),
  } as GastoEmpresa;
}

export async function obtenerGastosPorPeriodo(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
}): Promise<GastoEmpresa[]> {
  let query = supabase
    .from("gastos_empresa")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  query = input.sucursal_id
    ? query.eq("sucursal_id", input.sucursal_id)
    : query.is("sucursal_id", null);

  const { data, error } = await query
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(convertir);
}

export async function obtenerTotalGastosDashboard(input: {
  empresa_id: string;
  periodo_ids: string[];
  sucursal_id?: string | null;
}): Promise<number> {
  if (input.periodo_ids.length === 0) return 0;

  const totales = await Promise.all(
    input.periodo_ids.map(async (periodoId) => {
      const { data, error } = await supabase.rpc(
        "obtener_total_gastos_dashboard",
        {
          p_empresa_id: input.empresa_id,
          p_periodo_id: periodoId,
          p_sucursal_id: input.sucursal_id || null,
        }
      );

      if (error) throw error;
      return Number(data || 0);
    })
  );

  return totales.reduce((total, monto) => total + monto, 0);
}

export async function crearGasto(input: GastoEmpresaInput): Promise<GastoEmpresa> {
  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("El importe debe ser mayor a cero.");
  }

  const { data, error } = await supabase
    .from("gastos_empresa")
    .insert({
      empresa_id: input.empresa_id,
      sucursal_id: input.sucursal_id || null,
      periodo_id: input.periodo_id,
      categoria: input.categoria,
      detalle: input.detalle?.trim() || null,
      monto,
      fecha: input.fecha || null,
      observaciones: input.observaciones?.trim() || null,
      origen: input.origen || "manual",
      referencia: input.referencia?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return convertir(data);
}

export async function reemplazarSalariosDesdeCsv(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
  filas: SueldoGastoImportado[];
}) {
  const { data, error } = await supabase.rpc("reemplazar_salarios_gastos", {
    p_empresa_id: input.empresa_id,
    p_periodo_id: input.periodo_id,
    p_sucursal_id: input.sucursal_id || null,
    p_filas: input.filas,
  });

  if (error) throw error;
  return Number(data || 0);
}

export async function actualizarGasto(
  id: string,
  input: GastoEmpresaInput
): Promise<GastoEmpresa> {
  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("El importe debe ser mayor a cero.");
  }

  const { data, error } = await supabase
    .from("gastos_empresa")
    .update({
      categoria: input.categoria,
      sucursal_id: input.sucursal_id || null,
      detalle: input.detalle?.trim() || null,
      monto,
      fecha: input.fecha || null,
      observaciones: input.observaciones?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("empresa_id", input.empresa_id)
    .select("*")
    .single();

  if (error) throw error;
  return convertir(data);
}

export async function eliminarGasto(id: string, empresaId: string) {
  const { error } = await supabase
    .from("gastos_empresa")
    .delete()
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) throw error;
}
