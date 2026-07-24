export type Importacion = {
  id: string;
  empresa_id: string;
  sucursal_id?: string | null;
  periodo_id?: string | null;
  archivo_nombre: string | null;
  tipo: string | null;
  turno?: "general" | "mediodia" | "noche";
  estado: string | null;
  registros_importados: number | null;
  errores: number | null;
  created_at: string;
};
