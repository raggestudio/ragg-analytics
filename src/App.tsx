import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RutaProtegida } from "./components/auth/RutaProtegida.tsx";
import { RutaAdmin } from "./components/auth/RutaAdmin";
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
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/importaciones" element={<ImportacionesPage />} />
              <Route path="/productos" element={<ProductosPage />} />
              <Route path="/costos" element={<CostosPage />} />
              <Route path="/vinculaciones" element={<VinculacionesPage />} />
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