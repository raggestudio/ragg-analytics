export type Periodo = {
  id: string;
  empresa_id: string;
  anio: number;
  mes: number;
  nombre: string;
  estado: "abierto" | "revision" | "cerrado";
};