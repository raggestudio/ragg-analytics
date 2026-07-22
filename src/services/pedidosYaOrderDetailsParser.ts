export type PedidoYaDetallePedido = {
  numero_pedido: string;
  fecha: string | null;
  total_parcial: number;
  comision: number;
  cargos: number;
  impuestos: number;
  ingreso_estimado: number;
  articulos_raw: string;
  productos: Array<{
    nombre_producto: string;
    cantidad: number;
    detalle: string | null;
  }>;
};

function normalizarClave(valor: unknown) {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function valorFila(
  fila: Record<string, string>,
  variantes: string[]
): string {
  const buscadas = variantes.map(normalizarClave);

  for (const [clave, valor] of Object.entries(fila)) {
    if (buscadas.includes(normalizarClave(clave))) {
      return String(valor ?? "").trim();
    }
  }

  return "";
}

function numero(valor: unknown) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  let texto = String(valor ?? "").trim();
  if (!texto) return 0;

  texto = texto.replace(/\s/g, "").replace(/\$/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const resultado = Number(texto);
  return Number.isFinite(resultado) ? resultado : 0;
}

function fechaIso(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;

  const directa = new Date(texto);
  if (!Number.isNaN(directa.getTime())) return directa.toISOString();

  const match = texto.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return null;

  const [, dia, mes, anio, hora = "0", minuto = "0", segundo = "0"] = match;
  const fecha = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo)
  );

  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

function parsearArticulos(texto: string) {
  const lineas = String(texto || "")
    .split(/\r?\n|\s*\|\s*|\s*;\s*/)
    .map((linea) => linea.trim())
    .filter(Boolean);

  const productos: Array<{
    nombre_producto: string;
    cantidad: number;
    detalle: string | null;
  }> = [];

  for (const linea of lineas) {
    const matchInicio = linea.match(/^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(.+)$/);
    const matchFinal = linea.match(/^(.+?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)$/);

    if (matchInicio) {
      productos.push({
        cantidad: numero(matchInicio[1]) || 1,
        nombre_producto: matchInicio[2].trim(),
        detalle: linea,
      });
      continue;
    }

    if (matchFinal) {
      productos.push({
        cantidad: numero(matchFinal[2]) || 1,
        nombre_producto: matchFinal[1].trim(),
        detalle: linea,
      });
      continue;
    }

    productos.push({
      cantidad: 1,
      nombre_producto: linea,
      detalle: linea,
    });
  }

  return productos;
}

export function parsearFilasOrderDetailsPedidosYa(
  filas: Record<string, string>[]
): PedidoYaDetallePedido[] {
  const pedidos = filas
    .map((fila, index) => {
      const numeroPedido =
        valorFila(fila, [
          "Pedido",
          "Número de pedido",
          "Numero de pedido",
          "ID pedido",
          "Order ID",
        ]) || `fila-${index + 1}`;

      const articulos = valorFila(fila, [
        "Artículos",
        "Articulos",
        "Productos",
        "Items",
      ]);

      return {
        numero_pedido: numeroPedido,
        fecha: fechaIso(
          valorFila(fila, ["Fecha", "Fecha del pedido", "Date"])
        ),
        total_parcial: numero(
          valorFila(fila, [
            "Total parcial",
            "Subtotal",
            "Venta",
            "Total productos",
          ])
        ),
        comision: numero(
          valorFila(fila, ["Comisión", "Comision", "Commission"])
        ),
        cargos: numero(
          valorFila(fila, ["Cargos", "Otros cargos", "Fees"])
        ),
        impuestos: numero(
          valorFila(fila, ["Impuestos", "Taxes"])
        ),
        ingreso_estimado: numero(
          valorFila(fila, [
            "Ingreso estimado",
            "Ingresos estimados",
            "Estimated income",
          ])
        ),
        articulos_raw: articulos,
        productos: parsearArticulos(articulos),
      };
    })
    .filter((pedido) => pedido.numero_pedido);

  if (pedidos.length === 0) {
    throw new Error("No se detectaron pedidos en el CSV orderDetails.");
  }

  return pedidos;
}
