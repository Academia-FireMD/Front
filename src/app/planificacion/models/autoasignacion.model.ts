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
  | 'PENDIENTE_PUBLICACION'
  | 'ACTIVA';

export interface PreferenciasPrecargadas {
  oposicion: Oposicion | null;
  nivel: NivelOposicion | null;
  franja: TipoDePlanificacionDeseada | null;
}

export interface VarianteConfiguracion {
  id?: number;
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
  /** Plan mensual canónico que recibe el alumno al activar la variante. */
  planificacionMensual: PlanificacionMensualResumen | null;
}

export interface PlanificacionMensualResumen {
  id: number;
  identificador: string;
  mes: number;
  ano: number;
  estado?: EstadoPlanificacionMensual;
  version?: number;
  publicadaAt?: string | null;
}

export type EstadoPlanificacionMensual = 'BORRADOR' | 'PUBLICADA' | 'ARCHIVADA';

export interface CuestionarioNivel {
  version: number;
  preguntas: Array<{
    id: string;
    texto: string;
    opciones: Array<{ valor: number; etiqueta: string }>;
  }>;
}

export interface RecomendacionNivel {
  puntuacion: number;
  nivelRecomendado: NivelOposicion;
  versionCuestionario?: number;
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
  /** Plan mensual publicado que se activa para esta variante, si existe. */
  planificacionMensualId?: number | null;
  planificacionMensual?: PlanificacionMensualResumen | null;
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
  alumno?: { id: number; nombre: string; apellidos: string; email: string };
  variante?: VarianteAdmin | null;
  aplicable: boolean;
  motivo:
    | 'SIN_CONFIGURACION'
    | 'PREFERENCIAS_INCOMPLETAS'
    | 'SIN_VARIANTE'
    | 'VARIANTE_INACTIVA'
    | 'SIN_PLANIFICACION_PUBLICADA'
    | 'OPOSICION_NO_PERMITIDA'
    | 'SIN_ASIGNACION'
    | 'PROGRESO_INCOMPLETO';
}

export interface ErrorReconciliacionPlanificacion {
  alumnoId: number;
  motivo: string;
  aplicable: false;
}

export type CasoReconciliacionPlanificacion =
  | AlumnoSinCoincidencia
  | ErrorReconciliacionPlanificacion;

export interface ReconciliacionPlanificaciones {
  aplicar: boolean;
  /** Huella del diagnóstico usado para proteger el apply contra cambios. */
  previewHash: string;
  totalElegibles: number;
  aplicables: number;
  aplicados: number;
  noAplicables: number;
  casos: CasoReconciliacionPlanificacion[];
}

export interface OpcionPlanificacionPermitida {
  oposicion: Oposicion;
  nivel: NivelOposicion;
  franja: TipoDePlanificacionDeseada;
  varianteId: number;
  planificacionMensual: PlanificacionMensualResumen | null;
}

export interface AlumnoPlanificacionTutor {
  alumno: { id: number; nombre: string; apellidos: string; email: string };
  /** El endpoint tutor devuelve la configuración activa directamente, no el shell completo. */
  configuracion: ConfiguracionActiva | null;
  preferencias: PreferenciasPrecargadas;
  oposicionesPermitidas: Oposicion[];
  opcionesPermitidas: OpcionPlanificacionPermitida[];
  recomendacion: RecomendacionNivel | null;
}

export interface IncidenciaImportacionPlantilla {
  hoja: string;
  semana?: number;
  dia?: string;
  filaExcel?: number;
  mensaje: string;
}

export interface SemanaImportacionPlantilla {
  numero: number;
  fechaInicio: string;
  bloques: number;
  entrenamientos: number;
  esqueleto: boolean;
}

export interface HojaImportacionPlantilla {
  hoja: string;
  valida: boolean;
  totalBloques: number;
  totalEntrenamientos: number;
  semanas: SemanaImportacionPlantilla[];
  errores: IncidenciaImportacionPlantilla[];
  warnings: Array<
    Pick<IncidenciaImportacionPlantilla, 'hoja' | 'semana' | 'mensaje'>
  >;
}

export interface PreviewImportacionPlantillas {
  fileName: string;
  fileHash: string;
  puedeAplicar: boolean;
  yaAplicado: boolean;
  requiereConfirmacionSobrescritura: boolean;
  sobrescrituras: string[];
  totales: {
    hojas: number;
    semanas: number;
    bloques: number;
    entrenamientos: number;
    errores: number;
  };
  hojas: HojaImportacionPlantilla[];
}

export interface ResultadoImportacionPlantillas {
  yaAplicado: boolean;
  version: number | null;
  hojas: Array<{
    hoja: string;
    semanasCreadas: number;
    semanasActualizadas: number;
    bloquesCreados: number;
    errores: number;
  }>;
}
