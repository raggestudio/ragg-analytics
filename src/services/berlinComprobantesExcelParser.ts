import * as XLSX from "xlsx";

export type ModalidadBerlinComprobante = "salon" | "delivery" | "take_away";

export type VentaBerlinComprobante = {
  fecha: string;
  hora: string | null;
  comprobante: string;
  comprobante_id: string;
  ticket: string;
  documento: string;
  mesa: string | null;
  mozo: string | null;
  modalidad: ModalidadBerlinComprobante;
  canal: ModalidadBerlinComprobante;
  producto: string;
  nombre_producto: string;
  cantidad: number;
  importe: number;
  precio_unitario: number;
  venta_total: number;
  total: number;
  ventas: number;
  total_ticket: number | null;
  observaciones: string | null;
};

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function numero(valor: unknown) {
  if (typeof valor === "number") return valor;

  const raw = texto(valor)
    .replace(/\$/g, "")
    .replace(/\s/g, "");

  if (!raw) return 0;

  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
    }

    return Number(raw.replace(/,/g, "")) || 0;
  }

  if (raw.includes(",")) {
    return Number(raw.replace(",", ".")) || 0;
  }

  return Number(raw) || 0;
}

function fechaIso(valor: unknown) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(valor.getDate()).padStart(2, "0")}`;
  }

  const raw = texto(valor);

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const uy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (uy) {
    const anio = uy[3].length === 2 ? `20${uy[3]}` : uy[3];
    return `${anio}-${uy[2].padStart(2, "0")}-${uy[1].padStart(2, "0")}`;
  }

  return "";
}

function valorFila(
  fila: Record<string, unknown>,
  ...nombres: string[]
) {
  for (const nombre of nombres) {
    if (Object.prototype.hasOwnProperty.call(fila, nombre)) {
      return fila[nombre];
    }
  }

  return undefined;
}

export async function leerComprobantesBerlinExcel(
  archivo: File,
  modalidad: ModalidadBerlinComprobante
): Promise<VentaBerlinComprobante[]> {
  const libro = XLSX.read(await archivo.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });

  const nombreHoja =
    libro.SheetNames.find((n) => n === "Importar_Delivery") ||
    libro.SheetNames.find((n) => n === "Importar_Salon") ||
    libro.SheetNames.find((n) => n === "Importar_Takeaway") ||
    libro.SheetNames.find((n) => n.startsWith("Importar_")) ||
    libro.SheetNames[0];

  const hoja = libro.Sheets[nombreHoja];

  if (!hoja) {
    throw new Error("No se encontró una hoja de comprobantes de Berlín.");
  }

  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
    raw: true,
  });

  const ventas: VentaBerlinComprobante[] = [];

  filas.forEach((fila, index) => {
    const fecha = fechaIso(valorFila(fila, "Fecha", "fecha"));
    const producto = texto(
      valorFila(fila, "Producto", "nombre_producto", "producto")
    );
    const cantidad = numero(valorFila(fila, "Cantidad", "cantidad"));
    const importe = numero(
      valorFila(fila, "Importe", "total", "ventas", "venta_total")
    );
    const comprobante =
      texto(valorFila(fila, "Comprobante", "comprobante", "ticket", "documento")) ||
      `fila-${index + 2}`;

    if (!fecha || !producto || cantidad <= 0 || importe <= 0) {
      return;
    }

    const modalidadFila = texto(
      valorFila(fila, "Modalidad", "modalidad", "canal")
    )
      .toLowerCase()
      .replace(/\s+/g, "");

    const modalidadFinal: ModalidadBerlinComprobante =
      modalidadFila === "salon" || modalidadFila === "salón"
        ? "salon"
        : modalidadFila === "delivery"
          ? "delivery"
          : modalidadFila === "takeaway" ||
              modalidadFila === "take-away" ||
              modalidadFila === "take"
            ? "take_away"
            : modalidad;

    ventas.push({
      fecha,
      hora: texto(valorFila(fila, "Hora", "hora")) || null,
      comprobante,
      comprobante_id: comprobante,
      ticket: comprobante,
      documento: comprobante,
      mesa: texto(valorFila(fila, "Mesa", "mesa")) || null,
      mozo: texto(valorFila(fila, "Mozo", "mozo")) || null,
      modalidad: modalidadFinal,
      canal: modalidadFinal,
      producto,
      nombre_producto: producto,
      cantidad,
      importe,
      precio_unitario: cantidad > 0 ? importe / cantidad : importe,
      venta_total: importe,
      total: importe,
      ventas: importe,
      total_ticket:
        numero(valorFila(fila, "Total ticket", "total_ticket")) || null,
      observaciones:
        texto(valorFila(fila, "Revision", "observaciones")) || null,
    });
  });

  if (!ventas.length) {
    throw new Error(
      "No se encontraron filas válidas. La hoja debe tener Fecha, Producto, Cantidad e Importe."
    );
  }

  return ventas;
}
