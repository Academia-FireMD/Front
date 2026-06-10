import { Calle, Ciudad, Poi, Zona } from '../models/callejero.model';
import {
  VALENCIA_CALLES,
  VALENCIA_CIUDAD,
  VALENCIA_POIS,
  VALENCIA_ZONAS,
  VALENCIA_ZONA_CON_MAS_CALLES_ID,
} from './valencia-fixture.data';

/**
 * Fixture de Valencia para tests de componente/servicio. Los datos provienen de
 * `_spike/valencia.seed.json` (seed real del spike), recortados a 2 barrios del
 * centro (cap 40 calles/zona) y servidos ya en la forma del CONTRATO REST
 * (ids numéricos, `zonaId` resuelto). Idéntico en forma a lo que el backend
 * devuelve, así que validar el render GeoJSON y los 5 modos contra él es
 * representativo. Sin Node `fs` → compila bajo el `tsconfig.spec.json` actual.
 */
export interface ValenciaFixture {
  ciudad: Ciudad;
  zonas: Zona[];
  /** Calles indexadas por `zona.id`. */
  callesPorZona: Map<number, Calle[]>;
  pois: Poi[];
  /** Zona con más calles (determinista) — buena para tests de modos. */
  zonaConMasCalles: Zona;
}

export function loadValenciaFixture(): ValenciaFixture {
  const callesPorZona = new Map<number, Calle[]>();
  for (const calle of VALENCIA_CALLES) {
    if (calle.zonaId == null) continue;
    const arr = callesPorZona.get(calle.zonaId) ?? [];
    arr.push(calle);
    callesPorZona.set(calle.zonaId, arr);
  }

  const zonaConMasCalles =
    VALENCIA_ZONAS.find((z) => z.id === VALENCIA_ZONA_CON_MAS_CALLES_ID) ??
    VALENCIA_ZONAS[0];

  return {
    ciudad: VALENCIA_CIUDAD,
    zonas: VALENCIA_ZONAS,
    callesPorZona,
    pois: VALENCIA_POIS,
    zonaConMasCalles,
  };
}
