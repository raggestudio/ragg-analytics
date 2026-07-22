import { useAuth } from "../../contexts/AuthContext";

export function Header() {
  const { usuario, perfil, cerrarSesion } = useAuth();

  return (
    <header style={header}>
      <div>
        <p style={subtitle}>Menos carga. Más decisiones.</p>
        <small style={{ color: "#94a3b8" }}>{perfil?.nombre || usuario?.email}</small>
      </div>
      <button style={boton} onClick={() => void cerrarSesion()}>Cerrar sesión</button>
    </header>
  );
}

const header: React.CSSProperties = { marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 };
const subtitle: React.CSSProperties = { margin: 0, color: "#cbd5e1", fontSize: 16 };
const boton: React.CSSProperties = { padding: "9px 14px", borderRadius: 8, border: "1px solid #475569", background: "#1e293b", color: "white", cursor: "pointer" };