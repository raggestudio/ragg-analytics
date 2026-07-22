import { supabase } from "../lib/supabase";
import type {
  CostosDunaParseResult,
  CostoProductoDunaExcel,
} from "./excelCostosDunaParser";

export type CostoProductoManual = {
  id: string;
  empresa_id: string;
  codigo_producto: string | null;
  nombre_producto: string;
  costo: number;
  precio_referencia: number | null;
  origen: string;
  estimado: boolean;
  activo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function importarCostosManualesDuna(input: {
  empresa_id: string;
  data: CostosDunaParseResult;
}) {
  const empresaId = input.empresa_id;

  /*
    Primero dejamos inactivos los costos anteriores importados desde Duna.

    No los borramos porque pueden estar vinculados por producto_vinculacion.
    Los productos que sigan existiendo en el Excel se reactivan mediante upsert.
  */
  const { error: desactivarError } = await supabase
    .from("producto_costo_manual")
    .update({
      activo: false,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId)
    .eq("origen", "excel_duna");

  if (desactivarError) throw desactivarError;

  if (input.data.productos.length === 0) {
    return {
      importados: 0,
      actualizados: 0,
    };
  }

  const ahora = new Date().toISOString();

  const filas = input.data.productos.map(
    (producto: CostoProductoDunaExcel) => ({
      empresa_id: empresaId,
      codigo_producto: null,
      nombre_producto: producto.nombre,
      costo: Number(producto.costo || 0),
      precio_referencia:
        producto.precio_referencia === null
          ? null
          : Number(producto.precio_referencia),
      origen: "excel_duna",
      estimado: false,
      activo: true,
      updated_at: ahora,
    })
  );

  /*
    La tabla tiene una restricción única por:
    empresa_id + nombre_producto

    Si el producto ya existe, actualiza costo, precio y estado,
    conservando el mismo ID y todas sus vinculaciones.
  */
  const { data, error: upsertError } = await supabase
    .from("producto_costo_manual")
    .upsert(filas, {
      onConflict: "empresa_id,nombre_producto",
    })
    .select("id");

  if (upsertError) throw upsertError;

  return {
    importados: filas.length,
    actualizados: data?.length || 0,
  };
}

export async function obtenerCostosManualesPorEmpresa(
  empresaId: string
): Promise<CostoProductoManual[]> {
  const { data, error } = await supabase
    .from("producto_costo_manual")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre_producto", { ascending: true });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    ...item,
    costo: Number(item.costo || 0),
    precio_referencia:
      item.precio_referencia === null
        ? null
        : Number(item.precio_referencia),
  }));
}

export function buscarCostoManualPorNombre(
  nombreProducto: string,
  costos: CostoProductoManual[]
): CostoProductoManual | null {
  const nombreNormalizado = normalizar(nombreProducto);

  const coincidenciaExacta = costos.find(
    (costo) =>
      normalizar(costo.nombre_producto) === nombreNormalizado
  );

  if (coincidenciaExacta) return coincidenciaExacta;

  const coincidenciaContenida = costos.find((costo) => {
    const costoNormalizado = normalizar(costo.nombre_producto);

    return (
      costoNormalizado.includes(nombreNormalizado) ||
      nombreNormalizado.includes(costoNormalizado)
    );
  });

  return coincidenciaContenida || null;
}