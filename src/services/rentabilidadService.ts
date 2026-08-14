import { supabase } from "../lib/supabase";

type CalcularRentabilidadInput = {
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
};

type CostoManual = {
  id: string;
  codigo_producto: string | null;
  nombre_producto: string;
  costo: number;
  origen: string;
  estimado: boolean;
};

type ContextoCostos = {
  costosManuales: CostoManual[];
  costosManualesPorId: Map<string, CostoManual>;
  vinculacionesParadise: Map<string, string>;
  vinculacionesPedidosYa: Map<string, string>;
  reglasPorProducto: Map<string, any>;
  recetasPorId: Map<string, any>;
  costoPromedioKg: number;
};

type Contadores = {
  productosSinCosto: number;
  ventasSinCosto: number;
  nombresSinCosto: string[];
};

function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*$/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(ml|cc|gr|g|kg|lt|lts|l)\b/g, " ")
    .replace(/\b(1\/2|1\/4|1\/8)\b/g, " ")
    .replace(/\bbeer\s+bros\b/g, "beerbros")
    .replace(/\bgin\s+tonic\b/g, "gintonic")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palabras(texto: string) {
  return normalizar(texto)
    .split(" ")
    .filter((palabra) => palabra.length > 1);
}

function buscarCostoManual(
  producto: any,
  costos: CostoManual[]
): CostoManual | null {
  const codigo = String(
    producto.codigo_producto || producto.codigo || ""
  ).trim();

  if (codigo) {
    const porCodigo = costos.find(
      (costo) =>
        costo.codigo_producto &&
        String(costo.codigo_producto).trim() === codigo
    );

    if (porCodigo) return porCodigo;
  }

  const nombre = normalizar(producto.nombre_producto);
  if (!nombre) return null;

  const exacto = costos.find(
    (costo) => normalizar(costo.nombre_producto) === nombre
  );

  if (exacto) return exacto;

  const palabrasProducto = palabras(producto.nombre_producto);
  let mejor: CostoManual | null = null;
  let mejorPuntaje = 0;

  for (const costo of costos) {
    const palabrasCosto = palabras(costo.nombre_producto);
    if (!palabrasProducto.length || !palabrasCosto.length) continue;

    const coincidencias = palabrasProducto.filter((palabra) =>
      palabrasCosto.includes(palabra)
    ).length;

    const puntaje =
      coincidencias /
      Math.max(palabrasProducto.length, palabrasCosto.length);

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = costo;
    }
  }

  return mejorPuntaje >= 0.8 ? mejor : null;
}

async function cargarVinculaciones(
  empresaId: string,
  sistema: "paradise" | "pedidosya"
) {
  const { data, error } = await supabase
    .from("producto_vinculacion")
    .select("codigo_sistema, costo_manual_id")
    .eq("empresa_id", empresaId)
    .eq("sistema", sistema)
    .eq("activo", true);

  if (error) throw error;

  const mapa = new Map<string, string>();

  for (const vinculacion of data || []) {
    if (vinculacion.codigo_sistema && vinculacion.costo_manual_id) {
      mapa.set(
        String(vinculacion.codigo_sistema),
        String(vinculacion.costo_manual_id)
      );
    }
  }

  return mapa;
}

