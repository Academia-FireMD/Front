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
  evaluacionId: number;
  nivelRecomendado: NivelOposicion;
}

/** Evaluación que el alumno aceptó expresamente. Un cálculo sin aceptar
 * nunca aparece aquí ni sustituye la selección persistida anterior. */
export interface EstadoTestNivel {
  evaluacionId: number;
  completado: true;
  nivelRecomendado: NivelOposicion;
  nivelElegido: NivelOposicion;
  versionCuestionario: number | null;
  aceptadaEn: string;
}

export interface ConfiguracionPlanificacion {
  estado: EstadoConfiguracionPlanificacion;
  preferenciasPrecargadas: PreferenciasPrecargadas;
  oposicionesPermitidas: Oposicion[];
  disponibilidadOposiciones?: DisponibilidadOposicion[];
  /** Combinaciones activas que el alumno puede confirmar. */
  opcionesPermitidas?: OpcionPlanificacionPermitida[];
  configuracionActiva: ConfiguracionActiva | null;
  estadoTest: EstadoTestNivel | null;
  ultimaRecomendacion?: {
    puntuacion: number;
    nivelRecomendado: NivelOposicion;
  } | null;
}

export type EstadoDisponibilidadOposicion =
  | 'DISPONIBLE'
  | 'SIN_VARIANTE_ACTIVA'
  | 'SIN_PLANIFICACION_PUBLICADA';

export interface DisponibilidadOposicion {
  oposicion: Oposicion;
  estado: EstadoDisponibilidadOposicion;
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
  recomendacion: {
    nivelRecomendado: NivelOposicion;
    nivelElegido: NivelOposicion | null;
  } | null;
}

export interface IncidenciaImportacionPlantilla {
  hoja: string;
  semana?: number;
  dia?: string;
  filaExcel?: number;
  campo?: string;
  mensaje: string;
}

export interface SemanaImportacionPlantilla {
  numero: number;
  fechaInicio: string;
  bloques: number;
  entrenamientos: number;
  esqueleto: boolean;
  estado?: 'creada' | 'actualizada' | 'omitida' | 'error' | 'sobrescritura';
}

export interface HojaImportacionPlantilla {
  hoja: string;
  variante?: VarianteConfiguracion | null;
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

export type DestinoCargaSemanas =
  | { tipo: 'EXISTENTE'; planificacionId: number }
  | { tipo: 'COPIAR' }
  | { tipo: 'CREAR'; identificador: string; descripcion?: string };

export interface VarianteCargaSemanas {
  codigo: string;
  oposicion?: Oposicion;
  nivel?: NivelOposicion;
  franja?: TipoDePlanificacionDeseada;
  publicadaId?: number | null;
  publicada?: { identificador: string; version: number } | null;
  candidatos?: Array<{ id: number; identificador: string }>;
  destino: DestinoCargaSemanas | null;
  planificacionId?: number;
  primeraSemana?: string;
  semanas?: Array<{
    hoja: string;
    numero: number;
    lunes: string;
    creados: number;
    actualizados: number;
    omitidos: number;
    eliminados: number;
    bloques: Array<{
      nombre: string;
      estado: 'creado' | 'actualizado' | 'omitido' | 'eliminado';
      horaInicio: string;
      duracion: number;
    }>;
  }>;
}

export interface PreviewCargaSemanas {
  puedeAplicar: boolean;
  requiereEleccion?: boolean;
  requiereConfirmacion?: boolean;
  previewHash: string | null;
  plantillasActualizadas?: string[];
  variantes: VarianteCargaSemanas[];
  mensaje?: string;
}
