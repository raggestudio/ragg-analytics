export type Importacion = {
  id: string;
  empresa_id: string;
  archivo_nombre: string | null;
  tipo: string | null;
  estado: string | null;
  registros_importados: number | null;
  errores: number | null;
  created_at: string;
};