async function cargarContextoCostos(
  input: CalcularRentabilidadInput
): Promise<ContextoCostos> {
  const [
    reglasResultado,
    recetasResultado,
    costosResultado,
    elaboracionesResultado,
    vinculacionesParadise,
    vinculacionesPedidosYa,
  ] = await Promise.all([
    supabase
      .from("producto_costo")
      .select("*")
      .eq("empresa_id", input.empresa_id)
      .eq("activo", true),
    supabase
      .from("recetas")
      .select("*")
      .eq("empresa_id", input.empresa_id),
    supabase
      .from("producto_costo_manual")
      .select("*")
      .eq("empresa_id", input.empresa_id)
      .eq("activo", true),
    supabase
      .from("elaboraciones")
      .select("*")
      .eq("empresa_id", input.empresa_id)
      .eq("periodo_id", input.periodo_id),
    cargarVinculaciones(input.empresa_id, "paradise"),
    cargarVinculaciones(input.empresa_id, "pedidosya"),
  ]);

  if (reglasResultado.error) throw reglasResultado.error;
  if (recetasResultado.error) throw recetasResultado.error;
  if (costosResultado.error) throw costosResultado.error;
  if (elaboracionesResultado.error) throw elaboracionesResultado.error;

  const recetas = recetasResultado.data || [];
  const recetasPorId = new Map<string, any>();
  const recetasPorNombre = new Map<string, any>();

  for (const receta of recetas) {
    recetasPorId.set(receta.id, receta);
    recetasPorNombre.set(normalizar(receta.nombre), receta);
  }

  let kilosTotales = 0;
  let costoTotalProduccion = 0;

  for (const elaboracion of elaboracionesResultado.data || []) {
    const kilos = Number(elaboracion.kilos || 0);
    if (kilos <= 0) continue;

    let receta = elaboracion.receta_id
      ? recetasPorId.get(elaboracion.receta_id)
      : null;

    if (!receta && elaboracion.producto) {
      receta = recetasPorNombre.get(normalizar(elaboracion.producto));
    }

    if (!receta && elaboracion.producto_original) {
      receta = recetasPorNombre.get(
        normalizar(elaboracion.producto_original)
      );
    }

    const costoKg = Number(receta?.costo_kg || 0);
    if (costoKg <= 0) continue;

    kilosTotales += kilos;
    costoTotalProduccion += kilos * costoKg;
  }

  const costosManuales: CostoManual[] = (
    costosResultado.data || []
  ).map((costo: any) => ({
    id: costo.id,
    codigo_producto: costo.codigo_producto || null,
    nombre_producto: costo.nombre_producto,
    costo: Number(costo.costo || 0),
    origen: costo.origen || "costo_manual",
    estimado: Boolean(costo.estimado),
  }));

  const costosManualesPorId = new Map<string, CostoManual>();
  for (const costo of costosManuales) {
    costosManualesPorId.set(costo.id, costo);
  }

  const reglasPorProducto = new Map<string, any>();
  for (const regla of reglasResultado.data || []) {
    reglasPorProducto.set(normalizar(regla.nombre_producto), regla);
  }

  return {
    costosManuales,
    costosManualesPorId,
    vinculacionesParadise,
    vinculacionesPedidosYa,
    reglasPorProducto,
    recetasPorId,
    costoPromedioKg:
      kilosTotales > 0 ? costoTotalProduccion / kilosTotales : 0,
  };
}

