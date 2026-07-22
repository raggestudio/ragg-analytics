import Papa from "papaparse";

export type CsvPreview = {
  filas: Record<string, string>[];
  columnas: string[];
};

function limpiarClave(clave: string) {
  return String(clave || "").replace(/^\uFEFF/, "").trim();
}

function normalizarFila(fila: Record<string, string>) {
  const normalizada: Record<string, string> = {};

  for (const [clave, valor] of Object.entries(fila)) {
    normalizada[limpiarClave(clave)] = String(valor ?? "").trim();
  }

  return normalizada;
}

export function leerCsv(file: File): Promise<CsvPreview> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: "",
      transformHeader: limpiarClave,
      complete: (result) => {
        const filas = result.data.map(normalizarFila);
        const columnas = (result.meta.fields || []).map(limpiarClave);

        resolve({
          filas,
          columnas,
        });
      },
      error: reject,
    });
  });
}