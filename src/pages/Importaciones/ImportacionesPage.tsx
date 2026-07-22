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
import type { Empresa } from "../../types/empresa";
import type { Sucursal } from "../../types/sucursal";
import type { Periodo } from "../../types/periodo";
import type { Importacion } from "../../types/importacion";

type TipoImportacion =
  | "pedidosya_csv"
  | "pedidosya_productos_excel"
  | "pedidosya_order_details_csv"
  | "isatech_pdf"
  | "paradise_pdf"
  | "produccion_excel"
  | "costos_excel"
  | "costos_duna_excel";

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
  const [empresaId, setEmpresaId] = useState("");
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
  const calculandoRef = useRef(false);

  useEffect(() => {
    cargarEmpresas();
  }, []);

  useEffect(() => {
    if (empresaId && periodoId && sucursalId) {
      cargarRentabilidad();
    }
  }, [empresaId, periodoId, sucursalId]);

  async function cargarEmpresas() {
    const data = await obtenerEmpresas();
    setEmpresas(data);

    if (data.length > 0) {
      setEmpresaId(data[0].id);
      await cargarDatosEmpresa(data[0].id);
    }
  }

  async function cargarDatosEmpresa(id: string) {
    const [sucursalesData, periodosData] = await Promise.all([
      obtenerSucursalesPorEmpresa(id),
      obtenerPeriodosPorEmpresa(id),
    ]);

    setSucursales(sucursalesData);
    setPeriodos(periodosData);
    setSucursalId(sucursalesData[0]?.id || "");
    setPeriodoId(obtenerPeriodoPredeterminado(periodosData));
    await cargarImportaciones(id);
  }

  async function cambiarEmpresa(id: string) {
    setEmpresaId(id);
    await cargarDatosEmpresa(id);
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

  function periodoActual() {
    return periodos.find((periodo) => periodo.id === periodoId) || null;
  }

  function requiereSucursal() {
    return !["produccion_excel", "costos_excel", "costos_duna_excel"].includes(
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

      if (tipoImportacion === "pedidosya_csv") {
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

        await reemplazarVentasPedidosYa(empresaId, ventas);
        await registrarImportacion({
          archivo,
          registros: ventas.length,
        });

        setMensaje(`CSV diario de PedidosYa importado: ${ventas.length} filas.`);
      }

      if (tipoImportacion === "pedidosya_productos_excel") {
        const productos = await leerExcelProductosPedidosYa(archivo);

        await reemplazarProductosPedidosYa({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          productos,
        });

        await registrarImportacion({
          archivo,
          registros: productos.length,
        });

        setMensaje(
          `Resumen de productos PedidosYa importado: ${productos.length} productos.`
        );
      }

      if (tipoImportacion === "pedidosya_order_details_csv") {
        const preview = await leerCsv(archivo);
        setCsvFilas(preview.filas);

        const pedidos = parsearFilasOrderDetailsPedidosYa(preview.filas);

        const resultado = await reemplazarOrderDetailsPedidosYa({
          empresa_id: empresaId,
          sucursal_id: sucursalId,
          periodo_id: periodo.id,
          periodo_anio: periodo.anio,
          periodo_mes: periodo.mes,
          pedidos,
        });

        await registrarImportacion({
          archivo,
          registros: resultado.pedidos_importados,
        });

        setMensaje(
          `Order details importado: ${resultado.pedidos_importados} pedidos y ` +
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
    <div>
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
          <option value="pedidosya_csv">PedidosYa resumen diario CSV</option>
          <option value="pedidosya_productos_excel">
            PedidosYa resumen de productos Excel
          </option>
          <option value="pedidosya_order_details_csv">
            PedidosYa orderDetails CSV
          </option>
          <option value="isatech_pdf">Isatech PDF</option>
          <option value="paradise_pdf">Paradise PDF</option>
          <option value="produccion_excel">Producción Excel</option>
          <option value="costos_excel">Costos Excel</option>
          <option value="costos_duna_excel">Costos Duna Excel</option>
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
          accept=".csv,.pdf,.xlsx,.xls"
          onChange={subirArchivo}
        />

        {mensaje && <p>{mensaje}</p>}
      </section>

      <section style={card}>
        <h3>Estado del período</h3>
        <p>
          <strong>{periodoActual()?.nombre || "Sin período"}</strong>
        </p>

        <EstadoItem
          label="PedidosYa resumen diario"
          tipo="pedidosya_csv"
          usaSucursal
        />
        <EstadoItem
          label="PedidosYa productos"
          tipo="pedidosya_productos_excel"
          usaSucursal
        />
        <EstadoItem
          label="PedidosYa orderDetails"
          tipo="pedidosya_order_details_csv"
          usaSucursal
        />
        <EstadoItem label="Isatech" tipo="isatech_pdf" usaSucursal />
        <EstadoItem label="Paradise" tipo="paradise_pdf" usaSucursal />
        <EstadoItem
          label="Producción"
          tipo="produccion_excel"
          usaSucursal={false}
        />
        <EstadoItem
          label="Costos Duna"
          tipo="costos_duna_excel"
          usaSucursal={false}
        />

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
            <strong>Canal</strong>
            <strong>Margen</strong>
            <strong>%</strong>
          </div>

          {rentabilidad.map((item) => (
            <div key={item.id} style={tableRow}>
              <span>{item.canal || "Paradise"}</span>
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
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 24,
};

const resumenBox: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 12,
  display: "grid",
  gap: 8,
  textAlign: "center",
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