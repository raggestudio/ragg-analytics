export type Producto = {
  id: string;
  empresa_id: string;
  codigo: string | null;
  nombre: string;
  activo: boolean;
  created_at: string;
};