function calcularCostoProducto(input: {
  producto: any;
  contexto: ContextoCostos;
  vinculaciones: Map<string, string>;
}) {
  const { producto, contexto, vinculaciones } = input;
  const regla = contexto.reglasPorProducto.get(
    normalizar(producto.nombre_producto)
  );

  const codigo = String(producto.codigo_producto || "").trim();
  const claveVinculacion =
    codigo || `nombre:${normalizar(producto.nombre_producto)}`;
  const costoVinculadoId = vinculaciones.get(claveVinculacion) || null;
  const costoVinculado = costoVinculadoId
    ? contexto.costosManualesPorId.get(costoVinculadoId) || null
    : null;

  const costoManual =
    costoVinculado ||
    buscarCostoManual(producto, contexto.costosManuales);

  const cantidad = Number(producto.cantidad || 0);
  const ventas = Number(producto.total ?? producto.ventas ?? 0);
  const gananciaSistema = Number(producto.ganancia || 0);

  let tipoCalculo = regla?.tipo_calculo || "";
  let costoUnitario = 0;
  let costoTotal = 0;
  let origenCosto = "";
  let detalleCosto = "";
  let tieneCosto = false;

  if (
    tipoCalculo === "promedio" &&
    contexto.costoPromedioKg > 0
  ) {
    const factor = Number(regla?.factor || 1);
    costoUnitario = contexto.costoPromedioKg * factor;
    costoTotal = costoUnitario * cantidad;
    origenCosto = "promedio_produccion";
    detalleCosto =
      `Costo promedio producción: $${Math.round(
        contexto.costoPromedioKg
      ).toLocaleString("es-UY")}/kg × factor ${factor}`;
    tieneCosto = true;
  }

  if (!tieneCosto && tipoCalculo === "receta") {
    const receta = regla?.receta_id
      ? contexto.recetasPorId.get(regla.receta_id)
      : null;

    costoUnitario = Number(
      receta?.costo_kg || receta?.costo_total || 0
    );

    if (costoUnitario > 0) {
      costoTotal = costoUnitario * cantidad;
      origenCosto = "receta";
      detalleCosto = receta.nombre;
      tieneCosto = true;
    }
  }

  if (!tieneCosto && costoManual) {
    costoUnitario = Number(costoManual.costo || 0);

    if (costoUnitario > 0) {
      costoTotal = costoUnitario * cantidad;
      tipoCalculo = costoManual.estimado ? "estimado" : "manual";
      origenCosto = costoManual.origen || "costo_manual";
      detalleCosto = `Costo importado: ${costoManual.nombre_producto}`;
      tieneCosto = true;
    }
  }

  if (
    !tieneCosto &&
    gananciaSistema > 0 &&
    ventas >= gananciaSistema
  ) {
    costoTotal = Math.max(ventas - gananciaSistema, 0);
    costoUnitario = cantidad > 0 ? costoTotal / cantidad : 0;
    tipoCalculo = "estimado";
    origenCosto = "sistema_estimado";
    detalleCosto = "Costo estimado = ventas - ganancia del sistema";
    tieneCosto = true;
  }

  if (!tieneCosto) {
    tipoCalculo = "sin_costo";
    origenCosto = "sin_costo";
    detalleCosto = "Producto vendido sin costo asignado";
  }

  return {
    cantidad,
    ventas,
    tipoCalculo,
    costoUnitario,
    costoTotal,
    origenCosto,
    detalleCosto,
    tieneCosto,
  };
}

