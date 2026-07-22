export type Empresa = {
  id: string;
  nombre: string;
  tipo_negocio?: "heladeria" | "restaurante";
  razon_social: string | null;
  rut: string | null;
  rubro: string | null;
  activo: boolean;
  created_at: string;
};