import * as XLSX from "xlsx";

export type ElaboracionExcel = {
  fecha: string;
  producto: string;
  kilos: number;
  responsable: string | null;
  periodo_anio: number;
  periodo_mes: number;
};

export type ProduccionParseResult = {
  elaboraciones: ElaboracionExcel[];
};

function texto(valor: unknown): string {
  return String(valor ?? "").trim();
}

function numero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;

  return (
    Number(
      String(valor)
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    ) || 0
  );
}

function fechaExcel(valor: unknown): Date | null {
  if (!valor) return null;

  if (valor instanceof Date) return valor;

  if (typeof valor === "number") {
    const parsed = XLSX.SSF.parse_date_code(valor);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const valorTexto = texto(valor);
  const partes = valorTexto.split(/[\/\-]/);

  if (partes.length >= 3) {
    const dia = Number(partes[0]);
    const mes = Number(partes[1]);
    const anio = Number(
      partes[2].length === 2 ? `20${partes[2]}` : partes[2]
    );

    if (dia && mes && anio) {
      return new Date(anio, mes - 1, dia);
    }
  }

  return null;
}

function fechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

export async function leerExcelProduccion(
  file: File
): Promise<ProduccionParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const hoja =
    workbook.Sheets["Hoja1"] ||
    workbook.Sheets["Registro"] ||
    workbook.Sheets["Producción"] ||
    workbook.Sheets["Produccion"] ||
    workbook.Sheets[workbook.SheetNames[0]];

  if (!hoja) {
    throw new Error("No se encontró una hoja válida de producción.");
  }

  const rows = XLSX.utils.sheet_to_json<any[]>(hoja, {
    header: 1,
    defval: "",
  });

  const elaboraciones: ElaboracionExcel[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const fecha = fechaExcel(row[0]);
    const producto = texto(row[1]);

    // En tu planilla, la columna Cantidad está en K.
    const kilos = numero(row[10]);

    // Responsable está en L.
    const responsable = texto(row[11]) || null;

    if (!fecha || !producto || kilos <= 0) continue;

    elaboraciones.push({
      fecha: fechaISO(fecha),
      producto,
      kilos,
      responsable,
      periodo_anio: fecha.getFullYear(),
      periodo_mes: fecha.getMonth() + 1,
    });
  }

  return { elaboraciones };
}

export default leerExcelProduccion;