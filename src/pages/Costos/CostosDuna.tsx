import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  actualizarCostoManual,
  obtenerCostosManualesPorEmpresa,
  type CostoProductoManual,
} from "../../services/costosManualService";

type Props = {
  empresaId: string;
  soloLectura: boolean;
};

type Edicion = {
  costo: string;
  precio_referencia: string;
};

export default function CostosDuna({ empresaId, soloLectura }: Props) {
  const [costos, setCostos] = useState<CostoProductoManual[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});

  useEffect(() => {
    void cargar();
  }, [empresaId]);

  async function cargar() {
    if (!empresaId) return;

    try {
      setCargando(true);
      setMensaje("");
      const data = await obtenerCostosManualesPorEmpresa(empresaId);
      setCostos(data);
      setEdiciones(
        Object.fromEntries(
          data.map((item) => [
            item.id,
            {
              costo: String(Number(item.costo || 0)),
              precio_referencia:
                item.precio_referencia === null
                  ? ""
                  : String(Number(item.precio_referencia)),
            },
          ])
        )
      );
    } catch (error: any) {
      console.error(error);
      setMensaje(error?.message || "No se pudieron cargar los costos de Duna.");
    } finally {
      setCargando(false);
    }
  }

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return costos;

    return costos.filter((item) =>
      [item.nombre_producto, item.codigo_producto, item.origen]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto))
    );
  }, [costos, busqueda]);

  async function guardar(item: CostoProductoManual) {
    if (soloLectura) return;

    const edicion = ediciones[item.id];
    if (!edicion) return;

    const costo = Number(edicion.costo.replace(",", "."));
    const precioTexto = edicion.precio_referencia.trim();
    const precioReferencia =
      precioTexto === "" ? null : Number(precioTexto.replace(",", "."));

    if (!Number.isFinite(costo) || costo < 0) {
      setMensaje(`Costo inválido para ${item.nombre_producto}.`);
      return;
    }

    if (
      precioReferencia !== null &&
      (!Number.isFinite(precioReferencia) || precioReferencia < 0)
    ) {
      setMensaje(`Precio de referencia inválido para ${item.nombre_producto}.`);
      return;
    }

    try {
      setGuardandoId(item.id);
      setMensaje("");

      const actualizado = await actualizarCostoManual({
        id: item.id,
        empresa_id: empresaId,
        costo,
        precio_referencia: precioReferencia,
      });

      setCostos((actuales) =>
        actuales.map((fila) => (fila.id === item.id ? actualizado : fila))
      );
      setMensaje(`Guardado: ${item.nombre_producto}.`);
    } catch (error: any) {
      console.error(error);
      setMensaje(error?.message || "No se pudo guardar el costo.");
    } finally {
      setGuardandoId(null);
    }
  }

  function descargarExcel() {
    const filas = costos.map((item) => ({
      Producto: item.nombre_producto,
      Código: item.codigo_producto || "",
      "Costo unitario": Number(item.costo || 0),
      "Precio de referencia": item.precio_referencia ?? "",
      Origen: item.origen || "",
      Estimado: item.estimado ? "Sí" : "No",
      "Última actualización": item.updated_at
        ? new Date(item.updated_at).toLocaleString("es-UY")
        : "",
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Costos Duna");
    XLSX.writeFile(libro, "Costos_Duna_Ragg.xlsx");
  }

  return (
    <section style={card}>
      <div style={headerRow}>
        <div>
          <h3 style={{ margin: 0 }}>Costos por producto</h3>
          <p style={subtle}>
            {costos.length} productos cargados desde la planilla de Duna.
          </p>
        </div>
        <button type="button" style={button} onClick={descargarExcel}>
          Descargar Excel
        </button>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar producto..."
        style={searchInput}
      />

      {mensaje && <p style={message}>{mensaje}</p>}
      {cargando ? (
        <p>Cargando costos...</p>
      ) : filtrados.length === 0 ? (
        <p>No hay costos para mostrar.</p>
      ) : (
        <div style={tableScroll}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Producto</th>
                <th style={th}>Código</th>
                <th style={th}>Costo unitario</th>
                <th style={th}>Precio de referencia</th>
                <th style={th}>Origen</th>
                <th style={th}>Estimado</th>
                <th style={th}>Última actualización</th>
                {!soloLectura && <th style={th}>Acción</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((item) => {
                const edicion = ediciones[item.id] || {
                  costo: String(item.costo || 0),
                  precio_referencia:
                    item.precio_referencia === null
                      ? ""
                      : String(item.precio_referencia),
                };

                return (
                  <tr key={item.id}>
                    <td style={tdStrong}>{item.nombre_producto}</td>
                    <td style={td}>{item.codigo_producto || "—"}</td>
                    <td style={td}>
                      {soloLectura ? (
                        moneda(item.costo)
                      ) : (
                        <input
                          style={numberInput}
                          inputMode="decimal"
                          value={edicion.costo}
                          onChange={(e) =>
                            setEdiciones((actuales) => ({
                              ...actuales,
                              [item.id]: {
                                ...edicion,
                                costo: e.target.value,
                              },
                            }))
                          }
                        />
                      )}
                    </td>
                    <td style={td}>
                      {soloLectura ? (
                        item.precio_referencia === null
                          ? "—"
                          : moneda(item.precio_referencia)
                      ) : (
                        <input
                          style={numberInput}
                          inputMode="decimal"
                          value={edicion.precio_referencia}
                          onChange={(e) =>
                            setEdiciones((actuales) => ({
                              ...actuales,
                              [item.id]: {
                                ...edicion,
                                precio_referencia: e.target.value,
                              },
                            }))
                          }
                        />
                      )}
                    </td>
                    <td style={td}>{formatearOrigen(item.origen)}</td>
                    <td style={td}>{item.estimado ? "Sí" : "No"}</td>
                    <td style={td}>
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleString("es-UY")
                        : "—"}
                    </td>
                    {!soloLectura && (
                      <td style={td}>
                        <button
                          type="button"
                          style={smallButton}
                          disabled={guardandoId === item.id}
                          onClick={() => guardar(item)}
                        >
                          {guardandoId === item.id ? "Guardando..." : "Guardar"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function moneda(valor: number) {
  return `$${Number(valor || 0).toLocaleString("es-UY", {
    maximumFractionDigits: 2,
  })}`;
}

function formatearOrigen(origen: string) {
  if (origen === "excel_duna") return "Excel Duna";
  if (origen === "excel_berlin") return "Excel Berlín";
  return origen || "—";
}

const card: React.CSSProperties = {
  background: "#1e293b",
  padding: 24,
  marginTop: 20,
  borderRadius: 16,
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap",
};

const subtle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#cbd5e1",
  fontSize: 14,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  marginTop: 18,
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #475569",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
};

const tableScroll: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};

const table: React.CSSProperties = {
  width: "100%",
  minWidth: 1050,
  borderCollapse: "collapse",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #475569",
  whiteSpace: "nowrap",
  color: "#cbd5e1",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: "11px 10px",
  borderBottom: "1px solid #334155",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const tdStrong: React.CSSProperties = {
  ...td,
  fontWeight: 600,
  whiteSpace: "normal",
  minWidth: 230,
};

const numberInput: React.CSSProperties = {
  width: 115,
  padding: "8px 9px",
  borderRadius: 7,
  border: "1px solid #64748b",
  boxSizing: "border-box",
};

const button: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #475569",
  cursor: "pointer",
  fontWeight: 600,
};

const smallButton: React.CSSProperties = {
  ...button,
  padding: "8px 11px",
};

const message: React.CSSProperties = {
  color: "#cbd5e1",
  margin: "8px 0 14px",
};
