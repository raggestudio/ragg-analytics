import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ProductoIsatech = {
  fuente: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  categoria: string | null;
  codigo_producto: string | null;
  nombre_producto: string;
  cantidad: number;
  total: number;
  ganancia: number;
};

export type IsatechParseResult = {
  periodo_inicio: string | null;
  periodo_fin: string | null;
  productos: ProductoIsatech[];
};

function convertirFecha(fecha: string) {
  const [dia, mes, anioRaw] = fecha.split("/");
  const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;

  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function convertirNumero(valor: string) {
  return Number(valor.replace(/\./g, "").replace(",", "."));
}

function esCategoria(linea: string) {
  return [
    "HELADOS",
    "IMPULSIVOS",
    "BATIDOS",
    "CUCURUCHOS",
    "CAFE",
    "CAFÉ",
    "PEDIDOS YA",
    "SMOTHIES",
    "SMOOTHIES",
    "PROMO",
    "PROMOS",
  ].includes(linea.trim().toUpperCase());
}

function limpiarLinea(linea: string) {
  return linea.replace(/\s+/g, " ").trim();
}

function parsearProducto(
  linea: string,
  categoria: string | null,
  periodoInicio: string | null,
  periodoFin: string | null
): ProductoIsatech | null {
  const limpia = limpiarLinea(linea);

  const partes = limpia.split(" ");
  if (partes.length < 5) return null;

  const ganancia = partes[partes.length - 1];
  const total = partes[partes.length - 2];
  const cantidad = partes[partes.length - 3];
  const codigo = partes[0];
  const nombre = partes.slice(1, partes.length - 3).join(" ");

  if (!/^[\d.,]+$/.test(cantidad)) return null;
  if (!/^[\d.,]+$/.test(total)) return null;
  if (!/^[\d.,]+$/.test(ganancia)) return null;

  if (!nombre || nombre.length < 2) return null;

  return {
    fuente: "Isatech",
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    categoria,
    codigo_producto: codigo,
    nombre_producto: nombre,
    cantidad: convertirNumero(cantidad),
    total: convertirNumero(total),
    ganancia: convertirNumero(ganancia),
  };
}

export async function leerPdfIsatech(file: File): Promise<IsatechParseResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lineas: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items = content.items as any[];

    const agrupado: Record<string, { x: number; text: string }[]> = {};

    for (const item of items) {
      const y = Math.round(item.transform[5]).toString();
      const x = item.transform[4];

      if (!agrupado[y]) agrupado[y] = [];
      agrupado[y].push({ x, text: item.str });
    }

    Object.keys(agrupado)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => {
        const linea = agrupado[y]
          .sort((a, b) => a.x - b.x)
          .map((item) => item.text)
          .join(" ");

        const limpia = limpiarLinea(linea);
        if (limpia) lineas.push(limpia);
      });
  }

  const texto = lineas.join("\n");

  const periodoMatch = texto.match(
    /Período:\s*(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))\s*al\s*(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))/
  );

  const periodoInicio = periodoMatch ? convertirFecha(periodoMatch[1]) : null;
  const periodoFin = periodoMatch ? convertirFecha(periodoMatch[2]) : null;

  let categoriaActual: string | null = null;
  const productos: ProductoIsatech[] = [];

  for (const linea of lineas) {
    const limpia = limpiarLinea(linea);

    if (!limpia) continue;
    if (limpia.includes("Código")) continue;
    if (limpia.includes("Producto")) continue;
    if (limpia.includes("Cantidad")) continue;
    if (limpia.includes("Ganancia")) continue;
    if (limpia.startsWith("Ventas por Producto")) continue;
    if (limpia.startsWith("Período:")) continue;
    if (limpia.startsWith("Ventas Total")) continue;
    if (limpia.startsWith("Ganancia Total")) continue;

    if (esCategoria(limpia)) {
      categoriaActual = limpia.toUpperCase();
      continue;
    }

    const producto = parsearProducto(
      limpia,
      categoriaActual,
      periodoInicio,
      periodoFin
    );

    if (producto) productos.push(producto);
  }

  console.log("ISATECH PERIODO", periodoInicio, periodoFin);
  console.log("ISATECH PRODUCTOS", productos);

  return {
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    productos,
  };
}