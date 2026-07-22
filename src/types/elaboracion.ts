export type Elaboracion = {
  id: string;
  empresa_id: string;
  receta_id: string | null;
  fecha: string;
  producto_original: string | null;
  kilos: number;
  responsable: string | null;
  archivo_nombre: string | null;
  periodo_anio: number | null;
  periodo_mes: number | null;
};