function construirFilas(input: {
  productos: any[];
  canal: "Paradise" | "PedidosYa" | "Salón" | "Re Order";
  empresa_id: string;
  periodo_id: string;
  sucursal_id?: string | null;
  contexto: ContextoCostos;
  vinculaciones: Map<string, string>;

  descuentoLocalTotal?: number;
  comisionTotal?: number;
  ivaComisionTotal?: number;
  tarifaPagoLineaTotal?: number;
  retencionRecuperableTotal?: number;

  contadores: Contadores;
}) {
  const ventasBrutasCanal = input.productos.reduce(
    (total, producto) =>
      total +
      Number(
        producto.total ??
          producto.ventas ??
          0
      ),
    0
  );

  return input.productos.map((producto) => {
    const costo = calcularCostoProducto({
      producto,
      contexto: input.contexto,
      vinculaciones: input.vinculaciones,
    });

    const ventasBrutas = costo.ventas;

    const participacion =
      ventasBrutasCanal > 0
        ? ventasBrutas / ventasBrutasCanal
        : 0;

    const descuentoLocalAsignado =
      input.canal === "PedidosYa"
        ? Number(
            input.descuentoLocalTotal || 0
          ) * participacion
        : 0;

    const comisionAsignada =
      input.canal === "PedidosYa"
        ? Number(input.comisionTotal || 0) *
          participacion
        : 0;

    const ivaComisionAsignado =
      input.canal === "PedidosYa"
        ? Number(
            input.ivaComisionTotal || 0
          ) * participacion
        : 0;

    const tarifaPagoLineaAsignada =
      input.canal === "PedidosYa"
        ? Number(
            input.tarifaPagoLineaTotal || 0
          ) * participacion
        : 0;

    const retencionAsignada =
      input.canal === "PedidosYa"
        ? Number(
            input.retencionRecuperableTotal || 0
          ) * participacion
        : 0;

    const ventasEfectivas = Math.max(
      ventasBrutas -
        descuentoLocalAsignado,
      0
    );

    const costoCanalAsignado =
      comisionAsignada +
      ivaComisionAsignado +
      tarifaPagoLineaAsignada;

    if (!costo.tieneCosto) {
      input.contadores.productosSinCosto += 1;

      input.contadores.ventasSinCosto +=
        ventasEfectivas;

      input.contadores.nombresSinCosto.push(
        `${input.canal}: ${producto.nombre_producto}`
      );
    }

    const margen = costo.tieneCosto
      ? ventasEfectivas -
        costo.costoTotal -
        costoCanalAsignado
      : 0;

    const detallePedidosYa =
      input.canal === "PedidosYa"
        ? [
            `Venta bruta: $${ventasBrutas.toFixed(2)}`,
            `Descuento local: $${descuentoLocalAsignado.toFixed(2)}`,
            `Comisión 23%: $${comisionAsignada.toFixed(2)}`,
            `IVA comisión: $${ivaComisionAsignado.toFixed(2)}`,
            `Tarifa pago online: $${tarifaPagoLineaAsignada.toFixed(2)}`,
            `Retención recuperable: $${retencionAsignada.toFixed(2)}`,
          ].join(". ")
        : "";

    return {
      empresa_id: input.empresa_id,
      periodo_id: input.periodo_id,
      sucursal_id: input.sucursal_id || null,

      nombre_producto:
        producto.nombre_producto,

      categoria:
        producto.categoria || null,

      cantidad: costo.cantidad,

      /*
       * En ventas se guarda el ingreso económico real:
       * venta bruta menos descuento financiado por Duna.
       */
      ventas: ventasEfectivas,
      ventas_brutas: ventasBrutas,
      descuento_local:
        descuentoLocalAsignado,

      tipo_calculo: costo.tipoCalculo,
      costo_unitario: costo.costoUnitario,
      costo_total: costo.costoTotal,

      /*
       * Comisión conserva únicamente el 23%.
       */
      comision: comisionAsignada,
      iva_comision: ivaComisionAsignado,
      tarifa_pago_linea:
        tarifaPagoLineaAsignada,
      retencion_recuperable:
        retencionAsignada,

      margen,

      margen_porcentaje:
        costo.tieneCosto &&
        ventasEfectivas > 0
          ? (margen / ventasEfectivas) * 100
          : 0,

      origen_costo: costo.origenCosto,

      detalle_costo:
        input.canal === "PedidosYa"
          ? `${costo.detalleCosto}. ${detallePedidosYa}`
          : costo.detalleCosto,

      canal: input.canal,
    };
  });
}


type ParadiseExclusionDetalle = {
  nombre_producto: string;
  cantidad: number;
  total: number;
};

type VentaManualCabecera = {
  id: string;
  canal: "Salón" | "Re Order";
  comprobante_id: string;
  total: number;
  envio?: number | null;
};

type VentaManualDetalle = {
  venta_id: string;
  nombre_producto: string;
  categoria?: string | null;
  cantidad: number;
  total: number;
};

function similitudNombre(a: string, b: string) {
  const pa = palabras(a);
  const pb = palabras(b);

  if (!pa.length || !pb.length) return 0;

  const coincidencias = pa.filter((palabra) =>
    pb.includes(palabra)
  ).length;

  return (
    coincidencias /
    Math.max(pa.length, pb.length)
  );
}

async function cargarExclusionesParadise(
  input: CalcularRentabilidadInput
): Promise<ParadiseExclusionDetalle[]> {
  let cabecerasQuery = supabase
    .from("duna_paradise_exclusion")
    .select("id")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .eq("activo", true);

  if (input.sucursal_id) {
    cabecerasQuery = cabecerasQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
  }

  const {
    data: cabeceras,
    error: cabecerasError,
  } = await cabecerasQuery;

  if (cabecerasError) throw cabecerasError;

  const ids = (cabeceras || []).map(
    (item: any) => item.id
  );

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("duna_paradise_exclusion_detalle")
    .select(
      "nombre_producto, cantidad, total"
    )
    .in("exclusion_id", ids);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    nombre_producto: String(
      item.nombre_producto || ""
    ),
    cantidad: Number(item.cantidad || 0),
    total: Number(item.total || 0),
  }));
}

