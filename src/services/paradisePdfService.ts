import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ProductoParadise = {
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

export type ParadiseParseResult = {
  periodo_inicio: string | null;
  periodo_fin: string | null;
  productos: ProductoParadise[];
  total_registros: number | null;
  total_unidades: number | null;
  total_ventas: number | null;
};

function limpiarLinea(linea: string) {
  return linea.replace(/\s+/g, " ").trim();
}

function convertirFecha(fecha: string) {
  const [dia, mes, anioRaw] = fecha.split("/");
  const anio = anioRaw.length === 2 ? `20${anioRaw}` : anioRaw;

  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function convertirNumero(valor: string) {
  const limpio = String(valor || "").trim();

  if (!limpio) return 0;

  // Paradise usa, por ejemplo: 12,891.50
  return Number(limpio.replace(/,/g, ""));
}

function parsearProducto(
  linea: string,
  periodoInicio: string | null,
  periodoFin: string | null
): ProductoParadise | null {
  const limpia = limpiarLinea(linea);

  /*
    Estructura esperada:

    posición código descripción volumen %vol valor %valor valorPromedio fecha

    Ejemplo:
    24 13 PAPAS 4 QUESOS 29.000 1.41 11,251.50 1.66 387.98 16/07/2026
  */
  const match = limpia.match(
    /^(\d+)\s+(\d+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+\d{2}\/\d{2}\/\d{4}$/
  );

  if (!match) return null;

  const codigo = match[2];
  const nombre = limpiarLinea(match[3]);
  const cantidad = convertirNumero(match[4]);
  const total = convertirNumero(match[6]);

  if (!codigo || !nombre) return null;
  if (!Number.isFinite(cantidad) || !Number.isFinite(total)) return null;

  return {
    fuente: "Paradise",
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    categoria: null,
    codigo_producto: codigo,
    nombre_producto: nombre,
    cantidad,
    total,

    // Este PDF no contiene costo ni ganancia.
    // Se calculará luego mediante las vinculaciones de costos.
    ganancia: 0,
  };
}

export async function leerPdfParadise(
  file: File
): Promise<ParadiseParseResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

const lineas: string[] = [];

for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const elementos = (content.items as any[])
    .map((item) => {
      /*
        Aplicamos la transformación del viewport porque el informe
        de Paradise está generado en formato horizontal/rotado.
      */
      const posicion = pdfjsLib.Util.transform(
        viewport.transform,
        item.transform
      );

      return {
        x: posicion[4],
        y: posicion[5],
        texto: String(item.str || "").trim(),
      };
    })
    .filter((item) => item.texto);

  /*
    Agrupamos elementos que están aproximadamente sobre la misma línea.
    No usamos el valor Y exacto porque puede variar algunos decimales.
  */
  const filas: Array<{
    y: number;
    elementos: Array<{
      x: number;
      texto: string;
    }>;
  }> = [];

  for (const elemento of elementos) {
    let fila = filas.find(
      (item) => Math.abs(item.y - elemento.y) <= 3
    );

    if (!fila) {
      fila = {
        y: elemento.y,
        elementos: [],
      };

      filas.push(fila);
    }

    fila.elementos.push({
      x: elemento.x,
      texto: elemento.texto,
    });
  }

  filas
    .sort((a, b) => a.y - b.y)
    .forEach((fila) => {
      const linea = fila.elementos
        .sort((a, b) => a.x - b.x)
        .map((item) => item.texto)
        .join(" ");

      const limpia = limpiarLinea(linea);

      if (limpia) {
        lineas.push(limpia);
      }
    });
}
  const texto = lineas.join("\n");

  const periodoMatch = texto.match(
  /DESDE\s+FE[A-Z]*:\s*(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))\s+HASTA\s+FE[A-Z]*:\s*(\d{2}\/\d{2}\/(?:\d{2}|\d{4}))/i
);

  const periodoInicio = periodoMatch
    ? convertirFecha(periodoMatch[1])
    : null;

  const periodoFin = periodoMatch
    ? convertirFecha(periodoMatch[2])
    : null;

  const productos: ProductoParadise[] = [];

  for (const linea of lineas) {
    const producto = parsearProducto(
      linea,
      periodoInicio,
      periodoFin
    );

    if (producto) productos.push(producto);
  }

  const totalesMatch = texto.match(
    /Total\s+De\s+Registros:\s*(\d+).*?TOTALES:\s*([\d.,]+)\s+([\d.,]+)/is
  );

  const totalRegistros = totalesMatch
    ? Number(totalesMatch[1])
    : null;

  const totalUnidades = totalesMatch
    ? convertirNumero(totalesMatch[2])
    : null;

  const totalVentas = totalesMatch
    ? convertirNumero(totalesMatch[3])
    : null;

  console.log("PARADISE LÍNEAS", lineas);  
  console.log("PARADISE PERÍODO", periodoInicio, periodoFin);
  console.log("PARADISE PRODUCTOS", productos);
  console.log("PARADISE TOTALES", {
    totalRegistros,
    totalUnidades,
    totalVentas,
  });

  return {
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    productos,
    total_registros: totalRegistros,
    total_unidades: totalUnidades,
    total_ventas: totalVentas,
  };
}