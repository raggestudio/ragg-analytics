export interface DashboardComparativo {

  actual: number;

  anterior: number;

  diferencia: number;

  porcentaje: number;

}

export function compararValores(
  actual: number,
  anterior: number
): DashboardComparativo {

  const diferencia = actual - anterior;

  const porcentaje =
    anterior === 0
      ? 0
      : (diferencia / anterior) * 100;

  return {
    actual,
    anterior,
    diferencia,
    porcentaje,
  };
}