import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RutaProtegida } from "./components/auth/RutaProtegida.tsx";
import { RutaAdmin } from "./components/auth/RutaAdmin";
import { RutaPermiso } from "./components/auth/RutaPermiso";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/Login/LoginPage";
import { DashboardPage } from "./pages/Dashboard";
import { EmpresasPage } from "./pages/Empresas";
import { ImportacionesPage } from "./pages/Importaciones";
import { ProductosPage } from "./pages/Productos";
import { CostosPage } from "./pages/Costos";
import VinculacionesPage from "./pages/Vinculaciones/VinculacionesPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RutaProtegida />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<RutaPermiso permiso="dashboard" />}>
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
              <Route element={<RutaPermiso permiso="importaciones" />}>
                <Route path="/importaciones" element={<ImportacionesPage />} />
              </Route>
              <Route element={<RutaPermiso permiso="productos" />}>
                <Route path="/productos" element={<ProductosPage />} />
              </Route>
              <Route element={<RutaPermiso permiso="costos" />}>
                <Route path="/costos" element={<CostosPage />} />
              </Route>
              <Route element={<RutaPermiso permiso="vinculaciones" />}>
                <Route path="/vinculaciones" element={<VinculacionesPage />} />
              </Route>
              <Route element={<RutaAdmin />}>
                <Route path="/empresas" element={<EmpresasPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
