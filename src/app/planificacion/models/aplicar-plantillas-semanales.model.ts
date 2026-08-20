/**
 * Contrato Fase 2: insertado automático semanal→total con preview.
 * Endpoint: POST /planificaciones/aplicar-plantillas-semanales
 */

export interface AplicarPlantillaSemanalItem {
  planificacionId: number;
  plantillaSemanalId: number;
}

export interface PreviewBloque {
  nombre: string;
  horaInicio: string;
  duracion: number;
  importante?: boolean;
  color?: string;
  estado?: 'creado' | 'actualizado' | 'omitido';
}

export interface ResultadoAplicarPlantillaSemanal {
  planificacionId: number;
  plantillaSemanalId: number;
  creados: number;
  actualizados: number;
  omitidos: number;
  bloques: PreviewBloque[];
  error?: string;
}

export interface AplicarPlantillasSemanalesRequest {
  lunes: string;
  items: AplicarPlantillaSemanalItem[];
  preview?: boolean;
}

export interface AplicarPlantillasSemanalesResponse {
  resultados: ResultadoAplicarPlantillaSemanal[];
}
