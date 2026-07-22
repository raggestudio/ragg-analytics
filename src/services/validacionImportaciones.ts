import type { ElaboracionExcel } from "./excelProduccionParser";

export type PeriodoSeleccionado = {
  id: string;
  anio: number;
  mes: number;
  nombre: string;
};

function fechaDesdeTexto(valor: string): Date | null {
  if (!valor) return null;

  const limpio = String(valor).trim();

  let match = limpio.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = limpio.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})/);

  if (match) {
    const dia = Number(match[1]);
    const mes = Number(match[2]);
    const anioRaw = match[3];
    const anio = Number(anioRaw.length === 2 ? `20${anioRaw}` : anioRaw);

    return new Date(anio, mes - 1, dia);
  }

  return null;
}

function fechaDesdeIso(valor: string | null): Date | null {
  if (!valor) return null;

  const match = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function coincidePeriodo(fecha: Date, periodo: PeriodoSeleccionado) {
  return (
    fecha.getFullYear() === Number(periodo.anio) &&
    fecha.getMonth() + 1 === Number(periodo.mes)
  );
}

function obtenerValorFecha(fila: Record<string, string>) {
  return (
    fila["Fecha"] ||
    fila["fecha"] ||
    fila["Date"] ||
    fila["date"] ||
    fila["Día"] ||
    fila["Dia"] ||
    ""
  );
}

export function validarPedidoYaPeriodo(
  filas: Record<string, string>[],
  periodo: PeriodoSeleccionado
) {
  const fechas = filas
    .map((fila) => fechaDesdeTexto(obtenerValorFecha(fila)))
    .filter((fecha): fecha is Date => Boolean(fecha));

  if (fechas.length === 0) {
    throw new Error("No se pudieron leer fechas válidas en el CSV de PedidosYa.");
  }

  const fechasFuera = fechas.filter((fecha) => !coincidePeriodo(fecha, periodo));

  if (fechasFuera.length > 0) {
    const primera = fechasFuera[0];

    throw new Error(
      `El CSV de PedidosYa contiene fechas de ${primera.toLocaleDateString(
        "es-UY"
      )}, pero seleccionaste ${periodo.nombre}.`
    );
  }
}

export function validarIsatechPeriodo(input: {
  periodo_inicio: string | null;
  periodo_fin: string | null;
  periodo: PeriodoSeleccionado;
}) {
  const inicio = fechaDesdeIso(input.periodo_inicio);
  const fin = fechaDesdeIso(input.periodo_fin);

  if (!inicio || !fin) {
    throw new Error("No se pudo detectar el período del PDF de Isatech.");
  }

  if (!coincidePeriodo(inicio, input.periodo) || !coincidePeriodo(fin, input.periodo)) {
    throw new Error(
      `El PDF de Isatech corresponde a ${inicio.toLocaleDateString(
        "es-UY"
      )} - ${fin.toLocaleDateString("es-UY")}, pero seleccionaste ${
        input.periodo.nombre
      }.`
    );
  }
}

export function filtrarProduccionPorPeriodo(
  elaboraciones: ElaboracionExcel[],
  periodo: PeriodoSeleccionado
) {
  return elaboraciones.filter(
    (item) =>
      Number(item.periodo_anio) === Number(periodo.anio) &&
      Number(item.periodo_mes) === Number(periodo.mes)
  );
}