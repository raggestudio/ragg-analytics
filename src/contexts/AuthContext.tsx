import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type RolUsuario = "admin" | "cliente";

type Perfil = {
  usuario_id: string;
  nombre: string | null;
  rol: RolUsuario;
};

type AuthContextValue = {
  session: Session | null;
  usuario: User | null;
  perfil: Perfil | null;
  cargando: boolean;
  esAdmin: boolean;
  soloLectura: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(sesion: Session | null) {
      if (!activo) return;
      setSession(sesion);

      if (!sesion) {
        setPerfil(null);
        setCargando(false);
        return;
      }

      const { data, error } = await supabase
        .from("perfiles")
        .select("usuario_id, nombre, rol")
        .eq("usuario_id", sesion.user.id)
        .single();

      if (!activo) return;

      if (error) {
        console.error("No se pudo cargar el perfil:", error.message);
        setPerfil(null);
      } else {
        setPerfil(data as Perfil);
      }

      setCargando(false);
    }

    supabase.auth.getSession().then(({ data }) => cargarPerfil(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nueva) => {
      setCargando(true);
      void cargarPerfil(nueva);
    });

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      usuario: session?.user ?? null,
      perfil,
      cargando,
      esAdmin: perfil?.rol === "admin",
      soloLectura: perfil?.rol !== "admin",
      async iniciarSesion(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      },
      async cerrarSesion() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, perfil, cargando]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return contexto;
}
