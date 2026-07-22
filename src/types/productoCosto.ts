export type TipoCalculoCosto = "receta" | "promedio" | "estimado";

export type ProductoCosto = {
  id: string;
  empresa_id: string;
  nombre_producto: string;
  tipo_calculo: TipoCalculoCosto;
  receta_id: string | null;
  factor: number | null;
  observaciones: string | null;
};