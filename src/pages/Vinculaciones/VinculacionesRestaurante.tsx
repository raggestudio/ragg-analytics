import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  obtenerCostosManualesPorEmpresa,
  type CostoProductoManual,
} from "../../services/costosManualService";
import {
  guardarVinculacionProducto,
  obtenerVinculacionesProducto,
  type ProductoVinculacion,
} from "../../services/productoVinculacionService";
import { calcularRentabilidadPeriodo } from "../../services/rentabilidadService";

type Props = {
  empresaId: string;
};

type ContextoPeriodo = {
  periodo_id: string;
  sucursal_id: string | null;
};

type ProductoPendiente = {
  clave: string;
  sistema: "paradise" | "pedidosya";
  codigo_producto: string | null;
  nombre_producto: string;
  categoria: string | null;
  cantidad: number;
  ventas: number;
  contextos: ContextoPeriodo[];
};

type Sugerencia = {
  costo: CostoProductoManual;
  puntaje: number;
};

function normalizar(texto: string) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*$/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(ml|cc|gr|g|kg|lt|lts|l)\b/g, " ")
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

function distanciaLevenshtein(a: string, b: string) {
  const filas = a.length + 1;
  const columnas = b.length + 1;

  const matriz: number[][] = Array.from(
    { length: filas },
    () => Array(columnas).fill(0)
  );

  for (let i = 0; i < filas; i++) matriz[i][0] = i;
  for (let j = 0; j < columnas; j++) matriz[0][j] = j;

  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;

      matriz[i][j] = Math.min(
        matriz[i - 1][j] + 1,
        matriz[i][j - 1] + 1,
        matriz[i - 1][j - 1] + costo
      );
    }
  }

  return matriz[a.length][b.length];
}

function calcularSimilitud(nombreProducto: string, nombreCosto: string) {
  const producto = normalizar(nombreProducto);
  const costo = normalizar(nombreCosto);

  if (!producto || !costo) return 0;
  if (producto === costo) return 1;

  if (producto.includes(costo) || costo.includes(producto)) {
    const menor = Math.min(producto.length, costo.length);
    const mayor = Math.max(producto.length, costo.length);

    return 0.88 + (menor / mayor) * 0.1;
  }

  const palabrasProducto = palabras(producto);
  const palabrasCosto = palabras(costo);

  const coincidencias = palabrasProducto.filter((palabra) =>
    palabrasCosto.includes(palabra)
  ).length;

  const basePalabras = Math.max(
    palabrasProducto.length,
    palabrasCosto.length
  );

  const similitudPalabras =
    basePalabras > 0 ? coincidencias / basePalabras : 0;

  const distancia = distanciaLevenshtein(producto, costo);
  const largoMayor = Math.max(producto.length, costo.length);
  const similitudTexto =
    largoMayor > 0 ? 1 - distancia / largoMayor : 0;

  return similitudPalabras * 0.65 + similitudTexto * 0.35;
}

