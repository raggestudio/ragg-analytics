import { supabase } from "../lib/supabase";
import {
  agruparSaboresPedidosYa,
  obtenerSaboresPedidosYaPorPeriodos,
  type SaborPedidosYa,
} from "./pedidosYaSaboresService";

export type NivelCostoSabor =
  | "muy_bajo"
  | "medio"
  | "alto"
  | "muy_alto"
  | "sin_costo";

export type RentabilidadSaborPedidosYa = {
  sabor: string;
  sabor_normalizado: string;
  selecciones: number;
  participacion: number;
  costo_kg: number | null;
  nivel: NivelCostoSabor;
  receta_encontrada: boolean;
  nombre_receta: string | null;
};

export type ResumenCostosSaboresPedidosYa = {
  sabores: RentabilidadSaborPedidosYa[];
  costo_promedio_kg: number;
  sabor_mas_barato: RentabilidadSaborPedidosYa | null;
  sabor_mas_caro: RentabilidadSaborPedidosYa | null;
  sabores_vinculados: number;
  sabores_totales: number;
};

function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/cheese[\s-]*cake/g, "cheesecake")
    .replace(/\bddl\b/g, "dulce de leche")
    .replace(/\bdietetico\b/g, "")
    .replace(/\bdietetica\b/g, "")
    .replace(/\bdiet\b/g, "")
    .replace(/[()[\]{}.,;:_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const aliasRecetas: Record<string, string> = {
  "limon natural": "limon",
  limon: "limon",
  "crema dulcelate": "dulce late",
  "crema con crocante de coco vegano": "crema vegana con crocante de coco",
  "durazno naranja": "durazno con naranja",
};
function obtenerNivelCosto(costoKg: number | null): NivelCostoSabor {
  if (costoKg === null || costoKg <= 0) return "sin_costo";
  if (costoKg < 100) return "muy_bajo";
  if (costoKg < 180) return "medio";
  if (costoKg < 280) return "alto";
  return "muy_alto";
}

function buscarReceta(
  sabor: string,
  recetas: Array<{
    nombre: string;
    costo_kg: number | null;
  }>
) {
  const saborNormalizado = normalizar(sabor);

  const nombreBuscado =
    aliasRecetas[saborNormalizado] || saborNormalizado;

  // Primero busca exactamente el nombre o su alias.
  const exacta = recetas.find(
    (receta) => normalizar(receta.nombre) === nombreBuscado
  );

  if (exacta) return exacta;

  // Después intenta una coincidencia más flexible.
  const contenida = recetas.find((receta) => {
    const recetaNormalizada = normalizar(receta.nombre);

    return (
      recetaNormalizada.includes(nombreBuscado) ||
      nombreBuscado.includes(recetaNormalizada)
    );
  });

  if (contenida) return contenida;

  return undefined;
}

export async function obtenerCostosSaboresPedidosYa(input: {
  empresa_id: string;
  periodo_ids: string[];
  sucursal_id?: string | null;
}): Promise<ResumenCostosSaboresPedidosYa> {
  if (input.periodo_ids.length === 0) {
    return {
      sabores: [],
      costo_promedio_kg: 0,
      sabor_mas_barato: null,
      sabor_mas_caro: null,
      sabores_vinculados: 0,
      sabores_totales: 0,
    };
  }

  const filasSabores = await obtenerSaboresPedidosYaPorPeriodos({
    empresa_id: input.empresa_id,
    periodo_ids: input.periodo_ids,
    sucursal_id: input.sucursal_id || null,
  });

  const saboresBase: SaborPedidosYa[] =
  agruparSaboresPedidosYa(filasSabores);

const saboresUnificados = new Map<string, SaborPedidosYa>();

for (const sabor of saboresBase) {
  const nombreNormalizado = normalizar(sabor.sabor);

  const clave =
    nombreNormalizado === "limon natural"
      ? "limon"
      : nombreNormalizado;

  const existente = saboresUnificados.get(clave);

  if (existente) {
    existente.cantidad =
      Number(existente.cantidad || 0) +
      Number(sabor.cantidad || 0);
  } else {
    saboresUnificados.set(clave, {
      ...sabor,
      sabor: clave === "limon" ? "Limón" : sabor.sabor,
      sabor_normalizado: clave,
      cantidad: Number(sabor.cantidad || 0),
    });
  }
}

const totalSelecciones = Array.from(saboresUnificados.values()).reduce(
  (total, sabor) => total + Number(sabor.cantidad || 0),
  0
);

const saboresAgrupados: SaborPedidosYa[] =
  Array.from(saboresUnificados.values())
    .sort(
      (a, b) =>
        Number(b.cantidad || 0) -
        Number(a.cantidad || 0)
    )
    .map((sabor, index) => ({
      ...sabor,
      ranking: index + 1,
      participacion:
        totalSelecciones > 0
          ? (Number(sabor.cantidad || 0) / totalSelecciones) * 100
          : 0,
    }));

  const { data: recetasData, error: recetasError } = await supabase
    .from("recetas")
    .select("nombre, costo_kg")
    .eq("empresa_id", input.empresa_id);

  if (recetasError) throw recetasError;

  const recetas = (recetasData || []).map((receta: any) => ({
    nombre: String(receta.nombre || ""),
    costo_kg:
      receta.costo_kg === null || receta.costo_kg === undefined
        ? null
        : Number(receta.costo_kg),
  }));

  const sabores: RentabilidadSaborPedidosYa[] = saboresAgrupados.map(
  (sabor) => {
    const receta = buscarReceta(sabor.sabor, recetas);

    const costoKg =
      receta?.costo_kg && Number(receta.costo_kg) > 0
        ? Number(receta.costo_kg)
        : null;

      return {
        sabor: sabor.sabor,
        sabor_normalizado: sabor.sabor_normalizado,
        selecciones: Number(sabor.cantidad || 0),
        participacion: Number(sabor.participacion || 0),
        costo_kg: costoKg,
        nivel: obtenerNivelCosto(costoKg),
        receta_encontrada: costoKg !== null,
        nombre_receta: receta?.nombre || null,
      };
    }
  );

  const saboresConCosto = sabores.filter(
    (sabor) => sabor.costo_kg !== null && sabor.costo_kg > 0
  );

  const seleccionesConCosto = saboresConCosto.reduce(
    (total, sabor) => total + sabor.selecciones,
    0
  );

  const costoPonderado = saboresConCosto.reduce(
    (total, sabor) =>
      total + Number(sabor.costo_kg || 0) * sabor.selecciones,
    0
  );

  const costoPromedioKg =
    seleccionesConCosto > 0
      ? costoPonderado / seleccionesConCosto
      : 0;

  const ordenadosPorCosto = [...saboresConCosto].sort(
    (a, b) => Number(a.costo_kg) - Number(b.costo_kg)
  );

  return {
    sabores: sabores.sort((a, b) => b.selecciones - a.selecciones),
    costo_promedio_kg: costoPromedioKg,
    sabor_mas_barato: ordenadosPorCosto[0] || null,
    sabor_mas_caro:
      ordenadosPorCosto[ordenadosPorCosto.length - 1] || null,
    sabores_vinculados: saboresConCosto.length,
    sabores_totales: sabores.length,
  };
}