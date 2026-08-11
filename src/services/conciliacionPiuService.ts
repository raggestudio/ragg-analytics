import { supabase } from "../lib/supabase";

export type DetalleConciliacionPiu = {
  producto: string;
  unidades_pedidosya: number;
  unidades_isatech: number;
  diferencia: number;
};

export type ConciliacionPiu = {
  estado: "pendiente" | "coincide" | "diferencia_menor" | "revisar";
  venta_efectiva_pedidosya: number;
  venta_isatech_pedidosya: number;
  diferencia_ventas: number;
  unidades_pedidosya: number;
  unidades_isatech: number;
  diferencia_unidades: number;
  pedidos_contabilizados: number;
  pedidos_cancelados: number;
  detalle: DetalleConciliacionPiu[];
  actualizado_at: string | null;
};

type Input = {
  empresa_id: string;
  sucursal_id: string;
  periodo_id: string;
};

function numero(valor: unknown) {
  const resultado = Number(valor || 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function redondear(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function normalizar(valor: unknown) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function esPedidoContabilizable(estadoRaw: unknown) {
  const estado = normalizar(estadoRaw);
  if (!estado) return true;
  return [
    "entregado",
    "realizado",
    "completado",
    "completed",
    "delivered",
  ].includes(estado);
}

function nombreGrupo(nombreRaw: unknown) {
  const nombre = normalizar(nombreRaw);

  if (/promo.*(?:1 4|cuarto).*(?:alfajor|2)/.test(nombre)) {
    return "Promo 1/4 + 2 alfajores";
  }
  if (/cucurucho.*(?:relleno|dulce de leche|ddl)/.test(nombre)) {
    return "Cucurucho relleno";
  }
  if (/(?:cubanito|barquillo).*(?:relleno|dulce de leche|ddl)/.test(nombre)) {
    return "Barquillo/Cubanito relleno";
  }
  if (/alfajor/.test(nombre)) return "Alfajores";
  if (/capelina/.test(nombre)) return "Capelina";
  if (/cucurucho/.test(nombre)) return "Cucurucho";
  if (/(?:1 4|cuarto litro)/.test(nombre)) return "Helado 1/4 L";
  if (/(?:1 2|medio kilo)/.test(nombre)) return "Helado 1/2 L";
  if (/(?:1 kg|1kg|1 kilo|1 l|litro)/.test(nombre)) return "Helado 1 L";

  return nombre || "Producto sin nombre";
}

function esProductoPedidosYaIsatech(fila: Record<string, unknown>) {
  const codigo = normalizar(fila.codigo_producto);
  const categoria = normalizar(fila.categoria);
  return categoria.includes("pedidos ya") || /^py/.test(codigo) || /^propy/.test(codigo);
}

function sumarPorGrupo(
  filas: Array<Record<string, unknown>>,
  campoNombre: string,
  campoCantidad: string
) {
  const mapa = new Map<string, number>();
  for (const fila of filas) {
    const grupo = nombreGrupo(fila[campoNombre]);
    mapa.set(grupo, (mapa.get(grupo) || 0) + numero(fila[campoCantidad]));
  }
  return mapa;
}

export async function calcularYGuardarConciliacionPiu(
  input: Input
): Promise<ConciliacionPiu> {
  const [pedidosResult, productosResult, isatechResult] = await Promise.all([
    supabase
      .from("pedidosya_pedidos")
      .select("id, estado_pedido, total_parcial, descuento_local")
      .eq("empresa_id", input.empresa_id)
      .eq("sucursal_id", input.sucursal_id)
      .eq("periodo_id", input.periodo_id),
    supabase
      .from("pedidosya_pedido_productos")
      .select("nombre_producto, cantidad")
      .eq("empresa_id", input.empresa_id)
      .eq("sucursal_id", input.sucursal_id)
      .eq("periodo_id", input.periodo_id),
    supabase
      .from("producto_ventas_resumen")
      .select("codigo_producto, nombre_producto, categoria, cantidad, total")
      .eq("empresa_id", input.empresa_id)
      .eq("sucursal_id", input.sucursal_id)
      .eq("periodo_id", input.periodo_id)
      .eq("fuente", "Isatech"),
  ]);

  if (pedidosResult.error) throw pedidosResult.error;
  if (productosResult.error) throw productosResult.error;
  if (isatechResult.error) throw isatechResult.error;

  const pedidos = (pedidosResult.data || []) as Array<Record<string, unknown>>;
  const productos = (productosResult.data || []) as Array<Record<string, unknown>>;
  const isatech = ((isatechResult.data || []) as Array<Record<string, unknown>>)
    .filter(esProductoPedidosYaIsatech);

  if (pedidos.length === 0 || isatech.length === 0) {
    return {
      estado: "pendiente",
      venta_efectiva_pedidosya: 0,
      venta_isatech_pedidosya: 0,
      diferencia_ventas: 0,
      unidades_pedidosya: 0,
      unidades_isatech: 0,
      diferencia_unidades: 0,
      pedidos_contabilizados: 0,
      pedidos_cancelados: 0,
      detalle: [],
      actualizado_at: null,
    };
  }

  const contabilizables = pedidos.filter((pedido) =>
    esPedidoContabilizable(pedido.estado_pedido)
  );
  const ventaEfectiva = redondear(
    contabilizables.reduce(
      (total, pedido) =>
        total + numero(pedido.total_parcial) - numero(pedido.descuento_local),
      0
    )
  );
  const ventaIsatech = redondear(
    isatech.reduce((total, fila) => total + numero(fila.total), 0)
  );

  const gruposPya = sumarPorGrupo(productos, "nombre_producto", "cantidad");
  const gruposIsatech = sumarPorGrupo(isatech, "nombre_producto", "cantidad");
  const grupos = new Set([...gruposPya.keys(), ...gruposIsatech.keys()]);
  const detalle = [...grupos]
    .map((producto) => {
      const pya = gruposPya.get(producto) || 0;
      const isa = gruposIsatech.get(producto) || 0;
      return {
        producto,
        unidades_pedidosya: pya,
        unidades_isatech: isa,
        diferencia: pya - isa,
      };
    })
    .filter((fila) => Math.abs(fila.diferencia) > 0.0001)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));

  const unidadesPya = redondear(
    productos.reduce((total, fila) => total + numero(fila.cantidad), 0)
  );
  const unidadesIsatech = redondear(
    isatech.reduce((total, fila) => total + numero(fila.cantidad), 0)
  );
  const diferenciaVentas = redondear(ventaEfectiva - ventaIsatech);
  const diferenciaUnidades = redondear(unidadesPya - unidadesIsatech);
  const porcentajeVentas = ventaEfectiva > 0
    ? Math.abs(diferenciaVentas) / ventaEfectiva
    : 0;
  const porcentajeUnidades = unidadesPya > 0
    ? Math.abs(diferenciaUnidades) / unidadesPya
    : 0;

  const estado: ConciliacionPiu["estado"] =
    Math.abs(diferenciaVentas) <= 1 && Math.abs(diferenciaUnidades) < 0.001
      ? "coincide"
      : porcentajeVentas <= 0.01 && porcentajeUnidades <= 0.02
        ? "diferencia_menor"
        : "revisar";

  const actualizadoAt = new Date().toISOString();
  const conciliacion: ConciliacionPiu = {
    estado,
    venta_efectiva_pedidosya: ventaEfectiva,
    venta_isatech_pedidosya: ventaIsatech,
    diferencia_ventas: diferenciaVentas,
    unidades_pedidosya: unidadesPya,
    unidades_isatech: unidadesIsatech,
    diferencia_unidades: diferenciaUnidades,
    pedidos_contabilizados: contabilizables.length,
    pedidos_cancelados: pedidos.length - contabilizables.length,
    detalle,
    actualizado_at: actualizadoAt,
  };

  const { error: guardarError } = await supabase
    .from("conciliaciones_piu")
    .upsert(
      {
        empresa_id: input.empresa_id,
        sucursal_id: input.sucursal_id,
        periodo_id: input.periodo_id,
        ...conciliacion,
      },
      { onConflict: "empresa_id,sucursal_id,periodo_id" }
    );

  // La conciliación es un control informativo: si todavía no se ejecutó el
  // SQL de instalación, la importación y el análisis deben seguir funcionando.
  if (guardarError && guardarError.code !== "42P01") {
    console.warn("No se pudo guardar la conciliación PIU:", guardarError.message);
  }

  return conciliacion;
}
