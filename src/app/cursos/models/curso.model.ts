import { Dificultad } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';

export type EstadoCurso = 'BORRADOR' | 'PUBLICADO' | 'ARCHIVADO';

/**
 * Refactor 2026-05-25: enum exportado para que tipemos
 * LeccionFormResult.tipo con `TipoLeccion` (en vez de `as never`).
 */
export type TipoLeccion = 'VIDEO' | 'TEST' | 'FLASHCARDS' | 'TEXTO';

/**
 * Lección por bloques (2026-06-11). Una lección es una pila de bloques
 * combinables. FLASHCARDS NO es un tipo de bloque (era para memorizar).
 * CUESTIONARIO (quiz inline propio) llega en Fase 2.
 */
export type TipoBloque = 'VIDEO' | 'TEXTO' | 'TEST' | 'CUESTIONARIO';

/**
 * Pregunta de un bloque CUESTIONARIO. `respuestaCorrecta`/`explicacion` SOLO
 * llegan en la cara admin (el alumno los recibe `undefined`; los obtiene al
 * corregir vía POST /bloques/:id/cuestionario/corregir).
 */
export interface BloquePregunta {
  id: number;
  bloqueId: number;
  orden: number;
  enunciado: string;
  opciones: string[];
  respuestaCorrecta?: number;
  explicacion?: string | null;
}

export interface Bloque {
  id: number;
  leccionId: number;
  orden: number;
  tipo: TipoBloque;
  bunnyVideoId?: string | null;
  duracionSegundos?: number | null;
  contenidoMarkdown?: string | null;
  temaId?: number | null;
  numPreguntas?: number | null;
  dificultad?: Dificultad | null;
  esDeRepaso?: boolean;
  bloquePreguntas?: BloquePregunta[];
  createdAt?: string;
  updatedAt?: string;
}

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
  // Lección por bloques: el contenido vive aquí. Si está vacío/ausente, la
  // lección es legacy (un solo tipo) y se lee de los campos de arriba.
  bloques?: Bloque[];
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
  /**
   * Timestamp de última actividad. El backend (Prisma) lo expone como
   * `ultimaVez` (no `updatedAt`); se usa para "continuar donde lo dejaste".
   */
  ultimaVez?: string;
}

export interface AccesoConCurso {
  id: number;
  cursoId: number;
  usuarioId: number;
  curso: CursoDetail;
  progreso?: ProgresoLeccion[];
  createdAt?: string;
}

/**
 * Curso del catálogo. `tieneAcceso` lo añade el backend (`GET /cursos/catalogo`)
 * para que la card marque los cursos ya poseídos ("Ver curso") en vez de "Comprar".
 */
export type CursoPublico = Curso & { tieneAcceso?: boolean };

export interface CursoSlugResponse {
  curso: CursoDetail;
  tieneAcceso: boolean;
  /**
   * Progreso del alumno en este curso. Presente SOLO cuando `tieneAcceso`
   * (el backend lo omite si no hay acceso). Alimenta checkmarks del sidebar,
   * % del curso y "continuar donde lo dejaste". Espeja el `progreso[]` que
   * `GET /cursos/mios` ya devuelve por curso.
   */
  progreso?: ProgresoLeccion[];
}

export interface LeccionResponse {
  leccion: Leccion;
  /** Legacy: URL firmada del vídeo de la lección de un solo tipo (compat). */
  playbackUrl?: string;
  /** URLs firmadas por bloque de vídeo (mapa bloqueId → url). */
  playbackUrls?: Record<number, string>;
}

// ---- Payloads admin de bloques ----
export interface BloquePreguntaPayload {
  enunciado: string;
  opciones: string[];
  respuestaCorrecta: number;
  explicacion?: string;
}

export interface BloqueCreatePayload {
  orden: number;
  tipo: TipoBloque;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  contenidoMarkdown?: string;
  temaId?: number;
  numPreguntas?: number;
  dificultad?: Dificultad;
  esDeRepaso?: boolean;
  preguntas?: BloquePreguntaPayload[];
}

export interface BloqueUpdatePayload {
  orden?: number;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  contenidoMarkdown?: string;
  temaId?: number;
  numPreguntas?: number;
  dificultad?: Dificultad;
  esDeRepaso?: boolean;
  preguntas?: BloquePreguntaPayload[];
}

// ---- CUESTIONARIO: corrección cara-alumno ----
export interface CorregirCuestionarioPayload {
  respuestas: { preguntaId: number; opcionElegida: number | null }[];
}

export interface CuestionarioResultadoItem {
  preguntaId: number;
  opcionElegida: number | null;
  correcta: boolean;
  respuestaCorrecta: number;
  explicacion: string | null;
}

export interface CuestionarioResultado {
  aciertos: number;
  total: number;
  resultados: CuestionarioResultadoItem[];
}

export interface BloqueReorderItem {
  id: number;
  orden: number;
}

export interface UpsertProgresoDto {
  segundosVisto: number;
  porcentajeVisto: number;
  completada?: boolean;
}

/**
 * Códigos de error del cobro COF de un curso (`POST /cursos/:id/comprar-cof`).
 * Unión literal cerrada — NO usar `string` suelto.
 *  - `PAGO_RECHAZADO`: la tarjeta fue rechazada (sin fondos / banco / 3DS). NO
 *    es reintentable con 1-clic → empuja al alumno a la tienda con otra tarjeta.
 *  - `ERROR_TEMPORAL`: fallo técnico (SSH timeout / WP error). SÍ reintentable.
 *  - `YA_TIENES`: el alumno ya posee el curso.
 */
export type ComprarCursoCofError =
  | 'PAGO_RECHAZADO'
  | 'ERROR_TEMPORAL'
  | 'YA_TIENES';

/**
 * Respuesta de `POST /cursos/:id/comprar-cof`. Discriminada por `success`:
 *  - `{ success: true }`: comprado, el alumno ya tiene acceso (grant in-app).
 *  - `{ success: false, requiereCheckout: true }`: alumno SIN COF usable → hay
 *    que llevarlo al checkout WC (`?add-to-cart=<wooProductId>`).
 *  - `{ success: false, error }`: fallo clasificado (ver `ComprarCursoCofError`).
 *
 * Espeja el contrato de `AnadirPlanResponse` (flujo COF de altas).
 */
export type ComprarCursoCofResponse =
  | {
      success: true;
      /** Id del `AccesoCurso` concedido (grant in-app inmediato). */
      accesoId?: number;
      mensaje: string;
    }
  | {
      success: false;
      requiereCheckout: true;
      /** Producto WooCommerce del curso para el `?add-to-cart=`. */
      wooProductId: number;
      mensaje: string;
    }
  | {
      success: false;
      error: ComprarCursoCofError;
      mensaje: string;
    };

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
  /**
   * Consolidación 2026-06-11: opcional. La lección es un contenedor de bloques;
   * el backend aplica `TEXTO` por defecto. Solo se envía para compat legacy.
   */
  tipo?: TipoLeccion;
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
