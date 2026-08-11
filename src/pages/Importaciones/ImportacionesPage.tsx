import {
  useEffect,
  useRef,
  useState,
} from "react";
import { leerCsv } from "../../services/csvService";
import { obtenerEmpresas } from "../../services/empresaService";
import { obtenerSucursalesPorEmpresa } from "../../services/sucursalService";
import { obtenerPeriodosPorEmpresa } from "../../services/periodoService";
import {
  crearImportacion,
  obtenerImportacionesPorEmpresa,
} from "../../services/importacionService";
import { reemplazarVentasPedidosYa } from "../../services/ventaService";
import { leerPdfIsatech } from "../../services/isatechPdfService";
import { leerPdfParadise } from "../../services/paradisePdfService";
import { parsearExcelCostosDuna } from "../../services/excelCostosDunaParser";
import { importarCostosManualesDuna } from "../../services/costosManualService";
import { reemplazarProductosIsatech } from "../../services/productoVentasService";
import { leerExcelProduccion } from "../../services/excelProduccionParser";
import { importarElaboraciones } from "../../services/elaboracionService";
import { calcularRentabilidadPeriodo } from "../../services/rentabilidadService";
import {
  obtenerRentabilidadPeriodo,
  type RentabilidadProducto,
} from "../../services/rentabilidadResultadoService";
import {
  filtrarProduccionPorPeriodo,
  validarIsatechPeriodo,
  validarPedidoYaPeriodo,
} from "../../services/validacionImportaciones";
import {
  leerExcelProductosPedidosYa,
  parsearFilasProductosPedidosYa,
} from "../../services/pedidosYaProductosParser";
import {
  reemplazarProductosPedidosYa,
} from "../../services/pedidosYaProductosService";
import {
  parsearFilasOrderDetailsPedidosYa,
} from "../../services/pedidosYaOrderDetailsParser";
import {
  reemplazarOrderDetailsPedidosYa,
} from "../../services/pedidosYaOrderDetailsService";
import {
  leerCsvSaboresPedidosYa,
} from "../../services/pedidosYaSaboresParser";
import {
  reemplazarResumenSaboresPedidosYa,
} from "../../services/pedidosYaSaboresService";
import type { Empresa } from "../../types/empresa";
import type { Sucursal } from "../../types/sucursal";
import type { Periodo } from "../../types/periodo";
import type { Importacion } from "../../types/importacion";
import {
  leerHistoricoNoFacturadoBerlin,
  leerInfoClubBerlin,
} from "../../services/berlinExcelParsers";
import { reemplazarVentasBerlin } from "../../services/berlinService";
import {
  calcularYGuardarConciliacionPiu,
  type ConciliacionPiu,
} from "../../services/conciliacionPiuService";

const BERLIN_EMPRESA_ID = "5b66d548-cf91-4262-8e65-2cfd70e9a148";

type TipoImportacion =
  | "pedidosya_csv"
  | "pedidosya_sabores_csv"
  | "pedidosya_csv_noche"
  | "pedidosya_productos_excel"
  | "pedidosya_productos_csv_noche"
  | "pedidosya_order_details_csv"
  | "pedidosya_order_details_csv_noche"
  | "isatech_pdf"
  | "paradise_pdf"
  | "produccion_excel"
  | "costos_excel"
  | "costos_duna_excel"
  | "berlin_infoclub_excel"
  | "berlin_historico_no_excel"
  | "berlin_costos_excel"
  | "berlin_ocr_salon"
  | "berlin_ocr_delivery"
  | "berlin_ocr_takeaway";

type OpcionImportacion = {
  value: TipoImportacion;
  label: string;
};

const OPCIONES_HELADERIA: OpcionImportacion[] = [
  {
    value: "pedidosya_sabores_csv",
    label: "PedidosYa detalle y sabores CSV",
  },
  {
    value: "pedidosya_csv",
    label: "PedidosYa resumen diario CSV",
  },
  { value: "isatech_pdf", label: "Isatech PDF" },
  {
    value: "produccion_excel",
    label: "Producción Excel",
  },
  { value: "costos_excel", label: "Costos Excel" },
];

const OPCIONES_RESTAURANTE: OpcionImportacion[] = [
  {
    value: "pedidosya_productos_excel",
    label: "PedidosYa mediodía - productos Excel",
  },
  {
    value: "pedidosya_order_details_csv",
    label: "PedidosYa mediodía - orderDetails CSV",
  },
  {
    value: "pedidosya_productos_csv_noche",
    label: "PedidosYa noche - productos CSV",
  },
  {
    value: "pedidosya_order_details_csv_noche",
    label: "PedidosYa noche - orderDetails CSV",
  },
  { value: "paradise_pdf", label: "Paradise PDF" },
  {
    value: "costos_duna_excel",
    label: "Costos Duna Excel",
  },
];

