import { leerCsv } from "./csvService";

export type SaborPedidosYaResumen = {
  sabor: string;
  sabor_normalizado: string;
  cantidad: number;
  participacion: number;
  ranking: number;
};

export type PedidosYaSaboresParseResult = {
  sabores: SaborPedidosYaResumen[];
  pedidos_procesados: number;
  pedidos_descartados: number;
  selecciones_totales: number;
};

type PeriodoSabores = {
  anio: number;
  mes: number;
};

function normalizarTexto(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nombreVisible(texto: string) {
  return String(texto || "")
    .replace(/\s+/g, " ")
    .trim();
}

function fechaDesdeTexto(valor: string): Date | null {
  const limpio = String(valor || "").trim();

  // Formato del CSV: 2026-03-31 21:08
  let match = limpio.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2})?/
  );

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  // Alternativa: 31/03/2026
  match = limpio.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})/
  );

  if (match) {
    const anio =
      match[3].length === 2
        ? Number(`20${match[3]}`)
        : Number(match[3]);

    return new Date(anio, Number(match[2]) - 1, Number(match[1]));
  }

  return null;
}

function perteneceAlPeriodo(fecha: Date, periodo: PeriodoSabores) {
  return (
    fecha.getFullYear() === Number(periodo.anio) &&
    fecha.getMonth() + 1 === Number(periodo.mes)
  );
}

function esPedidoEntregado(estado: string) {
  return normalizarTexto(estado) === "entregado";
}

function extraerSaboresDeArticulos(articulos: string) {
  const resultado: Array<{
    sabor: string;
    sabor_normalizado: string;
    cantidad: number;
  }> = [];

  /*
    Ejemplo:

    1 1/2 litro helado tradicional
    [1 Crema Americana, 1 Dulce de leche Tentación]

    También soporta varios productos en la misma celda:
    producto [sabores], producto [sabores]
  */
  const grupos = String(articulos || "").matchAll(/\[([^\]]+)\]/g);

  for (const grupo of grupos) {
    const contenido = grupo[1];

    const selecciones = contenido
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    for (const seleccion of selecciones) {
      /*
        Ejemplos:
        1 Crema Americana
        2 Chocolate Suizo
      */
      const match = seleccion.match(
        /^(\d+(?:[.,]\d+)?)\s+(.+)$/
      );

      if (!match) continue;

      const cantidad = Number(match[1].replace(",", "."));
      const sabor = nombreVisible(match[2]);
      const saborNormalizado = normalizarTexto(sabor);
      const saborAgrupado =
  saborNormalizado === "limon natural"
    ? "limon"
    : saborNormalizado;

      if (!saborNormalizado || cantidad <= 0) continue;

      resultado.push({
        sabor,
        sabor_normalizado: saborAgrupado,
        cantidad,
      });
    }
  }

  return resultado;
}

export async function leerCsvSaboresPedidosYa(
  file: File,
  periodo: PeriodoSabores
): Promise<PedidosYaSaboresParseResult> {
  const preview = await leerCsv(file);

  const columnasObligatorias = [
    "Fecha del pedido",
    "Estado del pedido",
    "Artículos",
  ];

  const columnasFaltantes = columnasObligatorias.filter(
    (columna) => !preview.columnas.includes(columna)
  );

  if (columnasFaltantes.length > 0) {
    throw new Error(
      `El CSV de detalle de PedidosYa no contiene estas columnas: ${columnasFaltantes.join(
        ", "
      )}.`
    );
  }

  const acumulado = new Map<
    string,
    {
      sabor: string;
      sabor_normalizado: string;
      cantidad: number;
    }
  >();

  let pedidosProcesados = 0;
  let pedidosDescartados = 0;

  for (const fila of preview.filas) {
    const fecha = fechaDesdeTexto(fila["Fecha del pedido"]);
    const estado = fila["Estado del pedido"];
    const articulos = fila["Artículos"];

    if (
      !fecha ||
      !perteneceAlPeriodo(fecha, periodo) ||
      !esPedidoEntregado(estado)
    ) {
      pedidosDescartados += 1;
      continue;
    }

    const saboresPedido = extraerSaboresDeArticulos(articulos);

    if (saboresPedido.length === 0) {
      pedidosDescartados += 1;
      continue;
    }

    pedidosProcesados += 1;

    for (const sabor of saboresPedido) {
      const existente = acumulado.get(sabor.sabor_normalizado);

      if (existente) {
        existente.cantidad += sabor.cantidad;
      } else {
        acumulado.set(sabor.sabor_normalizado, {
          ...sabor,
        });
      }
    }
  }

  const seleccionesTotales = Array.from(acumulado.values()).reduce(
    (total, sabor) => total + sabor.cantidad,
    0
  );

  const sabores = Array.from(acumulado.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .map((sabor, index) => ({
      sabor: sabor.sabor,
      sabor_normalizado: sabor.sabor_normalizado,
      cantidad: sabor.cantidad,
      participacion:
        seleccionesTotales > 0
          ? (sabor.cantidad / seleccionesTotales) * 100
          : 0,
      ranking: index + 1,
    }));

  if (pedidosProcesados === 0) {
    throw new Error(
      `No se encontraron pedidos entregados con sabores para ${String(
        periodo.mes
      ).padStart(2, "0")}/${periodo.anio}.`
    );
  }

  return {
    sabores,
    pedidos_procesados: pedidosProcesados,
    pedidos_descartados: pedidosDescartados,
    selecciones_totales: seleccionesTotales,
  };
}