import { Outlet } from "react-router-dom";
import { Header } from "../components/layouts/Header";
import { Sidebar } from "../components/layouts/Sidebar";

export function AppLayout() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: "100vh",
        display: "flex",
        overflowX: "hidden",
        background: "#0f172a",
        color: "white",
        fontFamily: "Arial",
      }}
    >
      <Sidebar />
      <main
        style={{
          flex: 1,
          width: 0,
          maxWidth: "100%",
          minWidth: 0,
          padding: 32,
          overflowX: "hidden",
        }}
      >
        <Header />
        <Outlet />
      </main>
    </div>
  );
}
