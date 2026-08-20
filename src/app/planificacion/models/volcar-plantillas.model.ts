/**
 * Contrato: volcado completo de una variante importada sobre una
 * planificación mensual abierta, con modo dry-run previo.
 * Endpoint: POST /planificaciones/planificacion-mensual/:id/volcar-plantillas
 */

export interface VolcarPlantillasRequest {
  prefijoPlantillas: string;
  dryRun?: boolean;
}

export interface VolcarPlantillasResultado {
  identificador: string;
  lunes: string | null;
  creados: number;
  actualizados: number;
  omitidos: number;
  error?: string;
}

export interface VolcarPlantillasResponse {
  planificacionId: number;
  totalPlantillas: number;
  resultados: VolcarPlantillasResultado[];
  warnings: string[];
}
