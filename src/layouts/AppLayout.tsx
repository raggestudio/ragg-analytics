import { Outlet } from "react-router-dom";
import { Header } from "../components/layouts/Header";
import { Sidebar } from "../components/layouts/Sidebar";

export function AppLayout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#0f172a", color: "white", fontFamily: "Arial" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 32 }}>
        <Header />
        <Outlet />
      </main>
    </div>
  );
}