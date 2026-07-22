export type PedidoYaDetallePedido = {
  numero_pedido: string;
  fecha: string | null;
  estado_pedido: string;
  total_parcial: number;

  descuento_local: number;
  descuento_pedidosya: number;

  comision: number;
  iva_comision: number;
  tarifa_pago_linea: number;

  cargos: number;
  impuestos: number;
  cargo_impositivo: number;
  retencion_recuperable: number;

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
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  let texto = String(valor ?? "").trim();

  if (!texto) return 0;

  texto = texto
    .replace(/\s/g, "")
    .replace(/\$/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    texto = texto
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const resultado = Number(texto);

  return Number.isFinite(resultado) ? resultado : 0;
}

function redondearImporte(valor: number) {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function fechaIso(valor: string): string | null {
  const texto = valor.trim();

  if (!texto) return null;

  const directa = new Date(texto);

  if (!Number.isNaN(directa.getTime())) {
    return directa.toISOString();
  }

  const match = texto.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return null;

  const [
    ,
    dia,
    mes,
    anio,
    hora = "0",
    minuto = "0",
    segundo = "0",
  ] = match;

  const fecha = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo)
  );

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha.toISOString();
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
    const matchInicio = linea.match(
      /^(\d+(?:[.,]\d+)?)\s*[xX×]\s*(.+)$/
    );

    const matchFinal = linea.match(
      /^(.+?)\s*[xX×]\s*(\d+(?:[.,]\d+)?)$/
    );

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

export function esPedidoContabilizable(
  pedido: Pick<PedidoYaDetallePedido, "estado_pedido">
) {
  const estado = normalizarClave(pedido.estado_pedido);

  /*
   * Se admite el estado vacío para mantener compatibilidad
   * con importaciones antiguas que no guardaban esta columna.
   */
  if (!estado) return true;

  return [
    "entregado",
    "realizado",
    "completado",
    "completed",
    "delivered",
  ].includes(estado);
}

export function parsearFilasOrderDetailsPedidosYa(
  filas: Record<string, string>[]
): PedidoYaDetallePedido[] {
  const pedidos = filas
    .map((fila, index) => {
      const numeroPedido =
        valorFila(fila, [
          "Nro de pedido",
          "Nro pedido",
          "Pedido",
          "Número de pedido",
          "Numero de pedido",
          "ID pedido",
          "Order ID",
        ]) || `fila-${index + 1}`;

      const estadoPedido = valorFila(fila, [
        "Estado del pedido",
        "Estado",
        "Order status",
        "Status",
      ]);

      const articulos = valorFila(fila, [
        "Artículos",
        "Articulos",
        "Productos",
        "Items",
      ]);

      const comision = numero(
        valorFila(fila, [
          "Comisión",
          "Comision",
          "Commission",
        ])
      );

      const cargoImpositivo = numero(
        valorFila(fila, [
          "Cargo impositivo",
          "Impuestos",
          "Taxes",
        ])
      );

      const descuentoFinanciadoLocal = numero(
        valorFila(fila, [
          "Descuento financiado por usted",
          "Descuento otorgado por el local",
          "Descuento financiado por el local",
        ])
      );

      const valeFinanciadoLocal = numero(
        valorFila(fila, [
          "Vale financiado por usted",
          "Voucher financiado por usted",
          "Vale financiado por el local",
        ])
      );

      const descuentoFinanciadoPedidosYa = numero(
        valorFila(fila, [
          "Descuento financiado por PedidosYa",
          "Descuento financiado por Pedidos Ya",
        ])
      );

      const valeFinanciadoPedidosYa = numero(
        valorFila(fila, [
          "Voucher financiado por PedidosYa",
          "Vale financiado por PedidosYa",
          "Voucher financiado por Pedidos Ya",
        ])
      );

      const descuentoLocal = redondearImporte(
        descuentoFinanciadoLocal + valeFinanciadoLocal
      );

      const descuentoPedidosYa = redondearImporte(
        descuentoFinanciadoPedidosYa +
          valeFinanciadoPedidosYa
      );

      const ivaComision = redondearImporte(
        comision * 0.22
      );

      const retencionRecuperable = redondearImporte(
        Math.max(cargoImpositivo - ivaComision, 0)
      );

      return {
        numero_pedido: numeroPedido,

        fecha: fechaIso(
          valorFila(fila, [
            "Fecha",
            "Fecha del pedido",
            "Date",
          ])
        ),

        estado_pedido: estadoPedido,

        total_parcial: numero(
          valorFila(fila, [
            "Total parcial",
            "Subtotal",
            "Venta",
            "Total productos",
          ])
        ),

        descuento_local: descuentoLocal,
        descuento_pedidosya: descuentoPedidosYa,

        comision,
        iva_comision: ivaComision,

        tarifa_pago_linea: numero(
          valorFila(fila, [
            "Tarifa de pago en línea",
            "Tarifa de pago en linea",
            "Servicio pago en línea",
            "Servicio pago en linea",
            "Online payment fee",
          ])
        ),

        cargos: numero(
          valorFila(fila, [
            "Cargos",
            "Otros cargos",
            "Fees",
          ])
        ),

        /*
         * Se mantiene "impuestos" por compatibilidad con
         * el código anterior. Contiene el cargo impositivo
         * completo informado por PedidosYa.
         */
        impuestos: cargoImpositivo,
        cargo_impositivo: cargoImpositivo,
        retencion_recuperable: retencionRecuperable,

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
    throw new Error(
      "No se detectaron pedidos en el CSV orderDetails."
    );
  }

  return pedidos;
}