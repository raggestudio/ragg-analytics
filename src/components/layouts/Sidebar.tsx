import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function Sidebar() {
  const { esAdmin, soloLectura } = useAuth();

  return (
    <aside style={sidebar}>
      <h2 style={{ marginBottom: 8 }}>Ragg Analytics</h2>
      {soloLectura && <p style={modo}>Acceso de consulta</p>}
      <MenuItem to="/dashboard">Dashboard</MenuItem>
      {esAdmin && <MenuItem to="/empresas">Empresas</MenuItem>}
      <MenuItem to="/importaciones">Importaciones</MenuItem>
      <MenuItem to="/productos">Productos</MenuItem>
      <MenuItem to="/costos">Costos</MenuItem>
      <MenuItem to="/vinculaciones">Vinculaciones</MenuItem>
    </aside>
  );
}

function MenuItem({ to, children }: { to: string; children: React.ReactNode }) {
  return <NavLink to={to} style={({ isActive }) => ({ display: "block", padding: 16, marginBottom: 10, borderRadius: 12, textDecoration: "none", textAlign: "center", color: "white", fontWeight: 600, background: isActive ? "#2563eb" : "transparent" })}>{children}</NavLink>;
}

const sidebar: React.CSSProperties = { width: 260, minHeight: "100vh", background: "#020617", padding: 24, color: "white" };
const modo: React.CSSProperties = { margin: "0 0 24px", color: "#93c5fd", fontSize: 13 };