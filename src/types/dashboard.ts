export type ModoAnalisis =
  | "mensual"
  | "trimestral"
  | "anual"
  | "personalizado";

export interface DashboardFiltro {
  empresaId: string;
  sucursalId?: string | null;

  modo: ModoAnalisis;

  periodoId?: string | null;

  fechaDesde?: string | null;
  fechaHasta?: string | null;
}