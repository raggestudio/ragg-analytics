import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  actualizarCostoManual,
  obtenerCostosManualesPorEmpresa,
  importarCostosManualesDuna,
  type CostoProductoManual,
} from "../../services/costosManualService";
import { parsearExcelCostosDuna } from "../../services/excelCostosDunaParser";

export default function CostosBerlin({ empresaId, soloLectura = false }: { empresaId: string; soloLectura?: boolean }) {
  const [costos, setCostos] = useState<CostoProductoManual[]>([]);
  const [buscar, setBuscar] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [costosEditados, setCostosEditados] = useState<Record<string, string>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  async function cargar() {
    setCostos(await obtenerCostosManualesPorEmpresa(empresaId));
  }

  useEffect(() => {
    cargar().catch((error) => setMensaje(error?.message || "No se pudieron cargar los costos."));
  }, [empresaId]);

  async function subirExcel(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      const archivo = event.target.files?.[0];
      if (!archivo) return;
      setMensaje("Importando costos de Berlín...");
      const data = await parsearExcelCostosDuna(archivo);
      const resultado = await importarCostosManualesDuna({
        empresa_id: empresaId,
        data,
        origen: "excel_berlin",
      });
      await cargar();
      setMensaje(`Costos importados correctamente: ${resultado.importados} productos.`);
      event.target.value = "";
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo importar el Excel de costos.");
    }
  }

  function valorEditable(costo: CostoProductoManual) {
    return costosEditados[costo.id] ?? String(costo.costo);
  }

  async function guardarCosto(costo: CostoProductoManual) {
    try {
      const valor = Number(valorEditable(costo).replace(",", "."));
      setGuardandoId(costo.id);
      setMensaje("");

      const actualizado = await actualizarCostoManual({
        id: costo.id,
        empresa_id: empresaId,
        costo: valor,
      });

      setCostos((actuales) =>
        actuales.map((item) => item.id === costo.id ? actualizado : item)
      );
      setCostosEditados((actuales) => {
        const siguientes = { ...actuales };
        delete siguientes[costo.id];
        return siguientes;
      });
      setMensaje(`${costo.nombre_producto}: costo actualizado correctamente.`);
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo actualizar el costo.");
    } finally {
      setGuardandoId(null);
    }
  }

  function descargarExcel() {
    const filas = costos.map((costo) => ({
      Producto: costo.nombre_producto,
      Código: costo.codigo_producto || "",
      "Costo unitario": Number(costo.costo || 0),
      "Precio de referencia": costo.precio_referencia === null
        ? ""
        : Number(costo.precio_referencia),
      Origen: costo.origen === "excel_berlin" ? "Excel Berlín" : costo.origen,
      "Última actualización": costo.updated_at
        ? new Date(costo.updated_at).toLocaleString("es-UY")
        : "",
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja["!cols"] = [
      { wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 20 },
      { wch: 18 }, { wch: 22 },
    ];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Costos Berlín");
    XLSX.writeFile(libro, `Costos_Berlin_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const visibles = useMemo(() => costos.filter((costo) =>
    costo.nombre_producto.toLowerCase().includes(buscar.toLowerCase())
  ), [costos, buscar]);

  return <div>
    <section style={card}>
      <h3>Costos de productos · Berlín</h3>
      <p>Estos costos se vinculan con los productos vendidos de InfoClub y del histórico interno.</p>
      {!soloLectura && <input type="file" accept=".xlsx,.xls,.xltx" onChange={subirExcel} />}
      {mensaje && <p>{mensaje}</p>}
    </section>

    <section style={card}>
      <div style={summary}>
        <strong>Productos costeados: {costos.length}</strong>
        <strong>Origen: Excel de costos Berlín</strong>
        <button type="button" style={button} onClick={descargarExcel} disabled={costos.length === 0}>
          Descargar Excel
        </button>
      </div>
      <input style={input} placeholder="Buscar producto costeado..." value={buscar}
        onChange={(event) => setBuscar(event.target.value)} />
      {visibles.length === 0 ? <p>No hay productos costeados para mostrar.</p> : visibles.map((costo) =>
        <div key={costo.id} style={row}>
          <strong>{costo.nombre_producto}</strong>
          <label style={costEditor}>
            <span>Costo unitario</span>
            <input
              style={costInput}
              type="text"
              inputMode="decimal"
              value={valorEditable(costo)}
              onChange={(event) => setCostosEditados((actuales) => ({
                ...actuales,
                [costo.id]: event.target.value,
              }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void guardarCosto(costo);
              }}
            />
          </label>
          <span>{costo.precio_referencia === null ? "Sin precio de referencia" :
            `Precio de referencia: $${Number(costo.precio_referencia).toLocaleString("es-UY", { maximumFractionDigits: 2 })}`}</span>
          <button
            type="button"
            style={button}
            disabled={guardandoId === costo.id || costosEditados[costo.id] === undefined}
            onClick={() => void guardarCosto(costo)}
          >
            {guardandoId === costo.id ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </section>
  </div>;
}

const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 20, borderRadius: 16 };
const summary: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 8 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(150px, 1fr) minmax(190px, 1fr) auto", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #334155" };
const costEditor: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const costInput: React.CSSProperties = { width: 100, padding: 8, borderRadius: 7, border: "1px solid #64748b" };
const button: React.CSSProperties = { background: "#2563eb", color: "white", border: 0, padding: "9px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600 };
