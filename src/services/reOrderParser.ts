export type ProductoReOrder = {
  nombre_producto: string;
  cantidad: number;
  ventas: number;
  numero_pedidos: number;
};

function texto(fila: Record<string, string>, clave: string) {
  return String(fila[clave] ?? "").trim();
}

function entero(valor: string) {
  const limpio = String(valor || "")
    .replace(/\s+/g, "")
    .replace(/[^\d-]/g, "");

  return Number(limpio || 0);
}

/*
 * Re Order exporta ventas_totales con coma como separador de miles:
 * "3,680" = 3680.
 *
 * Si en algún momento exportara decimales con punto, también se conservan.
 */
function importeReOrder(valor: string) {
  const limpio = String(valor || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\$/g, "")
    .replace(/,/g, "");

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : 0;
}

export function parsearFilasReOrder(
  filas: Record<string, string>[]
): ProductoReOrder[] {
  if (!filas.length) return [];

  const requeridas = [
    "producto",
    "numero_de_pedidos",
    "items_vendidos",
    "ventas_totales",
  ];

  const columnas = new Set(
    Object.keys(filas[0] || {}).map((clave) =>
      clave.trim().toLowerCase()
    )
  );

  const faltantes = requeridas.filter(
    (columna) => !columnas.has(columna)
  );

  if (faltantes.length) {
    throw new Error(
      `CSV de Re Order inválido. Faltan columnas: ${faltantes.join(", ")}.`
    );
  }

  const agrupados = new Map<string, ProductoReOrder>();

  for (const filaOriginal of filas) {
    const fila: Record<string, string> = {};

    for (const [clave, valor] of Object.entries(filaOriginal)) {
      fila[clave.trim().toLowerCase()] = String(valor ?? "");
    }

    const nombre = texto(fila, "producto");
    const cantidad = entero(texto(fila, "items_vendidos"));
    const ventas = importeReOrder(texto(fila, "ventas_totales"));
    const numeroPedidos = entero(texto(fila, "numero_de_pedidos"));

    if (!nombre || (cantidad <= 0 && ventas <= 0)) {
      continue;
    }

    const clave = nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const existente = agrupados.get(clave);

    if (existente) {
      existente.cantidad += cantidad;
      existente.ventas += ventas;
      existente.numero_pedidos += numeroPedidos;
    } else {
      agrupados.set(clave, {
        nombre_producto: nombre,
        cantidad,
        ventas,
        numero_pedidos: numeroPedidos,
      });
    }
  }

  return Array.from(agrupados.values());
}
