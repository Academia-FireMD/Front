import { NivelOposicion } from '../shared/models/pregunta.model';
import { Oposicion } from '../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../shared/models/user.model';
import type {
  OpcionPlanificacionPermitida,
  PreferenciasPrecargadas,
} from './models/autoasignacion.model';

export interface OpcionesCascadaPlanificacion {
  oposiciones: Oposicion[];
  niveles: NivelOposicion[];
  franjas: TipoDePlanificacionDeseada[];
  seleccionada: OpcionPlanificacionPermitida | null;
}

/**
 * Proyecta las combinaciones backend en una cascada, sin crear cruces que no
 * existan en `opcionesPermitidas`.
 */
export function obtenerOpcionesCascadaPlanificacion(
  opciones: OpcionPlanificacionPermitida[],
  preferencias: PreferenciasPrecargadas,
): OpcionesCascadaPlanificacion {
  const valoresUnicos = <T>(
    filas: OpcionPlanificacionPermitida[],
    seleccionar: (fila: OpcionPlanificacionPermitida) => T,
  ): T[] => [...new Set(filas.map(seleccionar))];
  const opcionesOposicion = preferencias.oposicion
    ? opciones.filter((opcion) => opcion.oposicion === preferencias.oposicion)
    : [];
  const opcionesNivel = preferencias.nivel
    ? opcionesOposicion.filter((opcion) => opcion.nivel === preferencias.nivel)
    : [];
  const seleccionada =
    preferencias.oposicion && preferencias.nivel && preferencias.franja
      ? (opciones.find(
          (opcion) =>
            opcion.oposicion === preferencias.oposicion &&
            opcion.nivel === preferencias.nivel &&
            opcion.franja === preferencias.franja,
        ) ?? null)
      : null;

  return {
    oposiciones: valoresUnicos(opciones, (opcion) => opcion.oposicion),
    niveles: preferencias.oposicion
      ? valoresUnicos(opcionesOposicion, (opcion) => opcion.nivel)
      : [],
    franjas:
      preferencias.oposicion && preferencias.nivel
        ? valoresUnicos(opcionesNivel, (opcion) => opcion.franja)
        : [],
    seleccionada,
  };
}

/** Limpia nivel/franja cuando una selección deja de ser válida en la cascada. */
export function normalizarPreferenciasPlanificacion(
  opciones: OpcionPlanificacionPermitida[],
  preferencias: PreferenciasPrecargadas,
): PreferenciasPrecargadas {
  const cascada = obtenerOpcionesCascadaPlanificacion(opciones, preferencias);
  const oposicion = preferencias.oposicion;
  if (!oposicion || !cascada.oposiciones.includes(oposicion)) {
    return { oposicion: null, nivel: null, franja: null };
  }
  const nivel = preferencias.nivel;
  if (!nivel || !cascada.niveles.includes(nivel)) {
    return { oposicion, nivel: null, franja: null };
  }
  const franja = preferencias.franja;
  return {
    oposicion,
    nivel,
    franja: franja && cascada.franjas.includes(franja) ? franja : null,
  };
}

export function esCombinacionPublicada(
  opcion: OpcionPlanificacionPermitida | null,
): boolean {
  return (
    opcion?.planificacionMensual !== null &&
    opcion?.planificacionMensual !== undefined
  );
}
