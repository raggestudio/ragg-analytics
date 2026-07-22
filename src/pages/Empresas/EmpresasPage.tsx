import { useEffect, useState } from "react";
import { crearEmpresa, obtenerEmpresas } from "../../services/empresaService";
import type { Empresa } from "../../types/empresa";

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    cargarEmpresas();
  }, []);

  async function cargarEmpresas() {
    const data = await obtenerEmpresas();
    setEmpresas(data);
  }

  async function guardarEmpresa() {
    if (!nombre.trim()) {
      alert("Ingresá el nombre");
      return;
    }

    await crearEmpresa({ nombre });
    setNombre("");
    await cargarEmpresas();
  }

  return (
    <div>
      <h2>Empresas</h2>

      <section style={card}>
        <h3>Nueva empresa</h3>

        <input
          style={input}
          placeholder="Nombre de empresa"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <button style={button} onClick={guardarEmpresa}>
          Guardar empresa
        </button>
      </section>

      <section style={card}>
        <h3>Empresas registradas</h3>

        {empresas.map((empresa) => (
          <div key={empresa.id} style={empresaItem}>
            {empresa.nombre}
          </div>
        ))}
      </section>
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
  maxWidth: 420,
  padding: 12,
  marginBottom: 12,
  borderRadius: 8,
};

const button: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  cursor: "pointer",
};

const empresaItem: React.CSSProperties = {
  padding: "12px 0",
  borderBottom: "1px solid #334155",
};