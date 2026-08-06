import { useEffect, useMemo, useState } from "react";
import { obtenerCostosManualesPorEmpresa, importarCostosManualesDuna, type CostoProductoManual } from "../../services/costosManualService";
import { parsearExcelCostosDuna } from "../../services/excelCostosDunaParser";

export default function CostosBerlin({ empresaId, soloLectura = false }: { empresaId: string; soloLectura?: boolean }) {
  const [costos, setCostos] = useState<CostoProductoManual[]>([]);
  const [buscar, setBuscar] = useState("");
  const [mensaje, setMensaje] = useState("");

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
      const resultado = await importarCostosManualesDuna({ empresa_id: empresaId, data });
      await cargar();
      setMensaje(`Costos importados correctamente: ${resultado.importados} productos.`);
      event.target.value = "";
    } catch (error: any) {
      setMensaje(error?.message || "No se pudo importar el Excel de costos.");
    }
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
      </div>
      <input style={input} placeholder="Buscar producto costeado..." value={buscar}
        onChange={(event) => setBuscar(event.target.value)} />
      {visibles.length === 0 ? <p>No hay productos costeados para mostrar.</p> : visibles.map((costo) =>
        <div key={costo.id} style={row}>
          <strong>{costo.nombre_producto}</strong>
          <span>Costo unitario: ${Number(costo.costo).toLocaleString("es-UY", { maximumFractionDigits: 2 })}</span>
          <span>{costo.precio_referencia === null ? "Sin precio de referencia" :
            `Precio de referencia: $${Number(costo.precio_referencia).toLocaleString("es-UY", { maximumFractionDigits: 2 })}`}</span>
        </div>
      )}
    </section>
  </div>;
}

const card: React.CSSProperties = { background: "#1e293b", padding: 24, marginTop: 20, borderRadius: 16 };
const summary: React.CSSProperties = { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: 11, borderRadius: 8 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, padding: "12px 0", borderBottom: "1px solid #334155" };
