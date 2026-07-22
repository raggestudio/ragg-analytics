import { useEffect, useState } from "react";
import { obtenerEmpresas } from "../../services/empresaService";
import type { Empresa } from "../../types/empresa";
import parsearExcelCostos from "../../services/excelCostosParser";
import {
  importarCostosExcel,
  obtenerInsumosPorEmpresa,
  obtenerRecetasPorEmpresa,
} from "../../services/costosService";
import type { Insumo, Receta } from "../../types/costos";
export function CostosPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [busquedaReceta, setBusquedaReceta] = useState("");
  const [busquedaInsumo, setBusquedaInsumo] = useState("");

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    const empresasData = await obtenerEmpresas();
    setEmpresas(empresasData);

    if (empresasData.length > 0) {
      setEmpresaId(empresasData[0].id);
      await cargarDatos(empresasData[0].id);
    }
  }

  async function cargarDatos(id: string) {
    setInsumos(await obtenerInsumosPorEmpresa(id));
    setRecetas(await obtenerRecetasPorEmpresa(id));
  }

  async function cambiarEmpresa(id: string) {
    setEmpresaId(id);
    await cargarDatos(id);
  }

  async function subirExcel(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const archivo = e.target.files?.[0];
      if (!archivo || !empresaId) return;

      setMensaje("Leyendo Excel de costos...");

      const data = await parsearExcelCostos(archivo);

      setMensaje(
        `Detectado: ${data.insumos.length} insumos, ${data.recetas.length} recetas, ${data.detalles.length} detalles. Importando...`
      );

      const resultado = await importarCostosExcel({
        empresa_id: empresaId,
        data,
      });

      await cargarDatos(empresaId);

      setMensaje(
        `Costos importados correctamente. Insumos: ${resultado.insumos}. Recetas: ${resultado.recetas}. Detalles: ${resultado.detalles}.`
      );
    } catch (error: any) {
  console.error(error);
  console.log(JSON.stringify(error, null, 2));

  setMensaje(error?.message || "Error importando Excel");
}
  }

  const costoPromedio =
    recetas.length > 0
      ? recetas.reduce((acc, r) => acc + Number(r.costo_kg || 0), 0) / recetas.length
      : 0;
  const recetasFiltradas = recetas.filter((receta) =>
  String(receta.nombre || "")
    .toLowerCase()
    .includes(busquedaReceta.toLowerCase())
);

  const insumosFiltrados = insumos.filter((insumo) =>
  String(insumo.nombre || "")
    .toLowerCase()
    .includes(busquedaInsumo.toLowerCase())
);
  return (
    <div>
      <h2>Costos</h2>

      <section style={card}>
        <h3>Importar Excel de costos</h3>

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

        <input
          style={input}
          type="file"
          accept=".xlsx,.xls"
          onChange={subirExcel}
        />

        {mensaje && <p>{mensaje}</p>}
      </section>

      <section style={card}>
        <h3>Resumen</h3>

        <div style={metricGrid}>
          <Metric title="Insumos" value={insumos.length} />
          <Metric title="Recetas" value={recetas.length} />
          <Metric
            title="Costo promedio/kg"
            value={`$${Math.round(costoPromedio).toLocaleString("es-UY")}`}
          />
        </div>
      </section>

      <section style={card}>
        <h3>Recetas</h3>
        <input
  type="text"
  value={busquedaReceta}
  onChange={(e) => setBusquedaReceta(e.target.value)}
  placeholder="Buscar receta..."
  style={searchInput}
/>

<p style={resultText}>
  Mostrando {recetasFiltradas.length} de {recetas.length} recetas
</p>

        {recetasFiltradas.length === 0 ? (
  <p>No hay recetas para mostrar.</p>
) : (
  recetasFiltradas.map((receta) => (
    <div key={receta.id} style={row}>
      <strong>{receta.nombre}</strong>
      <span>
        Costo/kg: $
        {Number(receta.costo_kg || 0).toLocaleString("es-UY")}
      </span>
      <span>Rendimiento: {receta.rendimiento || "-"}</span>
    </div>
  ))
)}
      </section>

      <section style={card}>
        <h3>Insumos</h3>
        <input
  type="text"
  value={busquedaInsumo}
  onChange={(e) => setBusquedaInsumo(e.target.value)}
  placeholder="Buscar insumo..."
  style={searchInput}
/>

<p style={resultText}>
  Mostrando {insumosFiltrados.length} de {insumos.length} insumos
</p>

{insumosFiltrados.length === 0 ? (
  <p>No hay insumos para mostrar.</p>
) : (
  insumosFiltrados.map((insumo) => (
    <div key={insumo.id} style={row}>
      <strong>{insumo.nombre}</strong>

      <span>
        Precio: $
        {Number(insumo.precio || 0).toLocaleString("es-UY")}
      </span>

      <span>{insumo.observaciones || ""}</span>
    </div>
  ))
)}
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
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

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 520,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
};

const metricGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
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

const row: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 0",
  borderBottom: "1px solid #334155",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  marginBottom: 8,
  borderRadius: 8,
  border: "1px solid #475569",
  background: "#ffffff",
  color: "#111827",
  fontSize: 15,
};

const resultText: React.CSSProperties = {
  margin: "0 0 18px",
  color: "#cbd5e1",
  fontSize: 14,
  textAlign: "center",
};
export default CostosPage;