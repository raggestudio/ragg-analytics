import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function RutaPermiso({ permiso }: { permiso: string }) {
  const { cargando, tienePermiso } = useAuth();

  if (cargando) return <p style={{ padding: 32 }}>Cargando...</p>;
  return tienePermiso(permiso)
    ? <Outlet />
    : <Navigate to="/dashboard" replace />;
}