export default function VinculacionesRestaurante({
  empresaId,
}: Props) {
  const [productos, setProductos] = useState<ProductoPendiente[]>([]);
  const [costos, setCostos] = useState<CostoProductoManual[]>([]);
  const [, setVinculaciones] = useState<
  ProductoVinculacion[]
>([]);

  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [busquedasCosto, setBusquedasCosto] = useState<
    Record<string, string>
  >({});

  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardandoTodos, setGuardandoTodos] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, [empresaId]);

  async function cargarDatos() {
    setCargando(true);
    setMensaje("");

    try {
      const [
        costosData,
        vinculacionesData,
        rentabilidadResponse,
        ventasParadiseResponse,
        ventasPedidosYaResponse,
      ] = await Promise.all([
        obtenerCostosManualesPorEmpresa(empresaId),

        obtenerVinculacionesProducto({
          empresa_id: empresaId,
        }),

        supabase
          .from("rentabilidad_periodo")
          .select(
            `
              id,
              periodo_id,
              sucursal_id,
              nombre_producto,
              categoria,
              cantidad,
              ventas,
              canal,
              tipo_calculo
            `
          )
          .eq("empresa_id", empresaId)
          .eq("tipo_calculo", "sin_costo")
          .order("ventas", { ascending: false }),

        supabase
          .from("producto_ventas_resumen")
          .select(
            `
              periodo_id,
              sucursal_id,
              codigo_producto,
              nombre_producto
            `
          )
          .eq("empresa_id", empresaId)
          .eq("fuente", "Paradise"),

        supabase
          .from("pedidosya_producto_resumen")
          .select(
            `
              periodo_id,
              sucursal_id,
              codigo_producto,
              nombre_producto
            `
          )
          .eq("empresa_id", empresaId),
      ]);

      if (rentabilidadResponse.error) {
        throw rentabilidadResponse.error;
      }

      if (ventasParadiseResponse.error) {
        throw ventasParadiseResponse.error;
      }

      if (ventasPedidosYaResponse.error) {
        throw ventasPedidosYaResponse.error;
      }

      const mapaCodigo = new Map<string, string | null>();

      for (const fila of ventasParadiseResponse.data || []) {
        const clave = [
          "paradise",
          fila.periodo_id || "",
          normalizar(fila.nombre_producto),
        ].join("__");

        mapaCodigo.set(clave, fila.codigo_producto || null);
      }

      for (const fila of ventasPedidosYaResponse.data || []) {
        const clave = [
          "pedidosya",
          fila.periodo_id || "",
          normalizar(fila.nombre_producto),
        ].join("__");

        mapaCodigo.set(
          clave,
          fila.codigo_producto ||
            `nombre:${normalizar(fila.nombre_producto)}`
        );
      }

      const agrupados = new Map<string, ProductoPendiente>();

      for (const fila of rentabilidadResponse.data || []) {
        const sistema =
          String(fila.canal || "Paradise").toLowerCase() === "pedidosya"
            ? "pedidosya"
            : "paradise";

        const claveVenta = [
          sistema,
          fila.periodo_id || "",
          normalizar(fila.nombre_producto),
        ].join("__");

        const codigo = mapaCodigo.get(claveVenta) || null;

        const claveProducto = `${sistema}__${
          codigo || normalizar(fila.nombre_producto)
        }`;

        const existente = agrupados.get(claveProducto);

        const contexto: ContextoPeriodo = {
          periodo_id: fila.periodo_id,
          sucursal_id: fila.sucursal_id || null,
        };

        if (existente) {
          existente.cantidad += Number(fila.cantidad || 0);
          existente.ventas += Number(fila.ventas || 0);

          const contextoExiste = existente.contextos.some(
            (item) =>
              item.periodo_id === contexto.periodo_id &&
              item.sucursal_id === contexto.sucursal_id
          );

          if (!contextoExiste) {
            existente.contextos.push(contexto);
          }
        } else {
          agrupados.set(claveProducto, {
            clave: claveProducto,
            sistema,
            codigo_producto: codigo,
            nombre_producto: fila.nombre_producto,
            categoria: fila.categoria || null,
            cantidad: Number(fila.cantidad || 0),
            ventas: Number(fila.ventas || 0),
            contextos: [contexto],
          });
        }
      }

      const productosData = Array.from(agrupados.values()).sort(
        (a, b) => b.ventas - a.ventas
      );

      setProductos(productosData);
      setCostos(costosData);
      setVinculaciones(vinculacionesData);

      const seleccionesIniciales: Record<string, string> = {};

      for (const vinculacion of vinculacionesData) {
        if (vinculacion.costo_manual_id) {
          seleccionesIniciales[
            `${vinculacion.sistema}__${vinculacion.codigo_sistema}`
          ] =
            vinculacion.costo_manual_id;
        }
      }

      setSelecciones(seleccionesIniciales);
    } catch (error: any) {
      console.error(error);

      setMensaje(
        error?.message ||
          "No se pudieron cargar las vinculaciones."
      );
    } finally {
      setCargando(false);
    }
  }

  const sugerencias = useMemo(() => {
    const resultado = new Map<string, Sugerencia | null>();

    for (const producto of productos) {
      let mejor: Sugerencia | null = null;

      for (const costo of costos) {
        const puntaje = calcularSimilitud(
          producto.nombre_producto,
          costo.nombre_producto
        );

        if (!mejor || puntaje > mejor.puntaje) {
          mejor = {
            costo,
            puntaje,
          };
        }
      }

      resultado.set(
        producto.clave,
        mejor && mejor.puntaje >= 0.68 ? mejor : null
      );
    }

    return resultado;
  }, [productos, costos]);

  useEffect(() => {
    const nuevasSelecciones: Record<string, string> = {};
    const nuevasBusquedas: Record<string, string> = {};

    for (const producto of productos) {
      const sugerencia = sugerencias.get(producto.clave);

      if (
        sugerencia &&
        sugerencia.puntaje >= 0.78 &&
        !selecciones[producto.clave]
      ) {
        nuevasSelecciones[producto.clave] =
          sugerencia.costo.id;

        nuevasBusquedas[producto.clave] =
          sugerencia.costo.nombre_producto;
      }
    }

    if (Object.keys(nuevasSelecciones).length > 0) {
      setSelecciones((prev) => ({
        ...prev,
        ...nuevasSelecciones,
      }));

      setBusquedasCosto((prev) => ({
        ...prev,
        ...nuevasBusquedas,
      }));
    }
  }, [sugerencias, productos]);

  const productosFiltrados = useMemo(() => {
    const texto = normalizar(busquedaGeneral);

    if (!texto) return productos;

    return productos.filter((producto) =>
      normalizar(
        `${producto.nombre_producto} ${
          producto.codigo_producto || ""
        }`
      ).includes(texto)
    );
  }, [productos, busquedaGeneral]);

  const sugerenciasConfiables = productos.filter((producto) => {
    const sugerencia = sugerencias.get(producto.clave);

    return (
      producto.codigo_producto &&
      sugerencia &&
      sugerencia.puntaje >= 0.9
    );
  });

  const ventasPendientes = productos.reduce(
    (total, producto) => total + producto.ventas,
    0
  );

  function costosFiltrados(producto: ProductoPendiente) {
    const texto = normalizar(
      busquedasCosto[producto.clave] || ""
    );

    const lista = texto
      ? costos.filter((costo) =>
          normalizar(costo.nombre_producto).includes(texto)
        )
      : [...costos].sort((a, b) => {
          const puntajeA = calcularSimilitud(
            producto.nombre_producto,
            a.nombre_producto
          );

          const puntajeB = calcularSimilitud(
            producto.nombre_producto,
            b.nombre_producto
          );

          return puntajeB - puntajeA;
        });

    return lista.slice(0, 8);
  }

  async function recalcularContextos(
    productosBase: ProductoPendiente[]
  ) {
    const contextos = new Map<string, ContextoPeriodo>();

    for (const producto of productosBase) {
      for (const contexto of producto.contextos) {
        const clave = `${contexto.periodo_id}__${
          contexto.sucursal_id || ""
        }`;

        contextos.set(clave, contexto);
      }
    }

    for (const contexto of contextos.values()) {
      await calcularRentabilidadPeriodo({
        empresa_id: empresaId,
        periodo_id: contexto.periodo_id,
        sucursal_id: contexto.sucursal_id,
      });
    }
  }

  async function guardarProducto(
    producto: ProductoPendiente,
    recalcular = true
  ) {
    const codigo = producto.codigo_producto;
    const costoManualId = selecciones[producto.clave];

    if (!codigo) {
      throw new Error(
        `${producto.nombre_producto} no tiene una clave de vinculación.`
      );
    }

    if (!costoManualId) {
      throw new Error(
        `Seleccioná un costo para ${producto.nombre_producto}.`
      );
    }

    await guardarVinculacionProducto({
      empresa_id: empresaId,
      sistema: producto.sistema,
      codigo_sistema: codigo,
      nombre_sistema: producto.nombre_producto,
      costo_manual_id: costoManualId,
    });

    if (recalcular) {
      await recalcularContextos([producto]);
      await cargarDatos();
    }
  }

  async function guardarProductoIndividual(
  producto: ProductoPendiente
) {
  try {
    setMensaje("Guardando vinculación...");

    await guardarProducto(producto);

    setMensaje(
      `Vinculación guardada: ${producto.nombre_producto}.`
    );
  } catch (error: any) {
    console.error(
      "ERROR GUARDANDO VINCULACIÓN",
      error
    );

    const mensajeError =
      error?.message ||
      error?.details ||
      error?.hint ||
      "No se pudo guardar la vinculación.";

    setMensaje(mensajeError);
    alert(mensajeError);
  }
}

  async function aceptarTodasLasSugerencias() {
    if (sugerenciasConfiables.length === 0) {
      setMensaje(
        "No hay sugerencias automáticas suficientemente confiables."
      );
      return;
    }

    try {
      setGuardandoTodos(true);

      setMensaje(
        `Guardando ${sugerenciasConfiables.length} vinculaciones...`
      );

      for (const producto of sugerenciasConfiables) {
        const sugerencia = sugerencias.get(producto.clave);

        if (!sugerencia || !producto.codigo_producto) continue;

        await guardarVinculacionProducto({
          empresa_id: empresaId,
          sistema: producto.sistema,
          codigo_sistema: producto.codigo_producto,
          nombre_sistema: producto.nombre_producto,
          costo_manual_id: sugerencia.costo.id,
        });
      }

      await recalcularContextos(sugerenciasConfiables);
      await cargarDatos();

      setMensaje(
        `Se guardaron ${sugerenciasConfiables.length} vinculaciones automáticas.`
      );
    } catch (error: any) {
      console.error(error);

      setMensaje(
        error?.message ||
          "No se pudieron guardar todas las sugerencias."
      );
    } finally {
      setGuardandoTodos(false);
    }
  }

  return (
    <div>
      <h2>Vinculaciones - Restaurante</h2>

      <section style={card}>
        <h3>Productos pendientes de costo</h3>

        <div style={metricGrid}>
          <Metric
            title="Productos pendientes"
            value={productos.length}
          />

          <Metric
            title="Ventas afectadas"
            value={`$${ventasPendientes.toLocaleString("es-UY")}`}
          />

          <Metric
            title="Costos disponibles"
            value={costos.length}
          />

          <Metric
            title="Sugerencias confiables"
            value={sugerenciasConfiables.length}
          />
        </div>

        {productos.length > 0 && (
          <div style={alerta}>
            <strong>
              ⚠ La rentabilidad todavía es parcial
            </strong>

            <p>
              Los productos de esta lista tienen ventas, pero
              todavía no tienen un costo vinculado.
            </p>

            {sugerenciasConfiables.length > 0 && (
              <button
                style={buttonPrincipal}
                disabled={guardandoTodos}
                onClick={aceptarTodasLasSugerencias}
              >
                {guardandoTodos
                  ? "Guardando..."
                  : `Aceptar ${sugerenciasConfiables.length} sugerencias confiables`}
              </button>
            )}
          </div>
        )}

        {mensaje && <p style={mensajeStyle}>{mensaje}</p>}
      </section>

      <section style={card}>
        <h3>Buscar producto pendiente</h3>

        <input
          style={input}
          placeholder="Buscar producto o código..."
          value={busquedaGeneral}
          onChange={(e) =>
            setBusquedaGeneral(e.target.value)
          }
        />
      </section>

      <section style={card}>
        <h3>Vincular productos Paradise y PedidosYa con costos</h3>

        {cargando ? (
          <p>Cargando...</p>
        ) : productosFiltrados.length === 0 ? (
          <p>No hay productos pendientes de costo.</p>
        ) : (
          <div style={lista}>
            {productosFiltrados.map((producto) => {
              const sugerencia = sugerencias.get(
                producto.clave
              );

              const seleccionId =
                selecciones[producto.clave] || "";

              const costoSeleccionado = costos.find(
                (costo) => costo.id === seleccionId
              );

              return (
                <article
                  key={producto.clave}
                  style={productoCard}
                >
                  <div style={productoEncabezado}>
  <div>
    <strong style={productoNombre}>
      {producto.nombre_producto}
    </strong>

    <div style={datosSecundarios}>
      {producto.sistema === "pedidosya"
        ? "PedidosYa"
        : "Código Paradise"}:{" "}
      {producto.sistema === "pedidosya"
        ? "Vinculación por nombre"
        : producto.codigo_producto || "Sin código"}
    </div>
  </div>

  <div style={ventasBox}>
    <span>Precio promedio por unidad</span>

    <strong style={precioUnitario}>
      $
      {(
        producto.cantidad > 0
          ? producto.ventas / producto.cantidad
          : 0
      ).toLocaleString("es-UY", {
        maximumFractionDigits: 2,
      })}
    </strong>

    <span>
      {producto.cantidad.toLocaleString("es-UY")} unidades
    </span>

    <small>
      Venta total: $
      {producto.ventas.toLocaleString("es-UY")}
    </small>
  </div>
</div>

                  {sugerencia && (
  <div style={sugerenciaBox}>
    <div style={sugerenciaTitulo}>
      <span>✓ Sugerencia automática</span>

      <strong>
        {sugerencia.costo.nombre_producto}
      </strong>
    </div>

    <div style={sugerenciaDatos}>
      <span>
        Costo unitario:{" "}
        <strong>
          $
          {Number(
            sugerencia.costo.costo
          ).toLocaleString("es-UY")}
        </strong>
      </span>

      <span>
        Coincidencia:{" "}
        <strong>
          {(sugerencia.puntaje * 100).toFixed(0)}%
        </strong>
      </span>
    </div>
  </div>
)}

                  <label style={label}>
                    Buscar producto costeado
                  </label>

                  <input
                    style={inputFila}
                    placeholder="Escribí para buscar..."
                    value={
                      busquedasCosto[producto.clave] || ""
                    }
                    onChange={(e) => {
                      const valor = e.target.value;

                      setBusquedasCosto((prev) => ({
                        ...prev,
                        [producto.clave]: valor,
                      }));

                      setSelecciones((prev) => ({
                        ...prev,
                        [producto.clave]: "",
                      }));
                    }}
                  />

                  <div style={opciones}>
                    {costosFiltrados(producto).map(
                      (costo) => {
                        const seleccionado =
                          seleccionId === costo.id;

                        return (
                          <button
                            key={costo.id}
                            type="button"
                            style={{
                              ...opcionCosto,
                              ...(seleccionado
                                ? opcionSeleccionada
                                : {}),
                            }}
                            onClick={() => {
                              setSelecciones((prev) => ({
                                ...prev,
                                [producto.clave]:
                                  costo.id,
                              }));

                              setBusquedasCosto((prev) => ({
                                ...prev,
                                [producto.clave]:
                                  costo.nombre_producto,
                              }));
                            }}
                          >
                            <span>
                              {costo.nombre_producto}
                            </span>

                            <strong>
                              $
                              {Number(
                                costo.costo
                              ).toLocaleString("es-UY")}
                            </strong>
                          </button>
                        );
                      }
                    )}
                  </div>

                  <div style={acciones}>
  {costoSeleccionado ? (
    <div style={comparacionCosto}>
      <strong>
        Seleccionado: {costoSeleccionado.nombre_producto}
      </strong>

      <div style={comparacionGrid}>
        <span>
          Precio por unidad:
          <strong>
            $
            {(
              producto.cantidad > 0
                ? producto.ventas / producto.cantidad
                : 0
            ).toLocaleString("es-UY", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </span>

        <span>
          Costo por unidad:
          <strong>
            $
            {Number(
              costoSeleccionado.costo
            ).toLocaleString("es-UY")}
          </strong>
        </span>

        <span>
          Margen por unidad:
          <strong>
            $
            {Math.max(
              producto.cantidad > 0
                ? producto.ventas / producto.cantidad -
                    Number(costoSeleccionado.costo)
                : 0,
              0
            ).toLocaleString("es-UY", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </span>

        <span>
          Margen estimado:
          <strong>
            {producto.cantidad > 0 &&
            producto.ventas / producto.cantidad > 0
              ? (
                  ((producto.ventas / producto.cantidad -
                    Number(costoSeleccionado.costo)) /
                    (producto.ventas / producto.cantidad)) *
                  100
                ).toFixed(1)
              : "0.0"}
            %
          </strong>
        </span>
      </div>
    </div>
  ) : (
    <span>Todavía no seleccionaste un costo</span>
  )}

  <button
    style={button}
    disabled={
      !producto.codigo_producto ||
      !seleccionId
    }
    onClick={() =>
      guardarProductoIndividual(producto)
    }
  >
    Guardar vinculación
  </button>
</div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div style={metricCard}>
      <strong>{title}</strong>
      <span>{value}</span>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  marginTop: 20,
  borderRadius: 16,
};

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 15,
};

const metricCard: React.CSSProperties = {
  background: "#0f172a",
  padding: 16,
  borderRadius: 12,
  border: "1px solid #334155",
  display: "grid",
  gap: 8,
};

const alerta: React.CSSProperties = {
  marginTop: 18,
  background: "#78350f",
  border: "1px solid #f59e0b",
  padding: 14,
  borderRadius: 12,
};

const mensajeStyle: React.CSSProperties = {
  marginTop: 15,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 620,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
};

const lista: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const productoCard: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 14,
  padding: 18,
};

const productoEncabezado: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "flex-start",
};

const productoNombre: React.CSSProperties = {
  fontSize: 18,
};

const datosSecundarios: React.CSSProperties = {
  marginTop: 6,
  color: "#cbd5e1",
};

const ventasBox: React.CSSProperties = {
  display: "grid",
  gap: 4,
  textAlign: "right",
};

const sugerenciaBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 14,
  marginBottom: 14,
  padding: 12,
  background: "#164e63",
  borderRadius: 10,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontWeight: 700,
};

const inputFila: React.CSSProperties = {
  width: "100%",
  padding: 11,
  borderRadius: 8,
  boxSizing: "border-box",
};

const opciones: React.CSSProperties = {
  display: "grid",
  gap: 7,
  marginTop: 10,
  maxHeight: 250,
  overflowY: "auto",
};

const opcionCosto: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #475569",
  background: "#1e293b",
  color: "white",
  cursor: "pointer",
  textAlign: "left",
};

const opcionSeleccionada: React.CSSProperties = {
  border: "2px solid #22c55e",
  background: "#14532d",
};

const acciones: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 20,
  marginTop: 16,
};

const button: React.CSSProperties = {
  padding: "10px 13px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const buttonPrincipal: React.CSSProperties = {
  padding: "11px 15px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};
const precioUnitario: React.CSSProperties = {
  fontSize: 22,
};

const sugerenciaTitulo: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
};

const sugerenciaDatos: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 18,
  marginTop: 8,
};

const comparacionCosto: React.CSSProperties = {
  display: "grid",
  gap: 10,
  flex: 1,
};

const comparacionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};