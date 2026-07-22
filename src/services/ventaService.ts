import { supabase } from "../lib/supabase";

export type Venta = {
  id: string;
  empresa_id: string;
  sucursal_id: string | null;
  periodo_id: string | null;
  periodo_anio: number | null;
  periodo_mes: number | null;
  fecha: string;
  origen: string;
  pedidos: number;
  rechazados: number;
  ventas: number;
  delivery: number;
  pickup: number;
  total: number;
};

export async function reemplazarVentasPedidosYa(
  empresaId: string,
  ventas: {
    sucursal_id?: string | null;
    periodo_id?: string | null;
    periodo_anio?: number | null;
    periodo_mes?: number | null;
    fecha: string;
    pedidos: number;
    rechazados: number;
    ventas: number;
    delivery: number;
    pickup: number;
  }[]
) {
  if (ventas.length === 0) return;

  const sucursalId = ventas[0]?.sucursal_id || null;
  const periodoId = ventas[0]?.periodo_id || null;

  let deleteQuery = supabase
    .from("ventas")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("origen", "PedidosYa");

  if (sucursalId) {
    deleteQuery = deleteQuery.eq("sucursal_id", sucursalId);
  }

  if (periodoId) {
    deleteQuery = deleteQuery.eq("periodo_id", periodoId);
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  const { error } = await supabase.from("ventas").insert(
    ventas.map((v) => ({
      empresa_id: empresaId,
      sucursal_id: v.sucursal_id || null,
      periodo_id: v.periodo_id || null,
      periodo_anio: v.periodo_anio || null,
      periodo_mes: v.periodo_mes || null,
      fecha: v.fecha,
      origen: "PedidosYa",
      pedidos: v.pedidos,
      rechazados: v.rechazados,
      ventas: v.ventas,
      delivery: v.delivery,
      pickup: v.pickup,
      total: v.ventas,
      estado: "importado",
    }))
  );

  if (error) throw error;
}

export async function obtenerVentasPorEmpresa(
  empresaId: string
): Promise<Venta[]> {
  const { data, error } = await supabase
    .from("ventas")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: true });

  if (error) throw error;

  return data || [];
}