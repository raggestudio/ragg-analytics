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
  const texto = String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const meses: Record<string, number> = {
    ene: 1, enero: 1,
    feb: 2, febrero: 2,
    mar: 3, marzo: 3,
    abr: 4, abril: 4,
    may: 5, mayo: 5,
    jun: 6, junio: 6,
    jul: 7, julio: 7,
    ago: 8, agosto: 8,
    sep: 9, set: 9, septiembre: 9, setiembre: 9,
    oct: 10, octubre: 10,
    nov: 11, noviembre: 11,
    dic: 12, diciembre: 12,
  };

  const numerico = texto.match(/^(\d{1,2})[\/-](\d{2}|\d{4})$/);
  const nombrado = texto.match(/^([a-z]+)[\s\/-]+(\d{2}|\d{4})$/);
  if (!numerico && !nombrado) return null;

  const mes = numerico ? Number(numerico[1]) : meses[nombrado![1]];
  const anioCorto = Number((numerico || nombrado)![2]);
  const anio = anioCorto < 100 ? 2000 + anioCorto : anioCorto;
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