const OPCIONES_BERLIN: OpcionImportacion[] = [
  { value: "berlin_infoclub_excel", label: "InfoClub Excel · Salón" },
  { value: "berlin_historico_no_excel", label: "Histórico Facturado = NO · Junio" },
  { value: "berlin_costos_excel", label: "Costos Berlín Excel" },
  { value: "berlin_ocr_salon", label: "Comprobantes OCR · Salón (próximamente)" },
  { value: "berlin_ocr_delivery", label: "Comprobantes OCR · Delivery (próximamente)" },
  { value: "berlin_ocr_takeaway", label: "Comprobantes OCR · Take away (próximamente)" },
];

type RentabilidadConCanal = RentabilidadProducto & {
  canal?: string;
  comision?: number;
};

function obtenerPeriodoPredeterminado(periodos: Periodo[]) {
  const hoy = new Date();
  const actual = periodos.find(
    (p) => Number(p.anio) === hoy.getFullYear() && Number(p.mes) === hoy.getMonth() + 1
  );
  return actual?.id || [...periodos].sort(
    (a, b) => Number(b.anio) * 12 + Number(b.mes) - (Number(a.anio) * 12 + Number(a.mes))
  )[0]?.id || "";
}

export function ImportacionesPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [empresaId, setEmpresaId] = useState(
    () =>
      localStorage.getItem(
        "importaciones-empresa-seleccionada"
      ) || ""
  );
  const [sucursalId, setSucursalId] = useState("");
  const [periodoId, setPeriodoId] = useState("");
  const [tipoImportacion, setTipoImportacion] =
    useState<TipoImportacion>("pedidosya_csv");
  const [mensaje, setMensaje] = useState("");
  const [csvFilas, setCsvFilas] = useState<Record<string, string>[]>([]);
  const [importaciones, setImportaciones] = useState<Importacion[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [rentabilidad, setRentabilidad] =
    useState<RentabilidadConCanal[]>([]);
  const [conciliacionPiu, setConciliacionPiu] =
    useState<ConciliacionPiu | null>(null);
  const [cargandoConciliacion, setCargandoConciliacion] = useState(false);
  const calculandoRef = useRef(false);

  useEffect(() => {
    cargarEmpresas();
  }, []);

  useEffect(() => {
    if (!empresaId) return;

    localStorage.setItem(
      "importaciones-empresa-seleccionada",
      empresaId
    );
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || !periodoId) return;

    localStorage.setItem(
      `importaciones-periodo-${empresaId}`,
      periodoId
    );
  }, [empresaId, periodoId]);

  useEffect(() => {
    if (!empresaId || !sucursalId) return;

    localStorage.setItem(
      `importaciones-sucursal-${empresaId}`,
      sucursalId
    );
  }, [empresaId, sucursalId]);

  useEffect(() => {
    if (!empresaId || !tipoImportacion) return;

    localStorage.setItem(
      `importaciones-tipo-${empresaId}`,
      tipoImportacion
    );
  }, [empresaId, tipoImportacion]);

  useEffect(() => {
    if (empresaId && periodoId && sucursalId) {
      cargarRentabilidad();
    }
  }, [empresaId, periodoId, sucursalId]);

  useEffect(() => {
    void cargarConciliacionPiu();
  }, [empresaId, periodoId, sucursalId, empresas]);

  async function cargarEmpresas() {
    const data = await obtenerEmpresas();
    setEmpresas(data);

    if (data.length > 0) {
      const empresaGuardadaId =
        empresaId ||
        localStorage.getItem(
          "importaciones-empresa-seleccionada"
        );

      const empresaSeleccionada =
        data.find(
          (empresa) =>
            empresa.id === empresaGuardadaId
        ) || data[0];

      setEmpresaId(empresaSeleccionada.id);
      await cargarDatosEmpresa(
        empresaSeleccionada.id,
        empresaSeleccionada.tipo_negocio
      );
    }
  }

  async function cargarDatosEmpresa(
    id: string,
    tipoNegocio?: string | null
  ) {
    const [sucursalesData, periodosData] = await Promise.all([
      obtenerSucursalesPorEmpresa(id),
      obtenerPeriodosPorEmpresa(id),
    ]);

    const opciones =
      id === BERLIN_EMPRESA_ID
        ? OPCIONES_BERLIN
        : tipoNegocio === "restaurante"
        ? OPCIONES_RESTAURANTE
        : OPCIONES_HELADERIA;

    const tipoGuardado = localStorage.getItem(
      `importaciones-tipo-${id}`
    ) as TipoImportacion | null;

    const periodoGuardado = localStorage.getItem(
      `importaciones-periodo-${id}`
    );

    const sucursalGuardada = localStorage.getItem(
      `importaciones-sucursal-${id}`
    );

    setSucursales(sucursalesData);
    setPeriodos(periodosData);
    setTipoImportacion(
      opciones.some((opcion) => opcion.value === tipoGuardado)
        ? (tipoGuardado as TipoImportacion)
        : opciones[0]?.value || "pedidosya_csv"
    );
    setSucursalId(
      sucursalesData.some(
        (sucursal) => sucursal.id === sucursalGuardada
      )
        ? sucursalGuardada || ""
        : sucursalesData[0]?.id || ""
    );
    setPeriodoId(
      periodosData.some(
        (periodo) => periodo.id === periodoGuardado
      )
        ? periodoGuardado || ""
        : obtenerPeriodoPredeterminado(periodosData)
    );
    await cargarImportaciones(id);
  }

  async function cambiarEmpresa(id: string) {
    setEmpresaId(id);
    const empresa = empresas.find((item) => item.id === id);
    await cargarDatosEmpresa(id, empresa?.tipo_negocio);
  }

  async function cargarImportaciones(id: string) {
    setImportaciones(await obtenerImportacionesPorEmpresa(id));
  }

  async function cargarRentabilidad() {
    if (!empresaId || !periodoId || !sucursalId) return;

    const data = await obtenerRentabilidadPeriodo({
      empresa_id: empresaId,
      periodo_id: periodoId,
      sucursal_id: sucursalId,
    });

    setRentabilidad(data as RentabilidadConCanal[]);
  }

  async function cargarConciliacionPiu() {
    if (!empresaId || !periodoId || !sucursalId || esBerlin() || esRestaurante()) {
      setConciliacionPiu(null);
      return;
    }

    try {
      setCargandoConciliacion(true);
      const resultado = await calcularYGuardarConciliacionPiu({
        empresa_id: empresaId,
        sucursal_id: sucursalId,
        periodo_id: periodoId,
      });
      setConciliacionPiu(resultado);
    } catch (error) {
      console.error("Error calculando conciliación PIU:", error);
      setConciliacionPiu(null);
    } finally {
      setCargandoConciliacion(false);
    }
  }

  function periodoActual() {
    return periodos.find((periodo) => periodo.id === periodoId) || null;
  }

  function empresaActual() {
    return empresas.find(
      (empresa) => empresa.id === empresaId
    ) || null;
  }

  function esRestaurante() {
    return empresaActual()?.tipo_negocio === "restaurante";
  }

  function esBerlin() {
    const nombre = empresaActual()?.nombre.toLowerCase() || "";
    return empresaId === BERLIN_EMPRESA_ID || nombre.includes("berlín") || nombre.includes("berlin");
  }

  function opcionesImportacion() {
    return esBerlin()
      ? OPCIONES_BERLIN
      : esRestaurante()
      ? OPCIONES_RESTAURANTE
      : OPCIONES_HELADERIA;
  }

  function turnoImportacion():
    | "general"
    | "mediodia"
    | "noche" {
    if (!esRestaurante()) return "general";

    if (
      tipoImportacion === "pedidosya_csv_noche" ||
      tipoImportacion === "pedidosya_productos_csv_noche" ||
      tipoImportacion ===
        "pedidosya_order_details_csv_noche"
    ) {
      return "noche";
    }

    if (tipoImportacion.startsWith("pedidosya_")) {
      return "mediodia";
    }

    return "general";
  }

  function requiereSucursal() {
    return !["produccion_excel", "costos_excel", "costos_duna_excel", "berlin_costos_excel"].includes(
      tipoImportacion
    );
  }

  function sucursalOrNull() {
    return requiereSucursal() ? sucursalId : null;
  }

  function numero(valor?: string) {
    if (!valor) return 0;
    return Number(valor.replace(/\./g, "").replace(",", "."));
  }

  function moneda(valor: number) {
    return `$${Math.round(Number(valor || 0)).toLocaleString("es-UY")}`;
  }

  function porcentaje(valor: number) {
    return `${Number(valor || 0).toFixed(1)}%`;
  }

  function estadoImportacion(tipo: string, usaSucursal: boolean) {
    return importaciones.find((importacion: any) => {
      const mismoTipo = importacion.tipo === tipo;
      const mismoPeriodo = importacion.periodo_id === periodoId;
      const mismaSucursal = usaSucursal
        ? importacion.sucursal_id === sucursalId
        : true;

      return mismoTipo && mismoPeriodo && mismaSucursal;
    });
  }

  function EstadoItem({
    label,
    tipo,
    usaSucursal,
  }: {
    label: string;
    tipo: string;
    usaSucursal: boolean;
  }) {
    const item = estadoImportacion(tipo, usaSucursal);

    return (
      <div style={estadoItem}>
        <strong>
          {item ? "🟢" : "⚪"} {label}
        </strong>
        <span>
          {item
            ? `Importado (${item.registros_importados || 0} registros)`
            : "Pendiente"}
        </span>
      </div>
    );
  }

  const totalVentas = rentabilidad.reduce(
    (total, item) => total + Number(item.ventas || 0),
    0
  );
  const totalCosto = rentabilidad.reduce(
    (total, item) => total + Number(item.costo_total || 0),
    0
  );
  const totalComision = rentabilidad.reduce(
    (total, item) => total + Number(item.comision || 0),
    0
  );
  const totalMargen = rentabilidad.reduce(
    (total, item) => total + Number(item.margen || 0),
    0
  );
  const margenPorcentaje =
    totalVentas > 0 ? (totalMargen / totalVentas) * 100 : 0;

  async function registrarImportacion(input: {
    archivo: File;
    tipo?: string;
    registros: number;
    errores?: number;
    usaSucursal?: boolean;
  }) {
    const periodo = periodoActual();
    if (!periodo) throw new Error("Seleccioná un período");

    await crearImportacion({
      empresa_id: empresaId,
      sucursal_id:
        input.usaSucursal === false ? null : sucursalOrNull(),
      periodo_id: periodo.id,
      periodo_anio: periodo.anio,
      periodo_mes: periodo.mes,
      archivo_nombre: input.archivo.name,
      tipo: input.tipo || tipoImportacion,
      turno: turnoImportacion(),
      registros_importados: input.registros,
      errores: input.errores || 0,
    });
  }

  async function subirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const archivo = e.target.files?.[0];
      if (!archivo || !empresaId) return;

      const periodo = periodoActual();
      if (!periodo) throw new Error("Seleccioná un período");

      if (requiereSucursal() && !sucursalId) {
        throw new Error("Seleccioná una sucursal");
      }

      setMensaje("Procesando archivo...");

      if (
        tipoImportacion === "berlin_ocr_salon" ||
        tipoImportacion === "berlin_ocr_delivery" ||
        tipoImportacion === "berlin_ocr_takeaway"
      ) {
        throw new Error(
          "La carga OCR por modalidad ya está prevista, pero se habilitará al conectar el lector. Para junio usá el histórico Facturado = NO."
        );
      }

      if (
        tipoImportacion === "berlin_infoclub_excel" ||
        tipoImportacion === "berlin_historico_no_excel"
      ) {
        const ventasLeidas = tipoImportacion === "berlin_infoclub_excel"
          ? await leerInfoClubBerlin(archivo)
          : await leerHistoricoNoFacturadoBerlin(archivo);
        const ventas = ventasLeidas.filter((venta) => {
          if (!venta.fecha) return false;
          const fecha = new Date(venta.fecha);
          return fecha.getFullYear() === Number(periodo.anio) &&
            fecha.getMonth() + 1 === Number(periodo.mes);
        });
        if (!ventas.length) {
          throw new Error(`El archivo no contiene ventas de ${periodo.nombre}.`);
        }
        const resultado = await reemplazarVentasBerlin({
          empresa_id: empresaId,
          sucursal_id: sucursalId || null,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          fuente: tipoImportacion === "berlin_infoclub_excel" ? "infoclub" : "historico_no",
          ventas,
        });
        await registrarImportacion({ archivo, registros: resultado.importados });
        setMensaje(
          `${tipoImportacion === "berlin_infoclub_excel" ? "InfoClub" : "Histórico interno"} importado: ` +
          `${resultado.importados} líneas y ${moneda(resultado.ventas)}. La carga anterior de esta fuente y período fue reemplazada.`
        );
      }

      if (tipoImportacion === "berlin_costos_excel") {
        const resultado = await parsearExcelCostosDuna(archivo);
        const importacion = await importarCostosManualesDuna({
          empresa_id: empresaId,
          data: resultado,
          origen: "excel_berlin",
        });
        await registrarImportacion({ archivo, registros: importacion.importados, usaSucursal: false });
        setMensaje(`Costos Berlín importados: ${importacion.importados} productos.`);
      }

      if (
        tipoImportacion === "pedidosya_csv" ||
        tipoImportacion === "pedidosya_csv_noche"
      ) {
        const preview = await leerCsv(archivo);
        validarPedidoYaPeriodo(preview.filas, periodo);
        setCsvFilas(preview.filas);

        const ventas = preview.filas.map((fila) => ({
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          fecha: fila["Fecha"],
          pedidos: numero(fila["Pedidos"]),
          rechazados: numero(fila["Rechazados"]),
          ventas: numero(fila["Ventas"]),
          delivery: numero(fila["Ventas con delivery"]),
          pickup: numero(fila["Ventas con pickup"]),
        }));

        await reemplazarVentasPedidosYa(
          empresaId,
          ventas,
          turnoImportacion()
        );
        await registrarImportacion({
          archivo,
          registros: ventas.length,
        });

        setMensaje(
          `CSV diario de PedidosYa ${
            turnoImportacion() === "noche"
              ? "noche"
              : turnoImportacion() === "mediodia"
                ? "mediodía"
                : ""
          } importado: ${ventas.length} filas.`
        );
      }

      if (tipoImportacion === "pedidosya_sabores_csv") {
        const preview = await leerCsv(archivo);
        setCsvFilas(preview.filas);

        const pedidos = parsearFilasOrderDetailsPedidosYa(preview.filas);

        const resultadoPedidos = await reemplazarOrderDetailsPedidosYa({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          turno: "general",
          pedidos,
        });

        const resultado = await leerCsvSaboresPedidosYa(
          archivo,
          {
            anio: periodo.anio,
            mes: periodo.mes,
          }
        );

        await reemplazarResumenSaboresPedidosYa({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          sabores: resultado.sabores,
        });

        await registrarImportacion({
          archivo,
          registros: resultado.sabores.length,
        });

        setMensaje(
          `Detalle PedidosYa importado: ` +
            `${resultadoPedidos.pedidos_importados} pedidos, ` +
            `${resultadoPedidos.productos_importados} líneas de productos, ` +
            `${resultado.sabores.length} sabores y ` +
            `${resultado.selecciones_totales} selecciones.`
        );
      }

      if (
        tipoImportacion === "pedidosya_productos_excel" ||
        tipoImportacion === "pedidosya_productos_csv_noche"
      ) {
        const productos =
          tipoImportacion === "pedidosya_productos_excel"
            ? await leerExcelProductosPedidosYa(archivo)
            : parsearFilasProductosPedidosYa(
                (await leerCsv(archivo)).filas
              );

        await reemplazarProductosPedidosYa({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          turno: turnoImportacion(),
          productos,
        });

        await registrarImportacion({
          archivo,
          registros: productos.length,
        });

        setMensaje(
          `Productos PedidosYa ${
            turnoImportacion() === "noche"
              ? "noche"
              : "mediodía"
          } importados: ${productos.length}.`
        );
      }

      if (
        tipoImportacion ===
          "pedidosya_order_details_csv" ||
        tipoImportacion ===
          "pedidosya_order_details_csv_noche"
      ) {
        const preview = await leerCsv(archivo);
        setCsvFilas(preview.filas);

        const pedidos = parsearFilasOrderDetailsPedidosYa(preview.filas);

        const resultado = await reemplazarOrderDetailsPedidosYa({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          turno: turnoImportacion(),
          pedidos,
        });

        await registrarImportacion({
          archivo,
          registros: resultado.pedidos_importados,
        });

        setMensaje(
          `Order details ${
            turnoImportacion() === "noche"
              ? "noche"
              : "mediodía"
          } importado: ${resultado.pedidos_importados} pedidos y ` +
            `${resultado.productos_importados} líneas de productos.`
        );
      }

      if (tipoImportacion === "costos_duna_excel") {
        const resultado = await parsearExcelCostosDuna(archivo);
        const importacion = await importarCostosManualesDuna({
          empresa_id: empresaId,
          data: resultado,
        });

        await registrarImportacion({
          archivo,
          registros: importacion.importados,
          errores: importacion.importados === 0 ? 1 : 0,
          usaSucursal: false,
        });

        setMensaje(
          `Costos Duna importados: ${importacion.importados} productos.`
        );
      }

      if (tipoImportacion === "isatech_pdf") {
        const resultado = await leerPdfIsatech(archivo);

        validarIsatechPeriodo({
          periodo_inicio: resultado.periodo_inicio,
          periodo_fin: resultado.periodo_fin,
          periodo,
        });

        const importacion = await crearImportacion({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          archivo_nombre: archivo.name,
          tipo: tipoImportacion,
          registros_importados: resultado.productos.length,
          errores: resultado.productos.length === 0 ? 1 : 0,
        });

        if (!resultado.productos.length) {
          setMensaje("PDF leído, pero no se detectaron productos.");
          await cargarImportaciones(empresaId);
          return;
        }

        await reemplazarProductosIsatech({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          importacion_id: importacion.id,
          periodo_inicio: resultado.periodo_inicio,
          periodo_fin: resultado.periodo_fin,
          productos: resultado.productos,
        });

        setMensaje(`PDF Isatech importado: ${resultado.productos.length} productos.`);
      }

      if (tipoImportacion === "paradise_pdf") {
        const resultado = await leerPdfParadise(archivo);

        validarIsatechPeriodo({
          periodo_inicio: resultado.periodo_inicio,
          periodo_fin: resultado.periodo_fin,
          periodo,
        });

        const importacion = await crearImportacion({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          archivo_nombre: archivo.name,
          tipo: tipoImportacion,
          registros_importados: resultado.productos.length,
          errores: resultado.productos.length === 0 ? 1 : 0,
        });

        if (!resultado.productos.length) {
          setMensaje("PDF Paradise leído, pero no se detectaron productos.");
          await cargarImportaciones(empresaId);
          return;
        }

        await reemplazarProductosIsatech({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          importacion_id: importacion.id,
          periodo_inicio: resultado.periodo_inicio,
          periodo_fin: resultado.periodo_fin,
          productos: resultado.productos,
        });

        setMensaje(
          `Paradise importado: ${resultado.productos.length} productos y ` +
            `${moneda(Number(resultado.total_ventas || 0))} en ventas.`
        );
      }

      if (tipoImportacion === "produccion_excel") {
        const resultado = await leerExcelProduccion(archivo);
        const elaboraciones = filtrarProduccionPorPeriodo(
          resultado.elaboraciones,
          periodo
        );

        const importacion = await importarElaboraciones({
          empresa_id: empresaId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          archivo_nombre: archivo.name,
          elaboraciones,
        });

        await registrarImportacion({
          archivo,
          registros: importacion.importadas,
          errores: importacion.sin_receta,
          usaSucursal: false,
        });

        setMensaje(`Producción importada: ${importacion.importadas} filas.`);
      }

      if (tipoImportacion === "costos_excel") {
        setMensaje("El Excel de costos se importa desde la pestaña Costos.");
      }

      await cargarImportaciones(empresaId);
      await cargarConciliacionPiu();
      e.target.value = "";
    } catch (error: any) {
      console.error(error);
      setMensaje(error?.message || "Error importando archivo");
    }
  }

  async function calcularRentabilidad() {
  /*
   * El ref se actualiza inmediatamente y evita que
   * dos clics ejecuten el cálculo simultáneamente.
   */
  if (calculandoRef.current) return;

  calculandoRef.current = true;

  try {
    if (
      !empresaId ||
      !periodoId ||
      !sucursalId
    ) {
      throw new Error(
        "Seleccioná empresa, período y sucursal."
      );
    }

    setCalculando(true);
    setMensaje(
      "Calculando Paradise + PedidosYa..."
    );

    const resultado =
      await calcularRentabilidadPeriodo({
        empresa_id: empresaId,
        periodo_id: periodoId,
        sucursal_id: sucursalId,
      });

    setMensaje(
      `Análisis recalculado. Paradise: ${resultado.productos_paradise}. ` +
        `PedidosYa: ${resultado.productos_pedidosya}. ` +
        `Costos del canal PedidosYa: ${moneda(
          resultado.costos_canal_pedidosya
        )}. Sin costo: ${resultado.productos_sin_costo}.`
    );

    await cargarRentabilidad();
  } catch (error: any) {
    console.error(error);

    setMensaje(
      error?.message ||
        "Error calculando rentabilidad"
    );
  } finally {
    calculandoRef.current = false;
    setCalculando(false);
  }
}

  return (
    <div style={page}>
      <h2>Importaciones</h2>

      <section style={card}>
        <h3>Nueva importación</h3>

        <label style={label}>Empresa</label>
        <select
          style={input}
          value={empresaId}
          onChange={(e) => cambiarEmpresa(e.target.value)}
        >
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.nombre}
            </option>
          ))}
        </select>

        <label style={label}>Tipo de importación</label>
        <select
          style={input}
          value={tipoImportacion}
          onChange={(e) =>
            setTipoImportacion(e.target.value as TipoImportacion)
          }
        >
          {opcionesImportacion().map((opcion) => (
            <option
              key={opcion.value}
              value={opcion.value}
            >
              {opcion.label}
            </option>
          ))}
        </select>

        <label style={label}>Período</label>
        <select
          style={input}
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
        >
          {periodos.length === 0 ? (
            <option value="">Sin períodos</option>
          ) : (
            periodos.map((periodo) => (
              <option key={periodo.id} value={periodo.id}>
                {periodo.nombre}
              </option>
            ))
          )}
        </select>

        {requiereSucursal() ? (
          <>
            <label style={label}>Sucursal</label>
            <select
              style={input}
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
            >
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p style={hint}>Esta importación corresponde a toda la empresa.</p>
        )}

        <input
          style={input}
          type="file"
          accept=".csv,.pdf,.xlsx,.xls,.xltx,.jpg,.jpeg,.png,.webp"
          onChange={subirArchivo}
        />

        {mensaje && <p>{mensaje}</p>}
      </section>

      <section style={card}>
        <h3>Estado del período</h3>
        <p>
          <strong>{periodoActual()?.nombre || "Sin período"}</strong>
        </p>

        {esBerlin() ? (
          <>
            <EstadoItem label="InfoClub · Salón" tipo="berlin_infoclub_excel" usaSucursal />
            <EstadoItem label="Histórico interno · Facturado NO" tipo="berlin_historico_no_excel" usaSucursal />
            <EstadoItem label="Costos Berlín" tipo="berlin_costos_excel" usaSucursal={false} />
            <p style={hint}>OCR preparado en tres lotes separados: Salón, Delivery y Take away.</p>
          </>
        ) : esRestaurante() ? (
          <>
            <EstadoItem
              label="PedidosYa mediodía - productos"
              tipo="pedidosya_productos_excel"
              usaSucursal
            />
            <EstadoItem
              label="PedidosYa mediodía - orderDetails"
              tipo="pedidosya_order_details_csv"
              usaSucursal
            />
            <EstadoItem
              label="PedidosYa noche - productos"
              tipo="pedidosya_productos_csv_noche"
              usaSucursal
            />
            <EstadoItem
              label="PedidosYa noche - orderDetails"
              tipo="pedidosya_order_details_csv_noche"
              usaSucursal
            />
            <EstadoItem
              label="Paradise"
              tipo="paradise_pdf"
              usaSucursal
            />
            <EstadoItem
              label="Costos Duna"
              tipo="costos_duna_excel"
              usaSucursal={false}
            />
          </>
        ) : (
          <>
            <EstadoItem
              label="PedidosYa resumen diario"
              tipo="pedidosya_csv"
              usaSucursal
            />
            <EstadoItem
              label="PedidosYa detalle y sabores"
              tipo="pedidosya_sabores_csv"
              usaSucursal
            />
            <EstadoItem
              label="Isatech"
              tipo="isatech_pdf"
              usaSucursal
            />
            <EstadoItem
              label="Producción"
              tipo="produccion_excel"
              usaSucursal={false}
            />
            <EstadoItem
              label="Costos"
              tipo="costos_excel"
              usaSucursal={false}
            />
          </>
        )}

        <button
  type="button"
  style={button}
  onClick={calcularRentabilidad}
  disabled={calculando}
