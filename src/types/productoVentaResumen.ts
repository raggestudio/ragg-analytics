export type ProductoVentaResumen = {
  id: string;
  empresa_id: string;
  importacion_id: string | null;
  fuente: string;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  categoria: string | null;
  codigo_producto: string | null;
  nombre_producto: string;
  cantidad: number;
  total: number;
  ganancia: number;
  created_at: string;
};