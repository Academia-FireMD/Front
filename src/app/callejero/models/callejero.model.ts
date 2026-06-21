import type {
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from 'geojson';

/**
 * Modelos TS del módulo Callejero — espejo del contrato REST del backend
 * (`/callejero/*`). Las geometrías llegan como GeoJSON (EPSG:4326) en el cuerpo
 * de la respuesta, listas para `L.geoJSON(...)`. El filtrado por oposición del
 * alumno lo aplica el backend; aquí solo se consume.
 *
 * Contrato (Hito 3 del plan 2026-06-10-modulo-callejero-fase1.md):
 *  - GET  /callejero/ciudades                 → Ciudad[]
 *  - GET  /callejero/ciudades/:id/zonas       → Zona[]
 *  - GET  /callejero/zonas/:id/calles         → { calles: Calle[]; pois: Poi[] }
 *  - POST /callejero/progreso  { calleId, acierto }
 *  - GET  /callejero/ciudades/:id/progreso    → ResumenProgreso
 */

export type ZonaTipo = 'DISTRITO' | 'BARRIO' | 'PARQUE';
export type PoiTipo = 'PARQUE_BOMBEROS' | 'HOSPITAL' | 'OTRO';

/** Categorías de POI del callejero v3 (calcar Raúl). */
export type PoiCategoria =
  | 'bomberos'
  | 'hospital'
  | 'parque'
  | 'museo'
  | 'lugar'
  | 'calle';

/** `[minLng, minLat, maxLng, maxLat]` (EPSG:4326). */
export type Bbox = [number, number, number, number];

export interface Ciudad {
  id: number;
  slug: string;
  nombre: string;
  bbox: Bbox;
}

export interface Zona {
  id: number;
  ciudadId: number;
  codigo: string;
  nombre: string;
  tipo: ZonaTipo;
  geometria: Polygon | MultiPolygon;
  /** Callejero v3 (Raúl): color de relleno + parque/coopera. */
  color?: string | null;
  parque?: string | null;
  coopera?: string | null;
  areaName?: string | null;
}

/** Un POI de la ciudad (todas las categorías) — `GET /callejero/ciudades/:id/pois`. */
export interface PoiCiudad {
  id: number;
  nombre: string;
  tipo: PoiTipo;
  categoria: PoiCategoria;
  lat: number;
  lng: number;
  zonaId: number | null;
}

export interface Calle {
  id: number;
  zonaId: number | null;
  codigoExterno: string;
  nombre: string;
  tipoVia: string;
  codigoPostal: string | null;
  geometria: LineString | MultiLineString;
}

export interface Poi {
  id: number;
  nombre: string;
  tipo: PoiTipo;
  lat: number;
  lng: number;
  zonaId: number | null;
}

/** Respuesta de `GET /callejero/zonas/:id/calles`. */
export interface CallesZonaResponse {
  calles: Calle[];
  pois: Poi[];
}

/** Cuerpo de `POST /callejero/progreso`. */
export interface RegistrarProgresoDto {
  calleId: number;
  acierto: boolean;
}

export interface ResumenProgresoZona {
  zonaId: number;
  codigo: string;
  nombre: string;
  totalCalles: number;
  callesDominadas: number;
  porcentaje: number;
}

/** Resumen global de la ciudad (agregado de todas sus zonas). */
export interface ResumenGlobalCiudad {
  totalCalles: number;
  callesDominadas: number;
  porcentaje: number;
}

/** Respuesta de `GET /callejero/ciudades/:id/progreso`. */
export interface ResumenProgreso {
  ciudad: ResumenGlobalCiudad;
  zonas: ResumenProgresoZona[];
}

/** Identificadores de los 5 modos de práctica (Task 3.3 del plan). */
export type ModoCallejero =
  | 'EXPLORAR'
  | 'MAPA_MUDO'
  | 'ENCUENTRA_CALLE'
  | 'QUE_CALLE_ES'
  | 'UBICAR_POI';

// ============================================================================
// Modo Examen (Callejero v2 — Hito 2). Espejo del contrato `/callejero/examen/*`.
// ============================================================================

/** Tipo de reto: localizar (click en mapa), identificar (4 opciones) o recorrido (¿qué parque cubre?). */
export type TipoRetoCallejero = 'LOCALIZAR' | 'IDENTIFICAR' | 'RECORRIDO';

/**
 * Tipo de examen (Callejero v10):
 *  - `MIXTO` (default): retos LOCALIZAR + IDENTIFICAR sobre el mapa.
 *  - `RECORRIDO`: reto objetivo "¿qué parque cubre esta calle?".
 */
export type TipoExamenCallejero = 'MIXTO' | 'RECORRIDO';

/** Dificultad del examen/recorrido (port v27): filtra el pool por longitud de calle. */
export type DificultadCallejero = 'FACIL' | 'MEDIO' | 'DIFICIL';

/** Una opción de un reto de identificar. */
export interface OpcionRetoExamen {
  calleId: number;
  nombre: string;
}

/** Una opción de un reto de recorridos: el nombre de un parque. */
export interface OpcionParqueExamen {
  parque: string;
}

/**
 * Un reto del examen. `opciones` viene en los de IDENTIFICAR
 * (`OpcionRetoExamen[]`) y en los de RECORRIDO (`OpcionParqueExamen[]`). El
 * cliente usa `calleId`/`nombre` para el feedback inmediato; la nota la calcula
 * el backend desde el token firmado.
 */
export interface RetoExamen {
  orden: number;
  tipo: TipoRetoCallejero;
  calleId: number;
  nombre: string;
  opciones?: OpcionRetoExamen[] | OpcionParqueExamen[];
}

/** Respuesta de `POST /callejero/examen/generar`. */
export interface GenerarExamenResponse {
  token: string;
  /** Omitido en backends antiguos → tratar como `MIXTO`. */
  tipoExamen?: TipoExamenCallejero;
  ciudadId: number;
  zonaIds: number[];
  totalRetos: number;
  duracionRetoMs: number;
  calles: Calle[];
  retos: RetoExamen[];
}

/** Una respuesta del alumno a un reto (cuerpo de `registrar`). */
export interface RespuestaExamenDto {
  orden: number;
  respuestaCalleId?: number | null;
  /** Callejero v10 (RECORRIDO): parque elegido en "¿qué parque cubre esta calle?". */
  respuestaParque?: string | null;
  tiempoMs: number;
  agotoTiempo: boolean;
}

/**
 * Recorrido publicado de una calle — respuesta de
 * `GET /callejero/recorrido?calleId=`. Si no hay ruta publicada el backend
 * responde 404 ("Ruta no disponible"); el front lo trata como estado DURO
 * (D7), nunca dibuja una línea recta como recorrido.
 */
export interface RecorridoResponse {
  /** Geometría OSRM (GeoJSON coords/LineString) ya precomputada y limpia. */
  polyline: LineString | MultiLineString;
  /** Nombres de vía en orden de recorrido. */
  calles: string[];
  km: number;
  minutos: number;
  /** Estación (parque de bomberos) origen del recorrido. */
  estacion: { nombre: string; lat: number; lng: number } | null;
}

/** Cuerpo de `POST /callejero/examen/registrar`. */
export interface RegistrarExamenDto {
  token: string;
  tiempoTotalMs: number;
  respuestas: RespuestaExamenDto[];
}

/** Desglose por reto que devuelve `registrar` (para resultado + repasar fallos). */
export interface DetalleRetoResultado {
  orden: number;
  calleId: number;
  calleNombre: string;
  tipoReto: TipoRetoCallejero;
  acertado: boolean;
  tiempoMs: number;
  agotoTiempo: boolean;
}

/** Respuesta de `POST /callejero/examen/registrar`. */
export interface ResultadoExamen {
  intentoId: number;
  creadoEn: string;
  ciudadId: number;
  zonaIds: number[];
  totalRetos: number;
  aciertos: number;
  fallos: number;
  nota: number;
  aprobado: boolean;
  tiempoTotalMs: number;
  detalle: DetalleRetoResultado[];
}

/** Un intento en el histórico. */
export interface IntentoExamenHistorial {
  id: number;
  ciudadId: number;
  zonaIds: number[];
  totalRetos: number;
  aciertos: number;
  fallos: number;
  nota: number;
  aprobado: boolean;
  tiempoTotalMs: number;
  creadoEn: string;
}

/** Respuesta de `GET /callejero/examen/historial`. */
export interface HistorialExamenResponse {
  items: IntentoExamenHistorial[];
  total: number;
  page: number;
  pageSize: number;
}

/** Una entrada del leaderboard (mejor intento de un alumno). */
export interface LeaderboardEntry {
  rank: number;
  /** Nombre real si el alumno hizo opt-in; si no, seudónimo ("Alumno XXXX"). */
  displayName: string;
  nota: number;
  tiempoTotalMs: number;
  creadoEn: string;
  esTuyo: boolean;
}

/** Posición del alumno actual aunque esté fuera del top. */
export interface LeaderboardMiRango {
  rank: number;
  nota: number;
  tiempoTotalMs: number;
}

/** Respuesta de `POST /callejero/examen/resultado` (examen estilo Raúl). */
export interface ResultadoExamenRaul {
  intentoId: number;
  creadoEn: string;
  ciudadId: number;
  totalRetos: number;
  aciertos: number;
  fallos: number;
  nota: number;
  aprobado: boolean;
  puntos: number;
}

/** Respuesta de `GET /callejero/examen/leaderboard`. */
export interface LeaderboardResponse {
  ciudadId: number;
  total: number;
  top: LeaderboardEntry[];
  miRango: LeaderboardMiRango | null;
  /** Estado actual del opt-in del alumno (mostrar nombre real). */
  miOptIn: boolean;
}
