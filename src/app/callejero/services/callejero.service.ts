import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiBaseService } from '../../services/api-base.service';
import {
  CalleCiudad,
  CalleCiudadListResponse,
  CalleModificada,
  CallesModificadasResponse,
  CallesZonaResponse,
  Ciudad,
  DificultadCallejero,
  GenerarExamenResponse,
  GeocodeBuscarItem,
  GeocodeBuscarResponse,
  GeocodeReverseResponse,
  HistorialExamenResponse,
  LeaderboardResponse,
  PoiCiudad,
  RecorridoLibreResponse,
  RecorridoResponse,
  RegistrarExamenDto,
  RegistrarProgresoDto,
  ResultadoExamen,
  ResultadoExamenRaul,
  ResumenProgreso,
  TipoExamenCallejero,
  Zona,
} from '../models/callejero.model';

/**
 * Cliente REST del módulo Callejero. Extiende `ApiBaseService`, así que las
 * peticiones cuelgan de `environment.apiUrl + '/callejero'` con
 * `withCredentials`. El backend ya filtra las ciudades por la oposición del
 * alumno; el front solo consume.
 */
@Injectable({ providedIn: 'root' })
export class CallejeroService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
    this.controllerPrefix = '/callejero';
  }

  /** GET /callejero/ciudades — ciudades accesibles por la oposición del alumno. */
  listarCiudades(): Observable<Ciudad[]> {
    return this.get('/ciudades') as Observable<Ciudad[]>;
  }

  /** GET /callejero/ciudades/:id/zonas — zonas de parque con color/parque/coopera. */
  listarZonas(ciudadId: number): Observable<Zona[]> {
    return this.get(`/ciudades/${ciudadId}/zonas`) as Observable<Zona[]>;
  }

  /** GET /callejero/ciudades/:id/pois — todos los POIs (todas las categorías). */
  listarPoisCiudad(ciudadId: number): Observable<PoiCiudad[]> {
    return this.get(`/ciudades/${ciudadId}/pois`) as Observable<PoiCiudad[]>;
  }

  /**
   * GET /callejero/ciudades/:id/calles — todas las calles de la ciudad con
   * punto medio, longitud en metros y parques de cobertura (~1727 para Valencia).
   * Usa `ignoreError=true` para evitar toast si falla; el componente degrada
   * graciosamente a `callesCiudad=[]`.
   */
  listarCallesCiudad(ciudadId: number): Observable<CalleCiudad[]> {
    return (
      this.get(
        `/ciudades/${ciudadId}/calles`,
        true,
      ) as Observable<CalleCiudadListResponse>
    ).pipe(map((r) => r.calles));
  }

  /**
   * GET /callejero/geocode/reverse?lat=&lng= — dirección aproximada a partir
   * de coordenadas (se usa en la ficha de punto). `ignoreError=true` para
   * degradar silenciosamente si el servicio no está disponible.
   */
  geocodeReverse(lat: number, lng: number): Observable<GeocodeReverseResponse> {
    return this.get(
      `/geocode/reverse?lat=${lat}&lng=${lng}`,
      true,
    ) as Observable<GeocodeReverseResponse>;
  }

  /**
   * GET /callejero/geocode/buscar?q=&limit= — sugerencias OSM para el
   * autocomplete de dirección libre (Recorridos). `ignoreError=true` para
   * degradar a lista vacía si falla.
   */
  geocodeBuscar(q: string, limit = 5): Observable<GeocodeBuscarItem[]> {
    return (
      this.get(
        `/geocode/buscar?q=${encodeURIComponent(q)}&limit=${limit}`,
        true,
      ) as Observable<GeocodeBuscarResponse>
    ).pipe(map((r) => r.items));
  }

  /**
   * GET /callejero/ciudades/:id/calles-modificadas — calles renombradas en 2017.
   * `ignoreError=true`: si el endpoint no existe todavía (backend en paralelo),
   * el front degrada silenciosamente a lista vacía.
   */
  listarCallesModificadas(ciudadId: number): Observable<CalleModificada[]> {
    return (
      this.get(
        `/ciudades/${ciudadId}/calles-modificadas`,
        true,
      ) as Observable<CallesModificadasResponse>
    ).pipe(map((r) => r?.modificadas ?? []));
  }

  /** POST /callejero/examen/resultado — persiste un examen estilo Raúl (sin timer). */
  registrarResultadoExamen(dto: {
    ciudadId: number;
    totalRetos: number;
    aciertos: number;
    puntos: number;
  }): Observable<ResultadoExamenRaul> {
    return this.post(
      '/examen/resultado',
      dto,
    ) as Observable<ResultadoExamenRaul>;
  }

  /** GET /callejero/zonas/:id/calles — calles (GeoJSON) + POIs de la zona. */
  listarCalles(zonaId: number): Observable<CallesZonaResponse> {
    return this.get(
      `/zonas/${zonaId}/calles`,
    ) as Observable<CallesZonaResponse>;
  }

  /** POST /callejero/progreso — registra un acierto/fallo sobre una calle. */
  registrarProgreso(
    calleId: number,
    acierto: boolean,
  ): Observable<ResumenProgreso | void> {
    const body: RegistrarProgresoDto = { calleId, acierto };
    return this.post('/progreso', body) as Observable<ResumenProgreso | void>;
  }

  /** GET /callejero/ciudades/:id/progreso — % de calles dominadas por zona. */
  resumenProgreso(ciudadId: number): Observable<ResumenProgreso> {
    return this.get(
      `/ciudades/${ciudadId}/progreso`,
    ) as Observable<ResumenProgreso>;
  }

  // ── Recorridos (Callejero v10 — Hito 4) ──────────────────────────────────

  /**
   * GET /callejero/recorrido?calleId= — recorrido publicado (precomputado en BD)
   * de una calle accesible. El backend responde 404 ("Ruta no disponible") si no
   * hay ruta publicada; el front lo trata como estado DURO (D7), nunca como una
   * línea recta. `ignoreError = true`: el 404 es un estado esperado, lo gestiona
   * el componente (sin toast).
   */
  getRecorrido(calleId: number): Observable<RecorridoResponse> {
    return this.get(
      `/recorrido?calleId=${calleId}`,
      true,
    ) as Observable<RecorridoResponse>;
  }

  /**
   * GET /callejero/recorrido-libre?ciudadId=&q= — recorrido del parque más
   * cercano a una dirección de texto LIBRE (Callejero v27), resuelta por el
   * proxy de geocoding del backend. A diferencia de `getRecorrido`, va por
   * `_http` crudo (no por el wrapper `get`) ADREDE: el wrapper colapsa el
   * `HttpErrorResponse` en un `Error(message)` y perdería el `code` tipado del
   * cuerpo de error (404 `NO_GEOCODE` / 503 `ROUTE_UNAVAILABLE`). El padre
   * inspecciona `status`/`error.code` para elegir el mensaje (D7), así que el
   * error debe llegar intacto y sin toast genérico.
   */
  getRecorridoLibre(
    ciudadId: number,
    q: string,
  ): Observable<RecorridoLibreResponse> {
    const url =
      environment.apiUrl +
      this.controllerPrefix +
      `/recorrido-libre?ciudadId=${ciudadId}&q=${encodeURIComponent(q)}`;
    return this._http.get(url, {
      withCredentials: true,
    }) as Observable<RecorridoLibreResponse>;
  }

  // ── Modo Examen (Callejero v2 — Hito 2) ──────────────────────────────────

  /**
   * POST /callejero/examen/generar — genera un examen sobre el scope elegido.
   * `tipoExamen` por defecto `MIXTO` (no rompe llamadas existentes); pasar
   * `RECORRIDO` genera el examen "¿qué parque cubre esta calle?".
   */
  generarExamen(
    ciudadId: number,
    zonaIds: number[] = [],
    tipoExamen: TipoExamenCallejero = 'MIXTO',
    dificultad: DificultadCallejero = 'MEDIO',
  ): Observable<GenerarExamenResponse> {
    return this.post('/examen/generar', {
      ciudadId,
      zonaIds,
      tipoExamen,
      dificultad,
    }) as Observable<GenerarExamenResponse>;
  }

  /**
   * Atajo del examen de recorridos (Callejero v10): `generarExamen` con
   * `tipoExamen = 'RECORRIDO'`.
   */
  generarExamenRecorrido(
    ciudadId: number,
    zonaIds: number[] = [],
    dificultad: DificultadCallejero = 'MEDIO',
  ): Observable<GenerarExamenResponse> {
    return this.generarExamen(ciudadId, zonaIds, 'RECORRIDO', dificultad);
  }

  /** POST /callejero/examen/registrar — envía las respuestas y recibe la nota. */
  registrarExamen(dto: RegistrarExamenDto): Observable<ResultadoExamen> {
    return this.post('/examen/registrar', dto) as Observable<ResultadoExamen>;
  }

  /** GET /callejero/examen/historial — intentos del alumno (más reciente primero). */
  historialExamen(
    ciudadId?: number,
    page = 1,
  ): Observable<HistorialExamenResponse> {
    const params: string[] = [`page=${page}`];
    if (ciudadId != null) params.push(`ciudadId=${ciudadId}`);
    return this.get(
      `/examen/historial?${params.join('&')}`,
    ) as Observable<HistorialExamenResponse>;
  }

  /** GET /callejero/examen/leaderboard — ranking de la ciudad (cohorte oposición). */
  leaderboardExamen(ciudadId: number): Observable<LeaderboardResponse> {
    return this.get(
      `/examen/leaderboard?ciudadId=${ciudadId}`,
    ) as Observable<LeaderboardResponse>;
  }

  /** POST /callejero/examen/leaderboard-optin — mostrar/ocultar el nombre real propio. */
  setLeaderboardOptIn(optIn: boolean): Observable<{ optIn: boolean }> {
    return this.post('/examen/leaderboard-optin', { optIn }) as Observable<{
      optIn: boolean;
    }>;
  }
}