>
  {calculando
    ? "Recalculando..."
    : "Recalcular análisis"}
</button>
      </section>

      {!esBerlin() && !esRestaurante() && (
        <section style={card}>
          <h3>Conciliación PedidosYa vs. Isatech</h3>

          {cargandoConciliacion ? (
            <p>Verificando información importada...</p>
          ) : !conciliacionPiu || conciliacionPiu.estado === "pendiente" ? (
            <p style={hint}>
              La conciliación se realizará automáticamente cuando estén
              disponibles los datos de PedidosYa e Isatech del mismo período
              y sucursal.
            </p>
          ) : (
            <>
              <div style={resumenGrid}>
                <div style={resumenBox}>
                  <strong>Estado</strong>
                  <span>
                    {conciliacionPiu.estado === "coincide"
                      ? "🟢 Coincide"
                      : conciliacionPiu.estado === "diferencia_menor"
                        ? "🟡 Diferencia menor"
                        : "🔴 Revisar"}
                  </span>
                </div>
                <div style={resumenBox}>
                  <strong>Venta efectiva PedidosYa</strong>
                  <span>{moneda(conciliacionPiu.venta_efectiva_pedidosya)}</span>
                </div>
                <div style={resumenBox}>
                  <strong>Venta identificada en Isatech</strong>
                  <span>{moneda(conciliacionPiu.venta_isatech_pedidosya)}</span>
                </div>
                <div style={resumenBox}>
                  <strong>Diferencia de ventas</strong>
                  <span>{moneda(conciliacionPiu.diferencia_ventas)}</span>
                </div>
                <div style={resumenBox}>
                  <strong>Unidades PedidosYa / Isatech</strong>
                  <span>
                    {conciliacionPiu.unidades_pedidosya.toLocaleString("es-UY")} /{" "}
                    {conciliacionPiu.unidades_isatech.toLocaleString("es-UY")}
                  </span>
                </div>
                <div style={resumenBox}>
                  <strong>Diferencia de unidades</strong>
                  <span>{conciliacionPiu.diferencia_unidades.toLocaleString("es-UY")}</span>
                </div>
                <div style={resumenBox}>
                  <strong>Pedidos contabilizados</strong>
                  <span>{conciliacionPiu.pedidos_contabilizados}</span>
                </div>
                <div style={resumenBox}>
                  <strong>Cancelados excluidos</strong>
                  <span>{conciliacionPiu.pedidos_cancelados}</span>
                </div>
              </div>

              {conciliacionPiu.detalle.length > 0 && (
                <div style={tablaConciliacionContenedor}>
                  <table style={tablaConciliacion}>
                    <thead>
                      <tr>
                        <th style={celda}>Producto agrupado</th>
                        <th style={celda}>PedidosYa</th>
                        <th style={celda}>Isatech</th>
                        <th style={celda}>Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conciliacionPiu.detalle.map((fila) => (
                        <tr key={fila.producto}>
                          <td style={celda}>{fila.producto}</td>
                          <td style={celda}>{fila.unidades_pedidosya.toLocaleString("es-UY")}</td>
                          <td style={celda}>{fila.unidades_isatech.toLocaleString("es-UY")}</td>
                          <td style={celda}>{fila.diferencia.toLocaleString("es-UY")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={hint}>
                Control informativo: las diferencias pueden corresponder a
                productos registrados con códigos generales en Isatech. No
                modifica la facturación, los costos, los márgenes, los rankings
                ni ningún cálculo del dashboard.
              </p>
            </>
          )}
        </section>
      )}

      {rentabilidad.length > 0 && (
        <section style={card}>
          <h3>Resultado de rentabilidad</h3>

          <div style={resumenGrid}>
            <div style={resumenBox}>
              <strong>Ventas</strong>
              <span>{moneda(totalVentas)}</span>
            </div>
            <div style={resumenBox}>
              <strong>Costo producto</strong>
              <span>{moneda(totalCosto)}</span>
            </div>
            <div style={resumenBox}>
              <strong>Comisión/canal</strong>
              <span>{moneda(totalComision)}</span>
            </div>
            <div style={resumenBox}>
              <strong>Margen</strong>
              <span>{moneda(totalMargen)}</span>
              <small>{porcentaje(margenPorcentaje)}</small>
            </div>
          </div>

          <div style={tableHeader}>
            <strong>Canal</strong>
            <strong>Producto</strong>
            <strong>Venta</strong>
            <strong>Costo</strong>
            <strong>Comisión/canal</strong>
            <strong>Margen</strong>
            <strong>%</strong>
          </div>

          {rentabilidad.map((item) => (
            <div key={item.id} style={tableRow}>
              <span>
                {esRestaurante()
                  ? item.canal || "Paradise"
                  : "Isatech"}
              </span>
              <span>{item.nombre_producto}</span>
              <span>{moneda(item.ventas)}</span>
              <span>{moneda(item.costo_total)}</span>
              <span>{moneda(Number(item.comision || 0))}</span>
              <span>{moneda(item.margen)}</span>
              <span>{porcentaje(item.margen_porcentaje)}</span>
            </div>
          ))}
        </section>
      )}

      <section style={card}>
        <h3>Historial de importaciones</h3>

        {importaciones.length === 0 ? (
          <p>No hay importaciones registradas.</p>
        ) : (
          importaciones.map((item) => (
            <div key={item.id} style={importItem}>
              <strong>{item.archivo_nombre}</strong>
              <span>Tipo: {item.tipo}</span>
              <span>Estado: {item.estado}</span>
              <span>Registros: {item.registros_importados || 0}</span>
              <span>
                Fecha: {new Date(item.created_at).toLocaleString("es-UY")}
              </span>
            </div>
          ))
        )}
      </section>

      {csvFilas.length > 0 && (
        <section style={card}>
          <h3>Vista previa CSV</h3>
          <p>Filas detectadas: {csvFilas.length}</p>
          <pre style={pre}>
            {JSON.stringify(csvFilas.slice(0, 3), null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  marginTop: 20,
  borderRadius: 16,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
};

const page: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  color: "#cbd5e1",
  fontSize: 14,
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 520,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
};

const hint: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14,
};

const button: React.CSSProperties = {
  marginTop: 18,
  padding: "12px 18px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const importItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "14px 0",
  borderBottom: "1px solid #334155",
};

const pre: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 8,
  overflowX: "auto",
};

const estadoItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid #334155",
};

const resumenGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))",
  gap: 12,
  marginBottom: 24,
  width: "100%",
  minWidth: 0,
};

const resumenBox: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 12,
  display: "grid",
  gap: 8,
  textAlign: "center",
  minWidth: 0,
  overflowWrap: "anywhere",
};

const tablaConciliacionContenedor: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "auto",
  marginTop: 20,
};

const tablaConciliacion: React.CSSProperties = {
  width: "100%",
  minWidth: 620,
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const celda: React.CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #334155",
  textAlign: "left",
  overflowWrap: "anywhere",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.8fr 2fr 1fr 1fr 1fr 1fr 0.7fr",
  gap: 12,
  padding: "12px 0",
  borderBottom: "2px solid #475569",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.8fr 2fr 1fr 1fr 1fr 1fr 0.7fr",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #334155",
};
