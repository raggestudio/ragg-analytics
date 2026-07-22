import type { DashboardFiltro } from "../types/dashboard";

export function obtenerRango(filtro: DashboardFiltro) {

    if (filtro.modo === "personalizado") {

        return {
            desde: filtro.fechaDesde,
            hasta: filtro.fechaHasta,
            titulo:
                `${filtro.fechaDesde} al ${filtro.fechaHasta}`
        };

    }

    return {
        desde: null,
        hasta: null,
        titulo: ""
    };

}