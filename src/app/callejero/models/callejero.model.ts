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

export type ZonaTipo = 'DISTRITO' | 'BARRIO';
export type PoiTipo = 'PARQUE_BOMBEROS' | 'HOSPITAL' | 'OTRO';

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
  nombre: string;
  totalCalles: number;
  dominadas: number;
}

/** Respuesta de `GET /callejero/ciudades/:id/progreso`. */
export interface ResumenProgreso {
  zonas: ResumenProgresoZona[];
}

/** Identificadores de los 5 modos de práctica (Task 3.3 del plan). */
export type ModoCallejero =
  | 'EXPLORAR'
  | 'MAPA_MUDO'
  | 'ENCUENTRA_CALLE'
  | 'QUE_CALLE_ES'
  | 'UBICAR_POI';
