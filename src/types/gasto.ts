export type GastoEmpresa = {
  id: string;
  empresa_id: string;
  periodo_id: string;
  categoria: string;
  detalle: string | null;
  monto: number;
  fecha: string | null;
  observaciones: string | null;
  origen: string;
  referencia: string | null;
  created_at: string;
  updated_at: string;
};

export type GastoEmpresaInput = {
  empresa_id: string;
  periodo_id: string;
  categoria: string;
  detalle?: string | null;
  monto: number;
  fecha?: string | null;
  observaciones?: string | null;
  origen?: string;
  referencia?: string | null;
};

export type SueldoGastoImportado = {
  periodo_anio: number;
  periodo_mes: number;
  liquidacion: string;
  nombre: string;
  ci: string;
  haberes: number;
  descuentos: number;
  liquido: number;
  costo: number;
};
