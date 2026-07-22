import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function RutaProtegida() {
  const { session, perfil, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <p style={{ padding: 32 }}>Cargando...</p>;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!perfil) return <p style={{ padding: 32 }}>Tu usuario todavía no tiene acceso asignado.</p>;

  return <Outlet />;
}