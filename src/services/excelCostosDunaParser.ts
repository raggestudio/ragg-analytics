import * as XLSX from "xlsx";

export type CostoProductoDunaExcel = {
  nombre: string;
  costo: number;
  precio_referencia: number | null;
};

export type CostosDunaParseResult = {
  productos: CostoProductoDunaExcel[];
};

function texto(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function numero(valor: unknown): number {
  if (valor === null || valor === undefined || valor === "") return 0;

  if (typeof valor === "number") return valor;

  const limpio = String(valor)
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!limpio) return 0;

  /*
    Soporta:
    1.234,56
    1234,56
    1,234.56
    1234.56
  */
  if (limpio.includes(",") && limpio.includes(".")) {
    const ultimaComa = limpio.lastIndexOf(",");
    const ultimoPunto = limpio.lastIndexOf(".");

    if (ultimaComa > ultimoPunto) {
      return (
        Number(
          limpio
            .replace(/\./g, "")
            .replace(",", ".")
        ) || 0
      );
    }

    return Number(limpio.replace(/,/g, "")) || 0;
  }

  if (limpio.includes(",")) {
    return Number(limpio.replace(",", ".")) || 0;
  }

  return Number(limpio) || 0;
}

function normalizarEncabezado(valor: unknown): string {
  return texto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function parsearExcelCostosDuna(
  file: File
): Promise<CostosDunaParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
  });

  const nombreHoja =
    workbook.SheetNames.find(
      (nombre) =>
        normalizarEncabezado(nombre) === "costos"
    ) || workbook.SheetNames[0];

  const hoja = workbook.Sheets[nombreHoja];

  if (!hoja) {
    throw new Error(
      "No se encontró una hoja válida en el Excel de costos de Duna."
    );
  }

  const filas = XLSX.utils.sheet_to_json<any[]>(hoja, {
    header: 1,
    defval: "",
    raw: true,
  });

  if (filas.length === 0) {
    throw new Error(
      "La planilla de costos de Duna está vacía."
    );
  }

  let indiceEncabezado = -1;
  let columnaProducto = -1;
  let columnaCosto = -1;
  let columnaPrecio = -1;

  for (let i = 0; i < Math.min(filas.length, 20); i++) {
    const fila = filas[i];

    const encabezados = fila.map(normalizarEncabezado);

    const productoIndex = encabezados.findIndex(
      (valor) =>
        valor === "producto" ||
        valor === "nombre" ||
        valor === "articulo"
    );

    const costoIndex = encabezados.findIndex(
      (valor) =>
        valor === "costo" ||
        valor === "costo unitario" ||
        valor === "costo por unidad"
    );

    const precioIndex = encabezados.findIndex(
      (valor) =>
        valor === "precio x unidad" ||
        valor === "precio por unidad" ||
        valor === "precio" ||
        valor === "precio venta"
    );

    if (productoIndex >= 0 && costoIndex >= 0) {
      indiceEncabezado = i;
      columnaProducto = productoIndex;
      columnaCosto = costoIndex;
      columnaPrecio = precioIndex;
      break;
    }
  }

  if (
    indiceEncabezado === -1 ||
    columnaProducto === -1 ||
    columnaCosto === -1
  ) {
    throw new Error(
      "No se encontraron las columnas Producto y Costo en la planilla de Duna."
    );
  }

  const acumulado = new Map<
    string,
    CostoProductoDunaExcel
  >();

  for (
    let i = indiceEncabezado + 1;
    i < filas.length;
    i++
  ) {
    const fila = filas[i];

    const nombre = texto(fila[columnaProducto]);
    const costo = numero(fila[columnaCosto]);

    const precioReferencia =
      columnaPrecio >= 0
        ? numero(fila[columnaPrecio])
        : 0;

    if (!nombre) continue;
    if (costo <= 0) continue;

    const clave = normalizarEncabezado(nombre);

    acumulado.set(clave, {
      nombre,
      costo,
      precio_referencia:
        precioReferencia > 0
          ? precioReferencia
          : null,
    });
  }

  const productos = Array.from(
    acumulado.values()
  ).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );

  if (productos.length === 0) {
    throw new Error(
      "No se detectaron productos con costo válido en la planilla de Duna."
    );
  }

  console.log(
    "COSTOS DUNA PRODUCTOS",
    productos
  );

  return {
    productos,
  };
}

export default parsearExcelCostosDuna;