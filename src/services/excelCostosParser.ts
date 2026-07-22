import * as XLSX from "xlsx";

export type InsumoExcel = {
  nombre: string;
  precio: number;
  observaciones: string | null;
};

export type RecetaExcel = {
  nombre: string;
  rendimiento: number | null;
  costo_total: number | null;
  costo_kg: number | null;
};

export type RecetaDetalleExcel = {
  receta_nombre: string;
  seccion: string | null;
  insumo_receta: string | null;
  insumo_costo: string | null;
  cantidad: number;
  precio_unitario: number;
  costo: number;
  nota: string | null;
};

export type CostosExcelParseResult = {
  insumos: InsumoExcel[];
  recetas: RecetaExcel[];
  detalles: RecetaDetalleExcel[];
};

function numero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;

  if (typeof valor === "number") return valor;

  return Number(
    String(valor)
      .replace(/\$/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

export async function parsearExcelCostos(file: File): Promise<CostosExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const hojaInsumos = workbook.Sheets["Insumos"];
  const hojaRecetas = workbook.Sheets["Recetas"];
  const hojaResumen = workbook.Sheets["Resumen"];

  if (!hojaInsumos || !hojaRecetas || !hojaResumen) {
    throw new Error("El Excel debe tener hojas Insumos, Recetas y Resumen.");
  }

  const insumosRows = XLSX.utils.sheet_to_json<any[]>(hojaInsumos, {
    header: 1,
    defval: "",
  });

  const recetasRows = XLSX.utils.sheet_to_json<any[]>(hojaRecetas, {
    header: 1,
    defval: "",
  });

  const resumenRows = XLSX.utils.sheet_to_json<any[]>(hojaResumen, {
    header: 1,
    defval: "",
  });

  const insumos: InsumoExcel[] = [];

  for (let i = 1; i < insumosRows.length; i++) {
    const row = insumosRows[i];

    const nombre = texto(row[0]);
    const precio = numero(row[1]);
    const observaciones = texto(row[2]) || null;

    if (!nombre) continue;

    insumos.push({
      nombre,
      precio,
      observaciones,
    });
  }

  const recetas: RecetaExcel[] = [];

  for (let i = 1; i < resumenRows.length; i++) {
    const row = resumenRows[i];

    const nombre = texto(row[0]);
    if (!nombre) continue;

    recetas.push({
      nombre,
      rendimiento: numero(row[9]) || null,
      costo_total: numero(row[3]) + numero(row[7]) + numero(row[8]),
      costo_kg: numero(row[10]) || null,
    });
  }

  const detalles: RecetaDetalleExcel[] = [];

  for (let i = 1; i < recetasRows.length; i++) {
    const row = recetasRows[i];

    const receta_nombre = texto(row[0]);
    const seccion = texto(row[2]) || null;
    const insumo_receta = texto(row[3]) || null;
    const cantidad = numero(row[4]);
    const insumo_costo = texto(row[5]) || null;
    const precio_unitario = numero(row[6]);
    const costo = numero(row[7]);
    const nota = texto(row[8]) || null;

    if (!receta_nombre || !insumo_costo || cantidad === 0) continue;

    detalles.push({
      receta_nombre,
      seccion,
      insumo_receta,
      insumo_costo,
      cantidad,
      precio_unitario,
      costo,
      nota,
    });
  }

  return {
    insumos,
    recetas,
    detalles,
  };
}

export default parsearExcelCostos;