import { supabase } from "../lib/supabase";
import type { Periodo } from "../types/periodo";

const NOMBRES_MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function ordenarPeriodos(periodos: Periodo[]): Periodo[] {
  return [...periodos]
    .map((periodo) => ({
      ...periodo,
      nombre:
        NOMBRES_MESES[Number(periodo.mes) - 1]
          ? `${NOMBRES_MESES[Number(periodo.mes) - 1]} ${periodo.anio}`
          : periodo.nombre,
    }))
    .sort(
      (a, b) =>
        Number(b.anio) - Number(a.anio) ||
        Number(b.mes) - Number(a.mes)
    );
}

export async function obtenerPeriodosPorEmpresa(
  empresaId: string
): Promise<Periodo[]> {
  const { data, error } = await supabase
    .from("periodos")
    .select("*")
    .eq("empresa_id", empresaId);

  if (error) throw error;

  return ordenarPeriodos((data ?? []) as Periodo[]);
}

/*
 * Los períodos se crean con anticipación para permitir nuevas importaciones.
 * En las pantallas de análisis no queremos mostrar esos meses vacíos, por eso
 * comprobamos las fuentes reales de información de los tres tipos de negocio.
 */
export async function obtenerPeriodosConDatosPorEmpresa(
  empresaId: string
): Promise<Periodo[]> {
  const periodos = await obtenerPeriodosPorEmpresa(empresaId);

  const tablas = [
    "rentabilidad_periodo",
    "producto_ventas_resumen",
    "berlin_ventas",
    "ventas",
    "pedidosya_pedidos",
    "elaboraciones",
    "gastos_empresa",
    "importaciones",
  ];

  const consultas = await Promise.allSettled(
    tablas.map((tabla) =>
      supabase
        .from(tabla)
        .select("periodo_id")
        .eq("empresa_id", empresaId)
        .not("periodo_id", "is", null)
        .limit(5000)
    )
  );

  const idsConDatos = new Set<string>();

  for (const consulta of consultas) {
    if (consulta.status !== "fulfilled" || consulta.value.error) continue;
    for (const fila of consulta.value.data ?? []) {
      if (fila.periodo_id) idsConDatos.add(String(fila.periodo_id));
    }
  }

  // Si una política de seguridad impide consultar todas las fuentes, es mejor
  // conservar los períodos que dejar el selector vacío para ese usuario.
  if (idsConDatos.size === 0) return periodos;

  return periodos.filter((periodo) => idsConDatos.has(periodo.id));
}
