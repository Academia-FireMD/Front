/**
 * Contrato: volcado completo de una variante importada sobre una
 * planificación mensual abierta, con modo dry-run previo.
 * Endpoint: POST /planificaciones/planificacion-mensual/:id/volcar-plantillas
 */

export interface VolcarPlantillasRequest {
  prefijoPlantillas: string;
  dryRun?: boolean;
  previewHash?: string;
}

export interface VolcarPlantillasResultado {
  identificador: string;
  lunes: string | null;
  creados: number;
  actualizados: number;
  omitidos: number;
  eliminados?: number;
  error?: string;
}

export interface VolcarPlantillasResponse {
  planificacionId: number;
  totalPlantillas: number;
  resultados: VolcarPlantillasResultado[];
  warnings: string[];
  previewHash: string;
  /** Rango civil afectado, calculado por el servidor en Europe/Madrid. */
  rangoFechas: { desde: string; hasta: string } | null;
}
