import {
  APLICACION_CODIGO_HIDRAULICA,
  Curso,
  Leccion,
  ProgresoLeccion,
  Seccion,
} from '../models/curso.model';
import { leccionesPlanas, leccionContinuar } from './progreso.util';

/** Curso con la proyección de secciones que exponen los endpoints de alumno. */
type CursoConSecciones = Curso & { secciones?: Seccion[] };

/** Destino/CTA único para las tarjetas de MisCursos y el detalle del curso. */
export interface DestinoCtaCurso {
  /** true = el curso se presenta como aplicación interactiva. */
  aplicacion: boolean;
  etiqueta: string;
  /** Lección que debe abrir el CTA; null si no hay destino lanzable. */
  leccionId: number | null;
  disponible: boolean;
  /** Explicación para el estado deshabilitado (nunca abrir otra lección). */
  motivo: string | null;
}

function esLeccionGuardada(leccion: Leccion): boolean {
  return esLeccionGuardadaId(leccion.id);
}

function esLeccionGuardadaId(
  leccionId: number | null | undefined,
): leccionId is number {
  return (
    typeof leccionId === 'number' &&
    Number.isSafeInteger(leccionId) &&
    leccionId > 0
  );
}

/**
 * Lección válida para ser entrada de una presentación APLICACION:
 *  - guardada en este curso,
 *  - con al menos un bloque INTERACTIVO,
 *  - todos sus bloques INTERACTIVO del MISMO código aprobado del registro fijo.
 *
 * Si la proyección no incluye bloques (p. ej. GET alumno del curso), no se puede
 * afirmar que sea inválida: se valida la existencia de la lección y el backend
 * es la autoridad de publicación. El aula vuelve a validar la pila real al
 * cargar la lección antes de activar el modo inmersivo.
 */
export function esLeccionAplicacionValida(leccion: Leccion): boolean {
  const bloques = leccion.bloques;
  if (!bloques) return true;
  if (!bloques.length) return false;
  let codigo: string | null = null;
  for (const bloque of bloques) {
    if (bloque.tipo !== 'INTERACTIVO' || !bloque.aplicacionCodigo) return false;
    if (codigo === null) codigo = bloque.aplicacionCodigo;
    else if (codigo !== bloque.aplicacionCodigo) return false;
  }
  return codigo === APLICACION_CODIGO_HIDRAULICA;
}

/** Busca una lección guardada por id en cualquier sección del curso. */
export function buscarLeccionCurso(
  curso: Pick<CursoConSecciones, 'secciones'>,
  leccionId: number | null | undefined,
): Leccion | null {
  if (!esLeccionGuardadaId(leccionId)) return null;
  return (
    leccionesPlanas({ secciones: curso.secciones ?? [] }).find(
      (leccion) => esLeccionGuardada(leccion) && leccion.id === leccionId,
    ) ?? null
  );
}

/**
 * Resuelve la acción principal de un curso con acceso. Fuente única para
 * MisCursos (card/hero) y el detalle:
 *  - APLICACION → "Abrir aplicación" y SIEMPRE la lección configurada, nunca la
 *    primera intro ni el porcentaje nativo. Entrada ausente/ inválida → CTA
 *    deshabilitado con motivo, sin fallback silencioso.
 *  - ESTANDAR → "Continuar"/"Empezar" con la lección de continuidad nativa.
 */
export function resolverCtaCurso(
  curso: CursoConSecciones,
  progreso: ProgresoLeccion[] = [],
  porcentaje = 0,
): DestinoCtaCurso {
  if (curso.modoPresentacion === 'APLICACION') {
    const leccionId = curso.leccionAplicacionId ?? null;
    if (!esLeccionGuardadaId(leccionId)) {
      return {
        aplicacion: true,
        etiqueta: 'Aplicación no disponible',
        leccionId: null,
        disponible: false,
        motivo:
          'El curso aún no tiene una lección de aplicación configurada. Contacta con tu academia.',
      };
    }

    // Catálogo: el backend devuelve los escalares del curso y NO la jerarquía.
    // Un id positivo configurado es suficiente: el backend es la autoridad de
    // validez/acceso y la ficha volverá a validar la pila real de la lección.
    if (!Array.isArray(curso.secciones)) {
      return {
        aplicacion: true,
        etiqueta: 'Abrir aplicación',
        leccionId,
        disponible: true,
        motivo: null,
      };
    }

    const leccion = buscarLeccionCurso(curso, leccionId);
    if (!leccion) {
      return {
        aplicacion: true,
        etiqueta: 'Aplicación no disponible',
        leccionId: null,
        disponible: false,
        motivo:
          'La lección de aplicación configurada ya no está disponible. Contacta con tu academia.',
      };
    }
    if (!esLeccionAplicacionValida(leccion)) {
      return {
        aplicacion: true,
        etiqueta: 'Aplicación no disponible',
        leccionId: null,
        disponible: false,
        motivo:
          'La lección configurada no contiene una aplicación interactiva válida.',
      };
    }
    return {
      aplicacion: true,
      etiqueta: 'Abrir aplicación',
      leccionId: leccion.id,
      disponible: true,
      motivo: null,
    };
  }

  const continuar = leccionContinuar(
    { secciones: curso.secciones ?? [] },
    progreso,
  );
  return {
    aplicacion: false,
    etiqueta: porcentaje > 0 ? 'Continuar' : 'Empezar',
    leccionId: continuar?.id ?? null,
    disponible: continuar !== null,
    motivo: continuar === null ? 'El curso todavía no tiene lecciones.' : null,
  };
}