function aplicarExclusionesParadise(
  productosOriginales: any[],
  exclusiones: ParadiseExclusionDetalle[]
) {
  const productos = productosOriginales.map(
    (producto) => ({
      ...producto,
      cantidad: Number(
        producto.cantidad || 0
      ),
      ventas: Number(
        producto.ventas ??
          producto.total ??
          0
      ),
      ganancia: Number(
        producto.ganancia || 0
      ),
    })
  );

  for (const exclusion of exclusiones) {
    const nombreExclusion = normalizar(
      exclusion.nombre_producto
    );

    let indice = productos.findIndex(
      (producto) =>
        normalizar(
          producto.nombre_producto
        ) === nombreExclusion
    );

    if (indice < 0) {
      let mejorIndice = -1;
      let mejorPuntaje = 0;

      productos.forEach(
        (producto, posicion) => {
          const puntaje = similitudNombre(
            String(
              producto.nombre_producto || ""
            ),
            exclusion.nombre_producto
          );

          if (puntaje > mejorPuntaje) {
            mejorPuntaje = puntaje;
            mejorIndice = posicion;
          }
        }
      );

      if (mejorPuntaje >= 0.8) {
        indice = mejorIndice;
      }
    }

    if (indice < 0) {
      console.warn(
        "No se encontró producto Paradise para exclusión:",
        exclusion.nombre_producto
      );
      continue;
    }

    const producto = productos[indice];

    const ventasAntes = Number(
      producto.ventas || 0
    );
    const gananciaAntes = Number(
      producto.ganancia || 0
    );

    const ventasDespues = Math.max(
      ventasAntes -
        Number(exclusion.total || 0),
      0
    );

    producto.cantidad = Math.max(
      Number(producto.cantidad || 0) -
        Number(exclusion.cantidad || 0),
      0
    );

    producto.ventas = ventasDespues;

    /*
     * Si Paradise trae ganancia estimada,
     * se reduce proporcionalmente para no
     * conservar ganancia de la venta excluida.
     */
    if (
      gananciaAntes > 0 &&
      ventasAntes > 0
    ) {
      producto.ganancia =
        gananciaAntes *
        (ventasDespues / ventasAntes);
    }
  }

  return productos.filter(
    (producto) =>
      Number(producto.cantidad || 0) > 0 ||
      Number(producto.ventas || 0) > 0
  );
}

