import { supabase } from "../lib/supabase";
import type { SaborPedidosYaResumen } from "./pedidosYaSaboresParser";

export type GuardarSaboresPedidosYaInput = {
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id: string;
  importacion_id?: string | null;
  periodo_anio: number;
  periodo_mes: number;
  sabores: SaborPedidosYaResumen[];
};

export type SaborPedidosYa = {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  periodo_id: string;
  importacion_id: string | null;
  periodo_anio: number;
  periodo_mes: number;
  sabor: string;
  sabor_normalizado: string;
  cantidad: number;
  participacion: number;
  ranking: number;
  created_at: string;
  updated_at: string;
};

export async function reemplazarResumenSaboresPedidosYa(
  input: GuardarSaboresPedidosYaInput
) {
  let deleteQuery = supabase
    .from("pedidosya_sabores_resumen")
    .delete()
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    deleteQuery = deleteQuery.eq("sucursal_id", input.sucursal_id);
  } else {
    deleteQuery = deleteQuery.is("sucursal_id", null);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) throw deleteError;

  if (input.sabores.length === 0) {
    return {
      guardados: 0,
    };
  }

  const filas = input.sabores.map((sabor) => ({
    empresa_id: input.empresa_id,
    sucursal_id: input.sucursal_id || null,
    periodo_id: input.periodo_id,
    importacion_id: input.importacion_id || null,
    periodo_anio: input.periodo_anio,
    periodo_mes: input.periodo_mes,
    sabor: sabor.sabor,
    sabor_normalizado: sabor.sabor_normalizado,
    cantidad: Number(sabor.cantidad || 0),
    participacion: Number(sabor.participacion || 0),
    ranking: Number(sabor.ranking || 0),
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from("pedidosya_sabores_resumen")
    .insert(filas);

  if (insertError) throw insertError;

  return {
    guardados: filas.length,
  };
}

export async function obtenerSaboresPedidosYaPorPeriodo(input: {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
}): Promise<SaborPedidosYa[]> {
  let query = supabase
    .from("pedidosya_sabores_resumen")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .order("ranking", { ascending: true });

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    cantidad: Number(item.cantidad || 0),
    participacion: Number(item.participacion || 0),
    ranking: Number(item.ranking || 0),
  }));
}

export async function obtenerSaboresPedidosYaPorPeriodos(input: {
  empresa_id: string;
  periodo_ids: string[];
  sucursal_id?: string | null;
}): Promise<SaborPedidosYa[]> {
  if (input.periodo_ids.length === 0) return [];

  let query = supabase
    .from("pedidosya_sabores_resumen")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .in("periodo_id", input.periodo_ids);

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    cantidad: Number(item.cantidad || 0),
    participacion: Number(item.participacion || 0),
    ranking: Number(item.ranking || 0),
  }));
}

export function agruparSaboresPedidosYa(
  filas: SaborPedidosYa[]
): SaborPedidosYa[] {
  const acumulado = new Map<string, SaborPedidosYa>();

  for (const fila of filas) {
    const existente = acumulado.get(fila.sabor_normalizado);

    if (existente) {
      existente.cantidad += Number(fila.cantidad || 0);
    } else {
      acumulado.set(fila.sabor_normalizado, {
        ...fila,
        cantidad: Number(fila.cantidad || 0),
      });
    }
  }

  const total = Array.from(acumulado.values()).reduce(
    (acc, item) => acc + Number(item.cantidad || 0),
    0
  );

  return Array.from(acumulado.values())
    .sort((a, b) => Number(b.cantidad) - Number(a.cantidad))
    .map((item, index) => ({
      ...item,
      ranking: index + 1,
      participacion:
        total > 0 ? (Number(item.cantidad || 0) / total) * 100 : 0,
    }));
}

export function obtenerTopSabores(
  filas: SaborPedidosYa[],
  limite = 10
) {
  return [...filas]
    .sort((a, b) => Number(b.cantidad) - Number(a.cantidad))
    .slice(0, limite);
}

export function obtenerSaboresMenosVendidos(
  filas: SaborPedidosYa[],
  limite = 5
) {
  return [...filas]
    .filter((item) => Number(item.cantidad || 0) > 0)
    .sort((a, b) => Number(a.cantidad) - Number(b.cantidad))
    .slice(0, limite);
}