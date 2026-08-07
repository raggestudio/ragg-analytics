import Papa from "papaparse";
import type { SueldoGastoImportado } from "../types/gasto";

function numero(valor: unknown) {
  let texto = String(valor ?? "").trim().replace(/\s/g, "").replace(/\$/g, "");
  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }
  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : 0;
}

function periodo(valor: unknown) {
  const match = String(valor ?? "").trim().match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const mes = Number(match[1]);
  const anio = Number(match[2]);
  if (mes < 1 || mes > 12) return null;
  return { mes, anio };
}

export function leerCsvSueldos(file: File): Promise<SueldoGastoImportado[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: (resultado) => {
        if (resultado.errors.length > 0) {
          reject(new Error(resultado.errors[0].message));
          return;
        }

        const filas: SueldoGastoImportado[] = [];
        for (const fila of resultado.data) {
          const periodoFila = periodo(fila.Periodo);
          const nombre = String(fila.Nombre || "").trim();
          const liquido = numero(fila.Liquido);
          if (!periodoFila || !nombre || liquido <= 0) continue;

          filas.push({
            periodo_anio: periodoFila.anio,
            periodo_mes: periodoFila.mes,
            liquidacion: String(fila.Liquidacion || "").trim(),
            nombre,
            ci: String(fila.CI || "").trim(),
            haberes: numero(fila.Haberes),
            descuentos: numero(fila.Descuentos),
            liquido,
            costo: numero(fila.Costo),
          });
        }

        if (filas.length === 0) {
          reject(new Error("No se detectaron empleados con un salario líquido válido en el CSV."));
          return;
        }
        resolve(filas);
      },
      error: (error) => reject(error),
    });
  });
}