async function cargarVentasManuales(
  input: CalcularRentabilidadInput
): Promise<{
  salon: any[];
  reorder: any[];
}> {
  let cabecerasQuery = supabase
    .from("duna_venta_manual")
    .select(
      "id, canal, comprobante_id, total, envio"
    )
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id)
    .eq("activo", true);

  if (input.sucursal_id) {
    cabecerasQuery = cabecerasQuery.eq(
      "sucursal_id",
      input.sucursal_id
    );
  }

  const {
    data: cabecerasData,
    error: cabecerasError,
  } = await cabecerasQuery;

  if (cabecerasError) throw cabecerasError;

  const cabeceras =
    (cabecerasData ||
      []) as VentaManualCabecera[];

  if (!cabeceras.length) {
    return {
      salon: [],
      reorder: [],
    };
  }

  const ids = cabeceras.map(
    (venta) => venta.id
  );

  const {
    data: detallesData,
    error: detallesError,
  } = await supabase
    .from("duna_venta_manual_detalle")
    .select(
      "venta_id, nombre_producto, categoria, cantidad, total"
    )
    .in("venta_id", ids);

  if (detallesError) throw detallesError;

  const detalles =
    (detallesData ||
      []) as VentaManualDetalle[];

  const porVenta = new Map<
    string,
    VentaManualDetalle[]
  >();

  for (const detalle of detalles) {
    const lista =
      porVenta.get(detalle.venta_id) || [];

    lista.push(detalle);
    porVenta.set(
      detalle.venta_id,
      lista
    );
  }

  const salon: any[] = [];
  const reorder: any[] = [];

  for (const venta of cabeceras) {
    const lineas =
      porVenta.get(venta.id) || [];

    if (!lineas.length) {
      console.warn(
        `Comprobante ${venta.comprobante_id} sin detalle.`
      );
      continue;
    }

    const envio =
      venta.canal === "Re Order"
        ? Math.max(
            Number(venta.envio || 0),
            0
          )
        : 0;

    const totalTicket = Math.max(
      Number(venta.total || 0),
      0
    );

    const totalProductosEfectivo =
      Math.max(totalTicket - envio, 0);

    const brutoProductos =
      lineas.reduce(
        (total, linea) =>
          total +
          Number(linea.total || 0),
        0
      );

    const factor =
      brutoProductos > 0
        ? totalProductosEfectivo /
          brutoProductos
        : 0;

    const destino =
      venta.canal === "Salón"
        ? salon
        : reorder;

    for (const linea of lineas) {
      destino.push({
        nombre_producto:
          linea.nombre_producto,
        categoria:
          linea.categoria || null,
        cantidad: Number(
          linea.cantidad || 0
        ),
        /*
         * Los descuentos del ticket se
         * distribuyen entre los productos.
         * El envío se mantiene separado.
         */
        ventas:
          Number(linea.total || 0) *
          factor,
        ganancia: 0,
      });
    }

    if (envio > 0) {
      destino.push({
        nombre_producto:
          "Envío Re Order",
        categoria: "Envío",
        cantidad: 1,
        ventas: envio,
        /*
         * El envío no tiene costo de producto.
         * Al indicar ganancia = venta, la lógica
         * existente calcula costo 0 y margen
         * igual al importe del envío.
         */
        ganancia: envio,
      });
    }
  }

  return {
    salon,
    reorder,
  };
}

async function cargarProductosParadise(
  input: CalcularRentabilidadInput
) {
  let query = supabase
    .from("producto_ventas_resumen")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  const agrupados = new Map<string, any>();

  for (const producto of data || []) {
    const clave =
      String(producto.codigo_producto || "").trim() ||
      normalizar(producto.nombre_producto);
    const existente = agrupados.get(clave);

    if (existente) {
      existente.cantidad =
        Number(existente.cantidad || 0) +
        Number(producto.cantidad || 0);
      existente.ventas =
        Number(existente.ventas || 0) +
        Number(producto.ventas || 0);
    } else {
      agrupados.set(clave, {
        ...producto,
        cantidad: Number(producto.cantidad || 0),
        ventas: Number(producto.ventas || 0),
      });
    }
  }

  const productosAgrupados =
    Array.from(agrupados.values());

  const exclusiones =
    await cargarExclusionesParadise(
      input
    );

  return aplicarExclusionesParadise(
    productosAgrupados,
    exclusiones
  );
}

