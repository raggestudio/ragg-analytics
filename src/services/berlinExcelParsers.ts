import * as XLSX from "xlsx";

export type VentaBerlinImportada = {
  documento: string;
  fecha: string | null;
  modalidad: "salon" | "delivery" | "take_away";
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
  venta_total: number;
};

function texto(valor: unknown) {
  return String(valor ?? "").replace(/\s+/g, " ").trim();
}

function clave(valor: unknown) {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numero(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const original = texto(valor).replace(/[$\s]/g, "");
  if (!original) return 0;
  if (original.includes(",") && original.includes(".")) {
    return original.lastIndexOf(",") > original.lastIndexOf(".")
      ? Number(original.replace(/\./g, "").replace(",", ".")) || 0
      : Number(original.replace(/,/g, "")) || 0;
  }
  return Number(original.replace(",", ".")) || 0;
}

function fechaIso(valor: unknown): string | null {
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "number") {
    const f = XLSX.SSF.parse_date_code(valor);
    if (f) return new Date(f.y, f.m - 1, f.d).toISOString();
  }
  const raw = texto(valor);
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (match) {
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return new Date(year, Number(match[2]) - 1, Number(match[1])).toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function modalidad(valor: unknown): VentaBerlinImportada["modalidad"] {
  const value = clave(valor);
  if (value.includes("take")) return "take_away";
  if (value.includes("delivery")) return "delivery";
  return "salon";
}

function filasDeHoja(fileData: ArrayBuffer, preferred?: string) {
  const book = XLSX.read(fileData, { type: "array", cellDates: true });
  const name = book.SheetNames.find((n) => clave(n).includes(clave(preferred || ""))) || book.SheetNames[0];
  const sheet = book.Sheets[name];
  if (!sheet) throw new Error("El Excel no contiene una hoja legible.");
  return XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: "" });
}

function buscarEncabezado(filas: any[][], requeridos: string[][]) {
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    const headers = filas[i].map(clave);
    const indexes = requeridos.map((variants) =>
      headers.findIndex((header) => variants.some((variant) => header.includes(variant)))
    );
    if (indexes.every((index) => index >= 0)) return { row: i, indexes };
  }
  return null;
}

export async function leerInfoClubBerlin(file: File): Promise<VentaBerlinImportada[]> {
  const filas = filasDeHoja(await file.arrayBuffer(), "comprobantes");
  // InfoClub imprime cada comprobante en una fila y sus artículos en las filas
  // siguientes. Conservamos fecha/número hasta encontrar el próximo comprobante.
  let documento = "";
  let fecha: string | null = null;
  const ventas: VentaBerlinImportada[] = [];
  for (const row of filas) {
    const posibleFecha = fechaIso(row[0]);
    if (posibleFecha && texto(row[1]) && clave(row[2]).includes("ticket")) {
      fecha = posibleFecha;
      documento = texto(row[1]);
      continue;
    }
    const nombre = texto(row[2]);
    const cantidad = numero(row[5]);
    const total = numero(row[6]);
    if (!documento || !nombre || !texto(row[1]) || cantidad === 0 || total === 0) continue;
    ventas.push({
      documento, fecha, modalidad: "salon", nombre_producto: nombre, cantidad,
      precio_unitario: numero(row[4]) || total / cantidad, venta_total: total,
    });
  }
  if (!ventas.length) throw new Error("InfoClub fue leído, pero no se detectaron ventas.");
  return ventas;
}

export async function leerHistoricoNoFacturadoBerlin(file: File): Promise<VentaBerlinImportada[]> {
  const filas = filasDeHoja(await file.arrayBuffer(), "facturacion");
  const found = buscarEncabezado(filas, [
    ["fecha"], ["factura pedido", "factura", "pedido"], ["facturado"], ["producto"],
    ["cantidad"], ["p unitario", "precio unitario"], ["total"], ["modalidad"],
  ]);
  if (!found) throw new Error("No se reconoció la hoja Facturación histórica de Berlín.");
  const [fechaI, docI, facturadoI, productoI, cantidadI, precioI, totalI, modalidadI] = found.indexes;
  const ventas = filas.slice(found.row + 1).filter((row) => clave(row[facturadoI]) === "no").map((row) => {
    const cantidad = numero(row[cantidadI]);
    const total = numero(row[totalI]);
    return {
      documento: texto(row[docI]), fecha: fechaIso(row[fechaI]), modalidad: modalidad(row[modalidadI]),
      nombre_producto: texto(row[productoI]), cantidad,
      precio_unitario: numero(row[precioI]) || (cantidad ? total / cantidad : 0), venta_total: total,
    };
  }).filter((item) => item.documento && item.nombre_producto && item.cantidad !== 0 && item.venta_total !== 0);
  if (!ventas.length) throw new Error("No se encontraron filas con Facturado = NO.");
  return ventas;
}

export function normalizarProductoBerlin(value: string) {
  const nombre = clave(value);

  const alias: Record<string, string> = {
    "refrescos linea coca cola 350ml": "refrescos linea coca",
    "refrescos linea coca": "refrescos linea coca",
    "agua vitale con": "agua vitale con y sin gas 600ml",
    "agua vitale con y": "agua vitale con y sin gas 600ml",
    "agua vitale con y sin gas 600ml": "agua vitale con y sin gas 600ml",
    "crumble manzana": "crumble de manzana",
    "crumble de manzana": "crumble de manzana",
  };

  return alias[nombre] || nombre;
}

export function nombreProductoBerlin(value: string) {
  const nombre = normalizarProductoBerlin(value);

  const nombres: Record<string, string> = {
    "refrescos linea coca": "REFRESCOS LÍNEA COCA COLA 350ML",
    "agua vitale con y sin gas 600ml": "AGUA VITALE CON Y SIN GAS 600ML",
    "crumble de manzana": "CRUMBLE DE MANZANA",
  };

  return nombres[nombre] || texto(value);
}
