import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function LoginPage() {
  const { session, iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  async function ingresar(event: FormEvent) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await iniciarSesion(email, password);
      const destino = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(destino || "/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main style={pagina}>
      <form style={tarjeta} onSubmit={ingresar}>
        <h1 style={{ margin: 0 }}>Ragg Analytics</h1>
        <p style={{ color: "#cbd5e1" }}>Ingresá para ver la información de tu empresa.</p>
        <label>Email</label>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
        <button style={boton} disabled={enviando}>{enviando ? "Ingresando..." : "Ingresar"}</button>
      </form>
    </main>
  );
}

const pagina: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f172a", color: "white", fontFamily: "Arial" };
const tarjeta: React.CSSProperties = { width: "min(420px, calc(100% - 40px))", display: "grid", gap: 12, padding: 32, borderRadius: 18, background: "#1e293b" };
const input: React.CSSProperties = { padding: 12, borderRadius: 8, border: "1px solid #64748b" };
const boton: React.CSSProperties = { marginTop: 8, padding: 13, border: 0, borderRadius: 8, color: "white", background: "#2563eb", fontWeight: 700, cursor: "pointer" };
