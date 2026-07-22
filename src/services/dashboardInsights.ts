import type { DashboardResumen } from "./dashboardService";

export type DashboardInsights = {
  positivas: string[];
  atencion: string[];
  acciones: string[];
};

export function generarInsights(
  actual: DashboardResumen,
  anterior: DashboardResumen | null
): DashboardInsights {
  const positivas: string[] = [];
  const atencion: string[] = [];
  const acciones: string[] = [];

  if (anterior) {
    const crecimientoVentas =
      anterior.ventas_totales > 0
        ? ((actual.ventas_totales - anterior.ventas_totales) /
            anterior.ventas_totales) * 100
        : 0;

    if (crecimientoVentas >= 10) {
      positivas.push(
        `La facturación aumentó ${crecimientoVentas.toFixed(1)}% respecto al período comparado.`
      );
    } else if (crecimientoVentas <= -10) {
      atencion.push(
        `La facturación cayó ${Math.abs(crecimientoVentas).toFixed(1)}% respecto al período comparado.`
      );
    }

    const diferenciaMargen =
      actual.margen_porcentaje - anterior.margen_porcentaje;

    if (diferenciaMargen >= 2) {
      positivas.push(
        `El margen mejoró ${diferenciaMargen.toFixed(1)} puntos porcentuales.`
      );
    } else if (diferenciaMargen <= -2) {
      atencion.push(
        `El margen disminuyó ${Math.abs(diferenciaMargen).toFixed(1)} puntos porcentuales.`
      );
    }

    if (!actual.es_restaurante && anterior.costo_promedio_kg > 0) {
      const aumentoCostoKg =
        ((actual.costo_promedio_kg - anterior.costo_promedio_kg) /
          anterior.costo_promedio_kg) * 100;

      if (aumentoCostoKg >= 8) {
        atencion.push(
          `El costo promedio por kilogramo aumentó ${aumentoCostoKg.toFixed(1)}%.`
        );
        acciones.push("Revisar materias primas y costos de producción.");
      }
    }
  } else {
    positivas.push(
      `El período registra una facturación de $${Math.round(
        actual.ventas_totales
      ).toLocaleString("es-UY")} y un margen de ${actual.margen_porcentaje.toFixed(1)}%.`
    );

    if (actual.es_restaurante && actual.ventas_pedidosya > 0) {
      positivas.push(
        `PedidosYa generó una ganancia neta de $${Math.round(
          actual.margen_pedidosya
        ).toLocaleString("es-UY")} después de productos y comisión.`
      );
    }
  }

  if (actual.margen_porcentaje >= 60) {
    positivas.push(
      `El margen general del negocio es ${actual.margen_porcentaje.toFixed(1)}%.`
    );
  } else if (actual.margen_porcentaje > 0 && actual.margen_porcentaje < 50) {
    atencion.push(
      `El margen general es ${actual.margen_porcentaje.toFixed(1)}%, por debajo del nivel recomendado.`
    );
    acciones.push("Analizar los productos con menor margen.");
  }

  if (actual.es_restaurante && actual.ventas_pedidosya > 0) {
    const porcentajeComision =
      (actual.costos_canal / actual.ventas_pedidosya) * 100;

    if (actual.margen_porcentaje_pedidosya >= 45) {
      positivas.push(
        `El margen neto de PedidosYa es ${actual.margen_porcentaje_pedidosya.toFixed(1)}%.`
      );
    } else {
      atencion.push(
        `El margen neto de PedidosYa es ${actual.margen_porcentaje_pedidosya.toFixed(1)}%.`
      );
      acciones.push("Revisar precios y costos de los productos vendidos por PedidosYa.");
    }

    if (porcentajeComision >= 20) {
      atencion.push(
        `La comisión y cargos de PedidosYa equivalen al ${porcentajeComision.toFixed(1)}% de sus ventas.`
      );
    }

    if (actual.participacion_pedidosya >= 40) {
      atencion.push(
        `PedidosYa representa el ${actual.participacion_pedidosya.toFixed(1)}% de la facturación.`
      );
      acciones.push("Monitorear mensualmente la rentabilidad específica de PedidosYa.");
    }
  }

  if (!actual.es_restaurante && actual.kilos_producidos > 0) {
    positivas.push(
      `Se produjeron ${Number(actual.kilos_producidos).toLocaleString("es-UY")} kg durante el período.`
    );
  }

  if (actual.productos_sin_revisar > 0) {
    atencion.push(
      `Hay ${actual.productos_sin_revisar} productos pendientes de revisión de costos.`
    );
    acciones.push("Completar la configuración de costos pendientes.");
  }

  if (atencion.length === 0) {
    atencion.push("No se detectaron alertas importantes en este período.");
  }

  if (acciones.length === 0) {
    acciones.push("Mantener el seguimiento mensual de ventas, costos y margen.");
  }

  return { positivas, atencion, acciones };
}