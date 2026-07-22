export type Insumo = {
  id: string;
  empresa_id: string;
  nombre: string;
  unidad: string | null;
  precio: number;
  observaciones: string | null;
  origen: string | null;
  activo: boolean;
};

export type Receta = {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria: string | null;
  rendimiento: number | null;
  costo_total: number | null;
  costo_kg: number | null;
  origen: string | null;
  activo: boolean;
};

export type RecetaDetalle = {
  receta_id: string;
  insumo_id: string | null;
  seccion: string | null;
  insumo_receta: string | null;
  cantidad: number;
  precio_unitario: number;
  costo: number;
  nota: string | null;
};