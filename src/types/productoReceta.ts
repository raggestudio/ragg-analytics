export type ProductoReceta = {
  id: string;
  empresa_id: string;
  nombre_producto: string;
  categoria_producto: string | null;
  receta_id: string | null;
};