async function cargarProductosPedidosYa(
  input: CalcularRentabilidadInput
) {
  let query = supabase
    .from("pedidosya_producto_resumen")
    .select("*")
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    query = query.eq("sucursal_id", input.sucursal_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  const agrupados = new Map<string, any>();

  for (const producto of data || []) {
    const clave =
      String(producto.codigo_producto || "").trim() ||
      normalizar(producto.nombre_producto);
    const existente = agrupados.get(clave);

    if (existente) {
      existente.cantidad =
        Number(existente.cantidad || 0) +
        Number(producto.cantidad || 0);
      existente.ventas =
        Number(existente.ventas || 0) +
        Number(producto.ventas || 0);
    } else {
      agrupados.set(clave, {
        ...producto,
        cantidad: Number(producto.cantidad || 0),
        ventas: Number(producto.ventas || 0),
      });
    }
  }

  return Array.from(agrupados.values());
}

async function cargarCostosCanalPedidosYa(
  input: CalcularRentabilidadInput
) {
  let query = supabase
    .from("pedidosya_pedidos")
    .select(`
      estado_pedido,
      total_parcial,
      descuento_local,
      descuento_pedidosya,
      comision,
      tarifa_pago_linea,
      cargos,
      cargo_impositivo,
      impuestos,
      ingreso_estimado
    `)
    .eq("empresa_id", input.empresa_id)
    .eq("periodo_id", input.periodo_id);

  if (input.sucursal_id) {
    query = query.eq(
      "sucursal_id",
      input.sucursal_id
    );
  } else {
    query = query.is("sucursal_id", null);
  }

  const { data, error } = await query;

  if (error) throw error;

  const pedidosContabilizables = (
    data || []
  ).filter((pedido: any) => {
    const estado = normalizar(
      pedido.estado_pedido || ""
    );

    if (!estado) return true;

    return [
      "entregado",
      "realizado",
      "completado",
      "completed",
      "delivered",
    ].includes(estado);
  });

  const resumenBase =
    pedidosContabilizables.reduce(
      (acc, pedido: any) => ({
        ventas_brutas:
          acc.ventas_brutas +
          Number(
            pedido.total_parcial || 0
          ),

        descuento_local:
          acc.descuento_local +
          Number(
            pedido.descuento_local || 0
          ),

        descuento_pedidosya:
          acc.descuento_pedidosya +
          Number(
            pedido.descuento_pedidosya || 0
          ),

        comision:
          acc.comision +
          Number(pedido.comision || 0),

        tarifa_pago_linea:
          acc.tarifa_pago_linea +
          Number(
            pedido.tarifa_pago_linea || 0
          ),

        cargos:
          acc.cargos +
          Number(pedido.cargos || 0),

        cargo_impositivo:
          acc.cargo_impositivo +
          Number(
            pedido.cargo_impositivo ??
              pedido.impuestos ??
              0
          ),

        ingreso_estimado:
          acc.ingreso_estimado +
          Number(
            pedido.ingreso_estimado || 0
          ),
      }),
      {
        ventas_brutas: 0,
        descuento_local: 0,
        descuento_pedidosya: 0,
        comision: 0,
        tarifa_pago_linea: 0,
        cargos: 0,
        cargo_impositivo: 0,
        ingreso_estimado: 0,
      }
    );

  /*
   * El IVA se calcula sobre el total de la comisión:
   * comisión 23% × IVA 22%.
   */
  const ivaComision =
    resumenBase.comision * 0.22;

  /*
   * El resto del cargo impositivo es una retención
   * recuperable y no se descuenta del margen.
   */
  const retencionRecuperable = Math.max(
    resumenBase.cargo_impositivo -
      ivaComision,
    0
  );

  const ventaEfectiva = Math.max(
    resumenBase.ventas_brutas -
      resumenBase.descuento_local,
    0
  );

  const costoCanal =
    resumenBase.comision +
    ivaComision +
    resumenBase.tarifa_pago_linea;

  return {
    ...resumenBase,

    pedidos:
      pedidosContabilizables.length,

    venta_efectiva: ventaEfectiva,
    iva_comision: ivaComision,

    retencion_recuperable:
      retencionRecuperable,

    /*
     * No incluye retenciones, descuentos financiados
     * por PedidosYa ni la columna genérica Cargos.
     */
    total: costoCanal,
  };
}

export async function calcularRentabilidadPeriodo(
  input: CalcularRentabilidadInput
) {
  const { error: periodoError } = await supabase
    .from("periodos")
    .select("id")
    .eq("id", input.periodo_id)
    .single();

  if (periodoError) throw periodoError;

  const [
    contexto,
    productosParadise,
    productosPedidosYa,
    costosPedidosYa,
    ventasManuales,
  ] = await Promise.all([
    cargarContextoCostos(input),
    cargarProductosParadise(input),
    cargarProductosPedidosYa(input),
    cargarCostosCanalPedidosYa(input),
    cargarVentasManuales(input),
  ]);

  let deleteQuery = supabase
  .from("rentabilidad_periodo")
  .delete()
  .eq("empresa_id", input.empresa_id)
  .eq("periodo_id", input.periodo_id);

if (input.sucursal_id) {
  deleteQuery = deleteQuery.eq(
    "sucursal_id",
    input.sucursal_id
  );
} else {
  deleteQuery = deleteQuery.is(
    "sucursal_id",
    null
  );
}

const { error: deleteError } =
  await deleteQuery;

if (deleteError) throw deleteError;

  const contadores: Contadores = {
    productosSinCosto: 0,
    ventasSinCosto: 0,
    nombresSinCosto: [],
  };

  const filasParadise = construirFilas({
    productos: productosParadise,
    canal: "Paradise",
    empresa_id: input.empresa_id,
    periodo_id: input.periodo_id,
    sucursal_id: input.sucursal_id || null,
    contexto,
    vinculaciones: contexto.vinculacionesParadise,
    contadores,
  });

  const filasPedidosYa = construirFilas({
  productos: productosPedidosYa,
  canal: "PedidosYa",
  empresa_id: input.empresa_id,
  periodo_id: input.periodo_id,
  sucursal_id: input.sucursal_id || null,
  contexto,
  vinculaciones:
    contexto.vinculacionesPedidosYa,

  descuentoLocalTotal:
    costosPedidosYa.descuento_local,

  comisionTotal:
    costosPedidosYa.comision,

  ivaComisionTotal:
    costosPedidosYa.iva_comision,

  tarifaPagoLineaTotal:
    costosPedidosYa.tarifa_pago_linea,

  retencionRecuperableTotal:
    costosPedidosYa.retencion_recuperable,

  contadores,
});

  const filasSalon = construirFilas({
    productos: ventasManuales.salon,
    canal: "Salón",
    empresa_id: input.empresa_id,
    periodo_id: input.periodo_id,
    sucursal_id: input.sucursal_id || null,
    contexto,
    vinculaciones:
      new Map<string, string>(),
    contadores,
  });

  const filasReOrder = construirFilas({
    productos: ventasManuales.reorder,
    canal: "Re Order",
    empresa_id: input.empresa_id,
    periodo_id: input.periodo_id,
    sucursal_id: input.sucursal_id || null,
    contexto,
    vinculaciones:
      new Map<string, string>(),
    contadores,
  });

  const filas = [
    ...filasParadise,
    ...filasPedidosYa,
    ...filasSalon,
    ...filasReOrder,
  ];

  if (filas.length > 0) {
    const { error: insertError } = await supabase
      .from("rentabilidad_periodo")
      .insert(filas);

    if (insertError) throw insertError;
  }

  return {
    productos: filas.length,
    productos_paradise: filasParadise.length,
    productos_pedidosya: filasPedidosYa.length,
    productos_salon: filasSalon.length,
    productos_reorder: filasReOrder.length,
    costo_promedio_kg: contexto.costoPromedioKg,
    kilos_produccion: 0,
    costo_total_produccion: 0,
    comision_pedidosya:
  costosPedidosYa.comision,

iva_comision_pedidosya:
  costosPedidosYa.iva_comision,

comision_mas_iva_pedidosya:
  costosPedidosYa.comision +
  costosPedidosYa.iva_comision,

tarifa_pago_linea_pedidosya:
  costosPedidosYa.tarifa_pago_linea,

descuento_local_pedidosya:
  costosPedidosYa.descuento_local,

descuento_pedidosya:
  costosPedidosYa.descuento_pedidosya,

ventas_brutas_pedidosya:
  costosPedidosYa.ventas_brutas,

ventas_efectivas_pedidosya:
  costosPedidosYa.venta_efectiva,

retencion_recuperable_pedidosya:
  costosPedidosYa.retencion_recuperable,

cargo_impositivo_pedidosya:
  costosPedidosYa.cargo_impositivo,

cargos_pedidosya:
  costosPedidosYa.cargos,

costos_canal_pedidosya:
  costosPedidosYa.total,

productos_sin_costo:
  contadores.productosSinCosto,

ventas_sin_costo:
  contadores.ventasSinCosto,

nombres_sin_costo:
  contadores.nombresSinCosto,
  };
}
