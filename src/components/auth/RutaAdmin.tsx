import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function RutaAdmin() {
  const { esAdmin, cargando } = useAuth();
  if (cargando) return <p style={{ padding: 32 }}>Cargando...</p>;
  return esAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}