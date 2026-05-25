import { Dificultad } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';

export type EstadoCurso = 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';

/**
 * Refactor 2026-05-25: enum exportado para que tipemos
 * LeccionFormResult.tipo con `TipoLeccion` (en vez de `as never`).
 */
export type TipoLeccion = 'VIDEO' | 'TEST' | 'FLASHCARDS' | 'TEXTO';

export interface Leccion {
  id: number;
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  contenidoMarkdown?: string;
  // Refactor 2026-05-25: lecciones TEST/FLASHCARDS referencian un Tema +
  // reglas (numPreguntas, dificultad, esDeRepaso) que el backend usa al
  // crear el Test al alumno.
  temaId?: number | null;
  numPreguntas?: number | null;
  dificultad?: Dificultad | null;
  esDeRepaso?: boolean;
  seccionId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Seccion {
  id: number;
  titulo: string;
  orden: number;
  cursoId: number;
  lecciones: Leccion[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Curso {
  id: number;
  titulo: string;
  slug: string;
  descripcion?: string;
  precio?: number | null;
  /**
   * Refactor 2026-05-25: producto WC vinculado. Backend deriva `precio` desde
   * el cache de WooCommerceProductCache al hacer create/update.
   */
  wooProductId?: number | null;
  oposicion?: Oposicion | null;
  thumbnailUrl?: string;
  duracionEstimadaMinutos?: number;
  estado: EstadoCurso;
  createdAt?: string;
  updatedAt?: string;
}

export interface CursoAdmin extends Curso {
  _count?: { secciones?: number; accesos?: number };
}

export interface CursoDetail extends Curso {
  secciones: Seccion[];
}

export interface TusCredentials {
  endpoint: string;
  VideoId: string;
  LibraryId: string;
  AuthorizationSignature: string;
  AuthorizationExpire: number;
}

export interface SeccionReorderItem {
  id: number;
  orden: number;
}

export interface LeccionReorderItem {
  id: number;
  orden: number;
}

// ---- Alumno-facing types ----

export interface ProgresoLeccion {
  id: number;
  leccionId: number;
  usuarioId: number;
  segundosVisto: number;
  porcentajeVisto: number;
  completada: boolean;
  updatedAt?: string;
}

export interface AccesoConCurso {
  id: number;
  cursoId: number;
  usuarioId: number;
  curso: CursoDetail;
  progreso?: ProgresoLeccion[];
  createdAt?: string;
}

export type CursoPublico = Curso;

export interface CursoSlugResponse {
  curso: CursoDetail;
  tieneAcceso: boolean;
}

export interface LeccionResponse {
  leccion: Leccion;
  playbackUrl?: string;
}

export interface UpsertProgresoDto {
  segundosVisto: number;
  porcentajeVisto: number;
  completada?: boolean;
}

/**
 * Refactor 2026-05-25 — DTOs locales que sustituyen al schema OpenAPI stale
 * (regenerarlo requiere arrancar el backend, no disponible en este flow).
 * Mantenemos los nombres y la forma que expone el Server actual en
 * `src/dtos/cursos/{curso-create,curso-update,leccion}.dto.ts`.
 */
export interface CursoCreatePayload {
  titulo: string;
  slug: string;
  descripcion?: string;
  /** Backend deriva precio. NO mandar en payload. */
  wooProductId?: number | null;
  oposicion?: Oposicion;
  thumbnailUrl?: string;
  duracionEstimadaMinutos?: number;
}

export interface CursoUpdatePayload {
  titulo?: string;
  descripcion?: string;
  wooProductId?: number | null;
  oposicion?: Oposicion;
  thumbnailUrl?: string;
  duracionEstimadaMinutos?: number;
  /**
   * D15 — Optimistic locking. Cliente envía el valor recibido en el último
   * GET. Backend valida contra el actual en BD; si no coinciden devuelve 409.
   */
  updatedAt: string;
}

/**
 * Payload de creación de lección.
 *
 * IMPORTANTE (BLOCKING-2 codex review): `temaId` y `numPreguntas` son
 * conceptualmente **requeridos cuando `tipo` es 'TEST' o 'FLASHCARDS'**, pero
 * se exponen como optional por compatibilidad con los demás tipos. La
 * validación se aplica en `LeccionFormDialogComponent.save()` antes de emitir.
 * El backend rechaza con 400 si faltan en TEST/FLASHCARDS.
 *
 * Si se quisiera convertir esto en tipos discriminados:
 *   type LeccionCreatePayload =
 *     | (BaseLeccion & { tipo: 'VIDEO'; bunnyVideoId?: string; ... })
 *     | (BaseLeccion & { tipo: 'TEXTO'; contenidoMarkdown?: string })
 *     | (BaseLeccion & { tipo: 'TEST' | 'FLASHCARDS'; temaId: number;
 *                        numPreguntas: number; ... });
 * No se ha hecho ahora porque rompe los callers existentes que construyen el
 * payload incrementalmente. Cuando se simplifique, considerar el cambio.
 */
export interface LeccionCreatePayload {
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  contenidoMarkdown?: string;
  /** Required cuando tipo === 'TEST' || 'FLASHCARDS'. Optional para VIDEO/TEXTO. */
  temaId?: number;
  /** Required cuando tipo === 'TEST' || 'FLASHCARDS'. Rango válido: 1..50. */
  numPreguntas?: number;
  dificultad?: Dificultad;
  esDeRepaso?: boolean;
}

export interface LeccionUpdatePayload {
  titulo?: string;
  orden?: number;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  contenidoMarkdown?: string;
  temaId?: number;
  numPreguntas?: number;
  dificultad?: Dificultad;
  esDeRepaso?: boolean;
}

/**
 * Respuesta de `GET /woocommerce/products/cursos`. El backend mapea el
 * WooCommerceProductCache a este shape (no expone `wooProductId`, usa `id`).
 */
export interface WooCommerceProductSummary {
  id: number;
  name: string;
  sku: string | null;
  price: string | null;
  regular_price: string | null;
  sale_price: string | null;
  status: string;
}
