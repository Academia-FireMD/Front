import type { NivelOposicion } from '../../shared/models/pregunta.model';
import type { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';

/**
 * Estado de la configuración de planificación del alumno (contrato Fase 1
 * autoasignación, backend en paralelo). Espejo de
 * `GET /planificaciones/configuracion`.
 */
export type EstadoConfiguracionPlanificacion =
  | 'BLOQUEADA'
  | 'REQUIERE_CONFIGURACION'
  | 'ACTIVA';

export interface PreferenciasPrecargadas {
  oposicion: Oposicion | null;
  nivel: NivelOposicion | null;
  franja: TipoDePlanificacionDeseada | null;
}

export interface VarianteConfiguracion {
  codigo: string;
  oposicion: Oposicion;
  nivel: NivelOposicion;
  franja: TipoDePlanificacionDeseada;
}

export interface ConfiguracionActiva {
  variante: VarianteConfiguracion;
  version: number;
  fechaVigencia: string;
  origen: string;
}

export interface RecomendacionNivel {
  puntuacion: number;
  nivelRecomendado: NivelOposicion;
}

export interface ConfiguracionPlanificacion {
  estado: EstadoConfiguracionPlanificacion;
  preferenciasPrecargadas: PreferenciasPrecargadas;
  oposicionesPermitidas: Oposicion[];
  configuracionActiva: ConfiguracionActiva | null;
  ultimaRecomendacion: RecomendacionNivel | null;
}

export interface GuardarConfiguracionDTO {
  oposicion: Oposicion;
  nivel: NivelOposicion;
  franja: TipoDePlanificacionDeseada;
  version: number;
}

export interface VarianteAdmin {
  id?: number;
  codigo: string;
  oposicion: Oposicion;
  nivel: NivelOposicion;
  franja: TipoDePlanificacionDeseada;
  activa: boolean;
}

export interface ReglaOposicionAdmin {
  id?: number;
  /** Oposición de la suscripción del alumno. */
  oposicionSuscripcion: Oposicion;
  /** Oposición de planificación que se habilita. */
  oposicionPlanificacion: Oposicion;
  activa: boolean;
}

export interface AlumnoSinCoincidencia {
  alumno: { id: number; nombre: string; apellidos: string; email: string };
  variante: VarianteAdmin;
  motivo: 'VARIANTE_INACTIVA' | 'OPOSICION_NO_PERMITIDA';
}
