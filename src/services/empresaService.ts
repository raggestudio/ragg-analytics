import { supabase } from "../lib/supabase";
import type { Empresa } from "../types/empresa";

export async function obtenerEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function crearEmpresa(input: {
  nombre: string;
  razon_social?: string;
  rut?: string;
  rubro?: string;
}) {
  const { data, error } = await supabase
    .from("empresas")
    .insert({
      nombre: input.nombre,
      razon_social: input.razon_social || null,
      rut: input.rut || null,
      rubro: input.rubro || null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}