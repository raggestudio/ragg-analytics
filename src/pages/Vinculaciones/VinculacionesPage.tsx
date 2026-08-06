import { useEffect, useState } from "react";
import { obtenerEmpresas } from "../../services/empresaService";
import type { Empresa } from "../../types/empresa";
import VinculacionesHeladeria from "./VinculacionesHeladeria";
import VinculacionesRestaurante from "./VinculacionesRestaurante";
import VinculacionesBerlin from "./VinculacionesBerlin";

const BERLIN_EMPRESA_ID = "5b66d548-cf91-4262-8e65-2cfd70e9a148";

export function VinculacionesPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState(() => localStorage.getItem("vinculaciones-empresa-seleccionada") || "");
  const [tipoNegocio, setTipoNegocio] = useState<
    "heladeria" | "restaurante"
  >("heladeria");

  useEffect(() => {
    cargarEmpresas();
  }, []);

  async function cargarEmpresas() {
    const empresasData = await obtenerEmpresas();

    setEmpresas(empresasData);

    if (empresasData.length === 0) return;

    const primeraEmpresa = empresasData.find((e) => e.id === empresaId) || empresasData[0];

    setEmpresaId(primeraEmpresa.id);

    setTipoNegocio(
      primeraEmpresa.tipo_negocio === "restaurante"
        ? "restaurante"
        : "heladeria"
    );
  }

  function cambiarEmpresa(id: string) {
    localStorage.setItem("vinculaciones-empresa-seleccionada", id);
    setEmpresaId(id);

    const empresaSeleccionada = empresas.find(
      (empresa) => empresa.id === id
    );

    setTipoNegocio(
      empresaSeleccionada?.tipo_negocio === "restaurante"
        ? "restaurante"
        : "heladeria"
    );
  }

  if (!empresaId) {
    return <p>Cargando empresas...</p>;
  }

  return (
    <div>
      <section style={card}>
        <h3>Empresa</h3>

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
      </section>

      {empresaId === BERLIN_EMPRESA_ID ? (
        <VinculacionesBerlin empresaId={empresaId} />
      ) : tipoNegocio === "restaurante" ? (
        <VinculacionesRestaurante empresaId={empresaId} />
      ) : (
        <VinculacionesHeladeria empresaId={empresaId} />
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

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 520,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
};

export default VinculacionesPage;
