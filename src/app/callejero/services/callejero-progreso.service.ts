import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  catchError,
  map,
  of,
  switchMap,
  take,
  takeUntil,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';

export type ModalidadEmbed = 'valencia' | 'alicante';
export type EstadoProgresoSync =
  | 'cargando'
  | 'listo'
  | 'guardando'
  | 'guardado'
  | 'pendiente'
  | 'error';

export interface ProgresoEmbed {
  modalidad: ModalidadEmbed;
  versionFormato: 1 | 2;
  revision: number;
  estado: Record<string, unknown> | null;
  actualizadoEn: string | null;
}

export interface ProgresoPreparado {
  modalidad: ModalidadEmbed;
  versionFormato: 1 | 2;
  revision: number;
  estado: Record<string, unknown>;
  guardado: boolean;
  origen: 'servidor' | 'importado' | 'cache' | 'nuevo' | 'legado';
}

export interface ProgresoSyncMensaje {
  estado: EstadoProgresoSync;
  texto: string;
}

interface CacheProgreso {
  versionFormato: 1 | 2;
  estado: Record<string, unknown>;
  pendiente: boolean;
  borradoPendiente?: boolean;
  accionPendiente?: 'put' | 'delete' | 'importar';
}

interface ReservaLegado {
  usuarioId: number;
  estado: 'pendiente' | 'importado' | 'reservado';
}

interface AccionOutbox {
  tipo: 'put' | 'delete' | 'importar';
  estado?: Record<string, unknown>;
  respuesta?: Subject<ProgresoPreparado>;
}

const MAX_ESTADO_BYTES = 5 * 1024 * 1024;
const PREFIJO_CACHE = 'tf_callejero_progreso_v1';
const PREFIJO_LEGADO = 'tf_callejero_progreso_legacy_v1';
const PREFIJO_PROPIETARIO = 'tf_callejero_progreso_legacy_owner_v1';
const ALICANTE_CATEGORIAS = new Set([
  'muni',
  'pedania',
  'urb',
  'sierra',
  'pico',
  'rio',
  'embalse',
  'portmont',
  'parque',
  'playa',
  'cabo',
  'punta',
  'isla',
  'puerto',
  'faro',
  'reserva',
  'via',
  'castillo',
  'cueva',
  'golf',
  'ocio',
  'hospital',
  'aero',
  'univ',
  'recreo',
]);
const ALICANTE_NIVELES = new Set(['facil', 'medio', 'dificil']);
const ALICANTE_MODOS = new Set(['ronda', 'fallos', 'repaso', 'sobre']);
const ALICANTE_TIPOS = new Set([
  'ident',
  'loc',
  'mun',
  'inv',
  'zona',
  'comarca',
  'rel',
  'vf',
  'tipo',
  'orden',
  'escribe',
  'odd',
  'utm',
  'dist',
  'cerca',
  'datos',
]);

function esObjetoPlano(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function serializarJsonSeguro(value: unknown): string | null {
  if (!esObjetoPlano(value)) return null;
  try {
    const pendientes: unknown[] = [value];
    const visitados = new WeakSet<object>();
    while (pendientes.length) {
      const actual = pendientes.pop();
      if (
        actual === null ||
        typeof actual === 'string' ||
        typeof actual === 'boolean'
      ) {
        continue;
      }
      if (typeof actual === 'number') {
        if (!Number.isFinite(actual)) return null;
        continue;
      }
      if (typeof actual !== 'object') return null;
      if (visitados.has(actual)) return null;
      visitados.add(actual);
      if (!Array.isArray(actual) && !esObjetoPlano(actual)) return null;
      for (const key of Object.keys(actual)) {
        if (
          key === '__proto__' ||
          key === 'prototype' ||
          key === 'constructor'
        ) {
          return null;
        }
        pendientes.push((actual as Record<string, unknown>)[key]);
      }
    }
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') return null;
    const bytes =
      typeof TextEncoder === 'undefined'
        ? unescape(encodeURIComponent(serialized)).length
        : new TextEncoder().encode(serialized).byteLength;
    return bytes <= MAX_ESTADO_BYTES ? serialized : null;
  } catch {
    return null;
  }
}

function copiarJsonSeguro(value: unknown): Record<string, unknown> | null {
  const serialized = serializarJsonSeguro(value);
  if (!serialized) return null;
  try {
    const copy: unknown = JSON.parse(serialized);
    return esObjetoPlano(copy) ? copy : null;
  } catch {
    return null;
  }
}

function objetoOEmpty(value: unknown): Record<string, unknown> | null {
  if (value === undefined) return {};
  return esObjetoPlano(value) ? value : null;
}

function clavesExactas(
  value: Record<string, unknown>,
  requeridas: string[],
  opcionales: string[] = [],
): boolean {
  const keys = Object.keys(value);
  return (
    requeridas.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => requeridas.includes(key) || opcionales.includes(key))
  );
}

function esCadena(value: unknown): value is string {
  return typeof value === 'string';
}

function esTextoNoVacio(value: unknown): value is string {
  return esCadena(value) && value.trim().length > 0;
}

function esContador(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function esTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function mensajeRechazoPermanente(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  if (error.status === 400) {
    return 'El servidor rechazó el formato del progreso (HTTP 400). No se aplicó la importación.';
  }
  if (error.status === 413) {
    return 'El progreso supera el límite admitido por el servidor (HTTP 413). No se aplicó la importación.';
  }
  return null;
}

class ProgresoRechazadoError extends Error {}

function esClaveItemAlicante(value: string): boolean {
  const separator = value.indexOf(':');
  return (
    separator > 0 &&
    ALICANTE_CATEGORIAS.has(value.slice(0, separator)) &&
    esTextoNoVacio(value.slice(separator + 1)) &&
    !/[\u0000-\u001f]/.test(value)
  );
}

function validarEstadoAlicante(estado: Record<string, unknown>): boolean {
  if (
    estado['v'] !== 2 ||
    !esTimestamp(estado['t']) ||
    !esObjetoPlano(estado['cats']) ||
    !Array.isArray(estado['hist']) ||
    estado['hist'].length > 20 ||
    !Number.isFinite(estado['best']) ||
    (estado['best'] as number) < 0 ||
    (estado['best'] as number) > 100 ||
    !esContador(estado['streak']) ||
    !esObjetoPlano(estado['items']) ||
    !esObjetoPlano(estado['fallos']) ||
    !esObjetoPlano(estado['superados']) ||
    !esObjetoPlano(estado['ciclo'])
  ) {
    return false;
  }

  const cats = estado['cats'];
  if (
    !Object.entries(cats).every(
      ([category, count]) =>
        ALICANTE_CATEGORIAS.has(category) &&
        esObjetoPlano(count) &&
        clavesExactas(count, ['ok', 'tot']) &&
        esContador(count['ok']) &&
        esContador(count['tot']) &&
        count['ok'] <= count['tot'],
    )
  ) {
    return false;
  }

  const historial = estado['hist'];
  if (
    !historial.every((entry) => {
      if (
        !esObjetoPlano(entry) ||
        !clavesExactas(entry, ['d', 'lv', 'ok', 'tot', 'pct'], ['mode']) ||
        !esCadena(entry['d']) ||
        !esCadena(entry['lv']) ||
        !ALICANTE_NIVELES.has(entry['lv']) ||
        !esContador(entry['ok']) ||
        !esContador(entry['tot']) ||
        entry['ok'] > entry['tot'] ||
        typeof entry['pct'] !== 'number' ||
        !Number.isFinite(entry['pct']) ||
        entry['pct'] < 0 ||
        entry['pct'] > 100
      ) {
        return false;
      }
      return (
        entry['mode'] === undefined ||
        (esCadena(entry['mode']) && ALICANTE_MODOS.has(entry['mode']))
      );
    })
  ) {
    return false;
  }

  const items = estado['items'];
  if (
    !Object.entries(items).every(
      ([key, value]) =>
        esClaveItemAlicante(key) &&
        Array.isArray(value) &&
        value.length === 3 &&
        esContador(value[0]) &&
        esContador(value[1]) &&
        value[1] <= value[0] &&
        esTimestamp(value[2]),
    )
  ) {
    return false;
  }

  const validarRegistro = (
    key: string,
    value: unknown,
    superado: boolean,
  ): boolean => {
    if (!esObjetoPlano(value)) return false;
    const required = superado
      ? ['id', 't', 'n', 'c', 'ko', 'u']
      : ['id', 't', 'n', 'c', 'ko', 'ok', 'f', 'u', 'p', 'r'];
    if (
      !clavesExactas(value, required) ||
      !esCadena(value['id']) ||
      !esClaveItemAlicante(value['id']) ||
      !esCadena(value['t']) ||
      !ALICANTE_TIPOS.has(value['t']) ||
      key !== `${value['id']}|${value['t']}` ||
      !esTextoNoVacio(value['n']) ||
      !esCadena(value['c']) ||
      !ALICANTE_CATEGORIAS.has(value['c']) ||
      !value['id'].startsWith(`${value['c']}:`) ||
      !esContador(value['ko']) ||
      value['ko'] < 1 ||
      !esTimestamp(value['u'])
    ) {
      return false;
    }
    if (superado) return true;
    return (
      esContador(value['ok']) &&
      value['ok'] < 5 &&
      esTimestamp(value['f']) &&
      esCadena(value['p']) &&
      esCadena(value['r'])
    );
  };

  const fallos = estado['fallos'];
  const superados = estado['superados'];
  if (
    !Object.entries(fallos).every(([key, value]) =>
      validarRegistro(key, value, false),
    ) ||
    !Object.entries(superados).every(([key, value]) =>
      validarRegistro(key, value, true),
    )
  ) {
    return false;
  }

  const ciclo = estado['ciclo'];
  const niveles = ['facil', 'medio', 'dificil'];
  return (
    Object.keys(ciclo).every((level) => niveles.includes(level)) &&
    Object.values(ciclo).every(
      (keys) =>
        Array.isArray(keys) &&
        keys.every((key) => esCadena(key) && esClaveItemAlicante(key)) &&
        new Set(keys).size === keys.length,
    )
  );
}

/** Valida JSON y da forma v17 al estado legado de Alicante sin truncar listas. */
export function normalizarEstadoEmbed(
  modalidad: ModalidadEmbed,
  raw: unknown,
): Record<string, unknown> | null {
  const copy = copiarJsonSeguro(raw);
  if (!copy) return null;

  if (modalidad === 'valencia') {
    if (!Object.hasOwn(copy, 'asked') || !Object.hasOwn(copy, 'fallos'))
      return null;
    const asked = objetoOEmpty(copy['asked']);
    const fallos = objetoOEmpty(copy['fallos']);
    if (!asked || !fallos) return null;
    return copiarJsonSeguro({ asked, fallos });
  }

  if (copy['v'] !== undefined && copy['v'] !== 2) return null;
  const cats = objetoOEmpty(copy['cats']);
  const hist = copy['hist'] === undefined ? [] : copy['hist'];
  const items = objetoOEmpty(copy['items']);
  const fallos = objetoOEmpty(copy['fallos']);
  const superados = objetoOEmpty(copy['superados']);
  const ciclo = objetoOEmpty(copy['ciclo']);
  const estado = {
    v: 2,
    t: copy['t'] === undefined ? 0 : copy['t'],
    cats,
    hist,
    best: copy['best'] === undefined ? 0 : copy['best'],
    streak: copy['streak'] === undefined ? 0 : copy['streak'],
    items,
    fallos,
    superados,
    ciclo,
  };
  if (
    !cats ||
    !items ||
    !fallos ||
    !superados ||
    !ciclo ||
    !validarEstadoAlicante(estado)
  ) {
    return null;
  }

  return copiarJsonSeguro(estado);
}

function estadoVacio(modalidad: ModalidadEmbed): Record<string, unknown> {
  return modalidad === 'valencia'
    ? { asked: {}, fallos: {} }
    : {
        v: 2,
        t: 0,
        cats: {},
        hist: [],
        best: 0,
        streak: 0,
        items: {},
        fallos: {},
        superados: {},
        ciclo: {},
      };
}

function mismaPractica(
  modalidad: ModalidadEmbed,
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const left = { ...a };
  const right = { ...b };
  if (modalidad === 'alicante') {
    delete left['t'];
    delete right['t'];
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

@Injectable({ providedIn: 'root' })
export class CallejeroProgresoService {
  private readonly http = inject(HttpClient);

  crearSesion(
    usuarioId: number,
    modalidad: ModalidadEmbed,
    identidadVigente: () => boolean = () => true,
  ): CallejeroProgresoSesion {
    return new CallejeroProgresoSesion(
      this.http,
      usuarioId,
      modalidad,
      identidadVigente,
    );
  }
}

/** Una sesión enlaza identidad + mapa; al cancelarla no aplica respuestas tardías. */
export class CallejeroProgresoSesion {
  private readonly cerrar$ = new Subject<void>();
  private readonly acciones = new Subscription();
  private readonly cambios = new BehaviorSubject<ProgresoSyncMensaje>({
    estado: 'cargando',
    texto: 'Cargando progreso de tu cuenta…',
  });
  readonly estado$ = this.cambios.asObservable();

  private activa = true;
  private preparado: ProgresoPreparado | null = null;
  private cache: CacheProgreso | null = null;
  private pendiente: AccionOutbox | null = null;
  private enVuelo = false;
  private cambiosLocales = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly http: HttpClient,
    readonly usuarioId: number,
    readonly modalidad: ModalidadEmbed,
    private readonly identidadVigente: () => boolean = () => true,
  ) {}

  private identidadActual(): boolean {
    try {
      return this.identidadVigente();
    } catch {
      return false;
    }
  }

  get versionFormato(): 1 | 2 {
    return this.modalidad === 'valencia' ? 1 : 2;
  }

  get hayPendientes(): boolean {
    return this.pendiente !== null || this.cache?.pendiente === true;
  }

  cargar(
    legado: unknown,
    almacenamientoDisponible: boolean,
    enImpersonacion: boolean,
  ): Observable<ProgresoPreparado> {
    if (!this.identidadActual()) {
      return throwError(() => new Error('La identidad de la sesión cambió.'));
    }
    const url = this.url();
    this.cambios.next({
      estado: 'cargando',
      texto: 'Cargando progreso de tu cuenta…',
    });
    return this.http.get<ProgresoEmbed>(url, { withCredentials: true }).pipe(
      take(1),
      takeUntil(this.cerrar$),
      switchMap((respuesta) =>
        this.identidadActual()
          ? this.resolverLectura(
              respuesta,
              legado,
              almacenamientoDisponible,
              enImpersonacion,
            )
          : throwError(() => new Error('La identidad de la sesión cambió.')),
      ),
      catchError((error: unknown) => {
        if (error instanceof ProgresoRechazadoError) {
          return throwError(() => error);
        }
        if (!this.identidadActual()) {
          return throwError(
            () => new Error('La identidad de la sesión cambió.'),
          );
        }
        const local = this.leerCache();
        const migracionPendienteEnImpersonacion =
          enImpersonacion &&
          ((local.cache?.pendiente === true &&
            local.cache.accionPendiente === 'importar') ||
            this.tieneReservaPendientePropia());
        if (migracionPendienteEnImpersonacion) {
          this.cambios.next({
            estado: 'error',
            texto:
              'No se pudo cargar el progreso remoto durante la impersonación.',
          });
          return throwError(() => error);
        }
        if (local.error) {
          return throwError(
            () => new Error('No se pudo acceder a la caché de progreso.'),
          );
        }
        if (local.cache) {
          this.cache = local.cache;
          if (local.cache.pendiente) {
            this.pendiente = this.restaurarAccion(local.cache);
          }
          const prepared = this.prepararResultado(
            local.cache.estado,
            false,
            'cache',
            0,
          );
          this.cambios.next({
            estado: local.cache.pendiente ? 'pendiente' : 'listo',
            texto: local.cache.pendiente
              ? 'Sin conexión: progreso pendiente de sincronizar.'
              : 'Sin conexión: se usa el progreso asociado a esta cuenta.',
          });
          return of(prepared);
        }
        const reserva = this.leerReservaPendiente();
        if (reserva?.estado) {
          const prepared = this.prepararResultado(
            reserva.estado,
            false,
            'legado',
            0,
          );
          this.cache = {
            versionFormato: this.versionFormato,
            estado: reserva.estado,
            pendiente: true,
            accionPendiente: 'importar',
          };
          this.escribirCache(this.cache, 'importar');
          this.pendiente = { tipo: 'importar', estado: reserva.estado };
          this.cambios.next({
            estado: 'pendiente',
            texto: 'Sin conexión: progreso pendiente de sincronizar.',
          });
          return of(prepared);
        }
        this.cambios.next({
          estado: 'error',
          texto: 'No se pudo cargar el progreso. Reintenta para continuar.',
        });
        return throwError(() => error);
      }),
    );
  }

  private resolverLectura(
    respuesta: ProgresoEmbed,
    legado: unknown,
    almacenamientoDisponible: boolean,
    enImpersonacion: boolean,
  ): Observable<ProgresoPreparado> {
    if (!this.identidadActual()) {
      return throwError(() => new Error('La identidad de la sesión cambió.'));
    }
    if (!this.esRespuestaValida(respuesta)) {
      return throwError(
        () =>
          new ProgresoRechazadoError(
            'El servidor devolvió una respuesta de progreso inválida.',
          ),
      );
    }

    const local = this.leerCache();
    const existeRemoto = respuesta.revision > 0 || respuesta.estado !== null;

    // En impersonación, una reserva pendiente identifica estado legado del
    // propietario real. Solo se permite presentar la fila remota (si existe);
    // nunca se adopta ni se convierte ese estado en una escritura.
    const migracionPendienteEnImpersonacion =
      enImpersonacion &&
      ((local.cache?.pendiente === true &&
        local.cache.accionPendiente === 'importar') ||
        this.tieneReservaPendientePropia());
    if (migracionPendienteEnImpersonacion) {
      const estado = existeRemoto
        ? respuesta.estado === null
          ? estadoVacio(this.modalidad)
          : normalizarEstadoEmbed(this.modalidad, respuesta.estado)
        : estadoVacio(this.modalidad);
      if (!estado) {
        return throwError(
          () =>
            new ProgresoRechazadoError(
              'El estado remoto tiene un formato inválido.',
            ),
        );
      }
      const preparado = this.prepararResultado(
        estado,
        existeRemoto,
        existeRemoto ? 'servidor' : 'nuevo',
        respuesta.revision,
      );
      this.cambios.next(
        existeRemoto
          ? { estado: 'guardado', texto: 'Guardado en tu cuenta.' }
          : {
              estado: 'listo',
              texto: 'No hay progreso remoto disponible para esta sesión.',
            },
      );
      return of(preparado);
    }

    // Un import con ACK perdido conserva su acción POST durable. Aunque el GET
    // ya encuentre una fila, el endpoint de importar decide sin sobrescribirla.
    if (local.cache?.pendiente && local.cache.accionPendiente === 'importar') {
      let estado = local.cache.estado;
      let origen: ProgresoPreparado['origen'] = 'legado';
      if (existeRemoto) {
        this.reservarPropietarioLegado(enImpersonacion);
        const remoto =
          respuesta.estado === null
            ? estadoVacio(this.modalidad)
            : normalizarEstadoEmbed(this.modalidad, respuesta.estado);
        if (!remoto) {
          return throwError(
            () =>
              new ProgresoRechazadoError(
                'El estado remoto tiene un formato inválido.',
              ),
          );
        }
        estado = remoto;
        origen = 'servidor';
      }
      this.cache = {
        versionFormato: this.versionFormato,
        estado,
        pendiente: true,
        accionPendiente: 'importar',
      };
      this.escribirCache(this.cache, 'importar');
      this.pendiente = { tipo: 'importar', estado: local.cache.estado };
      const prepared = this.prepararResultado(
        estado,
        existeRemoto,
        origen,
        respuesta.revision,
      );
      this.cambios.next({
        estado: 'pendiente',
        texto: 'Sin conexión: progreso pendiente de sincronizar.',
      });
      this.reintentar();
      return of(prepared);
    }

    if (local.cache?.pendiente) {
      this.cache = local.cache;
      this.pendiente = this.restaurarAccion(local.cache);
      const prepared = this.prepararResultado(
        local.cache.estado,
        false,
        'cache',
        respuesta.revision,
      );
      this.cambios.next({
        estado: 'pendiente',
        texto: 'Sin conexión: progreso pendiente de sincronizar.',
      });
      this.reintentar();
      return of(prepared);
    }

    // Una fila del servidor (también una fila vacía tras reset) siempre prevalece sobre el legado.
    if (existeRemoto) {
      this.reservarPropietarioLegado(enImpersonacion);
      const estado =
        respuesta.estado === null
          ? estadoVacio(this.modalidad)
          : normalizarEstadoEmbed(this.modalidad, respuesta.estado);
      if (!estado) {
        return throwError(
          () =>
            new ProgresoRechazadoError(
              'El estado remoto tiene un formato inválido.',
            ),
        );
      }
      this.cache = {
        versionFormato: this.versionFormato,
        estado,
        pendiente: false,
      };
      this.escribirCache(this.cache);
      const prepared = this.prepararResultado(
        estado,
        true,
        'servidor',
        respuesta.revision,
      );
      this.cambios.next({
        estado: 'guardado',
        texto: 'Guardado en tu cuenta.',
      });
      return of(prepared);
    }

    if (local.error)
      return throwError(
        () => new Error('No se pudo acceder a la caché de progreso.'),
      );

    const localState = local.cache?.estado ?? null;
    if (enImpersonacion) {
      // Una caché normal de esta cuenta puede seguir usándose como práctica,
      // pero no se inspecciona ni reserva el namespace legado.
      const estado = localState ?? estadoVacio(this.modalidad);
      const preparado = this.prepararResultado(
        estado,
        false,
        localState ? 'cache' : 'nuevo',
        respuesta.revision,
      );
      this.cambios.next({
        estado: 'listo',
        texto: localState
          ? 'Progreso preparado desde la caché de esta cuenta.'
          : 'No hay progreso remoto disponible para esta sesión.',
      });
      return of(preparado);
    }

    // Si el storage del iframe está bloqueado, la copia legacy no es legible.
    // Aun así se puede restaurar una caché propia de esta cuenta y reservar el
    // namespace vacío desde el storage de la app para que otra cuenta no adopte
    // progreso escrito tras esta asociación.
    const reserva = this.reservarLegado(
      almacenamientoDisponible ? legado : null,
      localState,
      enImpersonacion,
    );
    if (reserva.error) return throwError(() => new Error(reserva.error));
    if (!reserva.estado) {
      const empty = estadoVacio(this.modalidad);
      this.cache = {
        versionFormato: this.versionFormato,
        estado: empty,
        pendiente: false,
      };
      this.escribirCache(this.cache);
      const prepared = this.prepararResultado(
        empty,
        false,
        'nuevo',
        respuesta.revision,
      );
      this.cambios.next({
        estado: 'listo',
        texto:
          'Progreso preparado; todavía no se ha guardado ningún cambio en tu cuenta.',
      });
      return of(prepared);
    }

    this.cambios.next({
      estado: 'guardando',
      texto: 'Migrando el progreso existente a tu cuenta…',
    });
    return this.http
      .post<
        ProgresoEmbed & { importado: boolean }
      >(`${this.url()}/importar`, { versionFormato: this.versionFormato, estado: reserva.estado }, { withCredentials: true })
      .pipe(
        take(1),
        takeUntil(this.cerrar$),
        map((importada) => {
          if (!this.identidadActual()) {
            throw new Error('La identidad de la sesión cambió.');
          }
          const estado =
            importada.estado === null
              ? estadoVacio(this.modalidad)
              : normalizarEstadoEmbed(this.modalidad, importada.estado);
          if (
            !this.esRespuestaValida(importada) ||
            typeof importada.importado !== 'boolean' ||
            !estado
          ) {
            throw new ProgresoRechazadoError(
              'La respuesta de importación tiene un formato inválido.',
            );
          }
          this.marcarReserva('importado');
          this.cache = {
            versionFormato: this.versionFormato,
            estado,
            pendiente: false,
          };
          this.escribirCache(this.cache);
          const origen = importada.importado ? 'importado' : 'servidor';
          const prepared = this.prepararResultado(
            estado,
            true,
            origen,
            importada.revision,
          );
          this.cambios.next({
            estado: 'guardado',
            texto: 'Progreso migrado y guardado en tu cuenta.',
          });
          return prepared;
        }),
        catchError((error: unknown) => {
          if (!this.identidadActual()) return throwError(() => error);
          if (error instanceof ProgresoRechazadoError) {
            this.cambios.next({ estado: 'error', texto: error.message });
            return throwError(() => error);
          }
          const rechazoPermanente = mensajeRechazoPermanente(error);
          if (rechazoPermanente) {
            this.cambios.next({ estado: 'error', texto: rechazoPermanente });
            return throwError(
              () => new ProgresoRechazadoError(rechazoPermanente),
            );
          }
          this.cache = {
            versionFormato: this.versionFormato,
            estado: reserva.estado!,
            pendiente: true,
            accionPendiente: 'importar',
          };
          this.escribirCache(this.cache, 'importar');
          this.pendiente = { tipo: 'importar', estado: reserva.estado! };
          const prepared = this.prepararResultado(
            reserva.estado!,
            false,
            'legado',
            respuesta.revision,
          );
          this.cambios.next({
            estado: 'pendiente',
            texto: 'Sin conexión: progreso pendiente de sincronizar.',
          });
          return of(prepared);
        }),
      );
  }

  private reservarLegado(
    legado: unknown,
    cacheState: Record<string, unknown> | null,
    enImpersonacion: boolean,
  ): { estado: Record<string, unknown> | null; error?: string } {
    const rawReserva = this.leerStorage(this.clavePropietario());
    if (!rawReserva.disponible)
      return {
        estado: null,
        error: 'No se pudo reservar el legado en el almacenamiento local.',
      };
    let reserva: ReservaLegado | null = null;
    if (rawReserva.valor !== null) {
      try {
        const parsed = JSON.parse(rawReserva.valor) as Partial<ReservaLegado>;
        if (
          Number.isInteger(parsed.usuarioId) &&
          (parsed.estado === 'pendiente' ||
            parsed.estado === 'importado' ||
            parsed.estado === 'reservado')
        ) {
          reserva = parsed as ReservaLegado;
        } else {
          return {
            estado: null,
            error: 'El marcador de propietario del legado no es válido.',
          };
        }
      } catch {
        return {
          estado: null,
          error: 'El marcador de propietario del legado no es válido.',
        };
      }
    }

    if (reserva && reserva.usuarioId !== this.usuarioId)
      return { estado: null };
    if (reserva?.estado === 'importado') return { estado: null };
    if (enImpersonacion && !reserva) return { estado: cacheState };

    if (reserva?.estado === 'pendiente') {
      const backup = this.leerStorage(this.claveLegado());
      if (!backup.disponible)
        return {
          estado: null,
          error: 'No se pudo leer el respaldo de progreso reservado.',
        };
      if (backup.valor === null)
        return {
          estado: null,
          error: 'Falta el respaldo de progreso reservado.',
        };
      try {
        const canonical = normalizarEstadoEmbed(
          this.modalidad,
          JSON.parse(backup.valor),
        );
        return { estado: canonical };
      } catch {
        return {
          estado: null,
          error: 'El respaldo reservado no tiene un formato válido.',
        };
      }
    }

    const state = cacheState ?? normalizarEstadoEmbed(this.modalidad, legado);
    if (!state) {
      // Al primer GET ausente se reserva también el caso vacío: desde este
      // momento el localStorage genérico puede empezar a contener progreso
      // de esa cuenta y no debe convertirse en legado de otro usuario.
      if (!reserva && !enImpersonacion) {
        const marker: ReservaLegado = {
          usuarioId: this.usuarioId,
          estado: 'reservado',
        };
        if (
          !this.escribirStorage(this.clavePropietario(), JSON.stringify(marker))
        ) {
          return {
            estado: null,
            error: 'No se pudo reservar el propietario del legado.',
          };
        }
      }
      return { estado: null };
    }
    const backupKey = this.claveLegado();
    const backupJson = JSON.stringify(state);
    if (!this.escribirStorage(backupKey, backupJson)) {
      return {
        estado: null,
        error: 'No se pudo conservar el respaldo legado.',
      };
    }
    const marker: ReservaLegado = {
      usuarioId: this.usuarioId,
      estado: 'pendiente',
    };
    if (
      !this.escribirStorage(this.clavePropietario(), JSON.stringify(marker))
    ) {
      return {
        estado: null,
        error: 'No se pudo reservar el propietario del legado.',
      };
    }
    return { estado: state };
  }

  private marcarReserva(estado: ReservaLegado['estado']): void {
    const reserva = {
      usuarioId: this.usuarioId,
      estado,
    } satisfies ReservaLegado;
    this.escribirStorage(this.clavePropietario(), JSON.stringify(reserva));
  }

  private reservarPropietarioLegado(enImpersonacion: boolean): void {
    if (enImpersonacion) return;
    const storage = this.leerStorage(this.clavePropietario());
    if (!storage.disponible || storage.valor !== null) return;
    const reserva: ReservaLegado = {
      usuarioId: this.usuarioId,
      estado: 'reservado',
    };
    this.escribirStorage(this.clavePropietario(), JSON.stringify(reserva));
  }

  guardar(raw: unknown): void {
    if (!this.activa || !this.preparado) return;
    const estado = normalizarEstadoEmbed(this.modalidad, raw);
    if (!estado) {
      this.cambios.next({
        estado: 'error',
        texto: 'No se guardó el progreso: el formato recibido no es válido.',
      });
      return;
    }
    if (
      mismaPractica(this.modalidad, estado, this.preparado.estado) &&
      !this.hayPendientes
    ) {
      return;
    }
    this.cambiosLocales += 1;
    this.preparado = { ...this.preparado, estado };
    this.cache = {
      versionFormato: this.versionFormato,
      estado,
      pendiente: true,
      accionPendiente: 'put',
    };
    this.pendiente = { tipo: 'put', estado };
    this.escribirCache(this.cache, 'put');
    this.cambios.next({
      estado: 'guardando',
      texto: 'Guardando progreso en tu cuenta…',
    });
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.drenar();
    }, 500);
  }

  borrar(): Observable<ProgresoPreparado> {
    if (!this.activa)
      return throwError(() => new Error('La sesión de progreso está cerrada.'));
    this.cambiosLocales += 1;
    const estado = estadoVacio(this.modalidad);
    this.preparado = this.prepararResultado(
      estado,
      false,
      'nuevo',
      this.preparado?.revision ?? 0,
    );
    this.cache = {
      versionFormato: this.versionFormato,
      estado,
      pendiente: true,
      borradoPendiente: true,
      accionPendiente: 'delete',
    };
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    const respuesta = new Subject<ProgresoPreparado>();
    this.pendiente = { tipo: 'delete', respuesta };
    this.escribirCache(this.cache, 'delete');
    this.cambios.next({
      estado: 'guardando',
      texto: 'Borrando el progreso de tu cuenta…',
    });
    this.drenar();
    return respuesta.asObservable().pipe(takeUntil(this.cerrar$));
  }

  reintentar(): void {
    if (!this.activa || !this.pendiente || this.enVuelo) return;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.drenar();
  }

  refrescar(examenActivo: boolean): Observable<ProgresoPreparado> {
    if (!this.activa || examenActivo || this.hayPendientes || this.enVuelo) {
      return of(this.preparado).pipe(
        switchMap((prepared) =>
          prepared
            ? of(prepared)
            : throwError(() => new Error('Progreso aún no preparado.')),
        ),
      );
    }
    if (!this.identidadActual()) {
      return throwError(() => new Error('La identidad de la sesión cambió.'));
    }
    const cambiosLocales = this.cambiosLocales;
    return this.http
      .get<ProgresoEmbed>(this.url(), { withCredentials: true })
      .pipe(
        take(1),
        takeUntil(this.cerrar$),
        map((remote) => {
          if (!this.identidadActual()) {
            throw new Error('La identidad de la sesión cambió.');
          }
          if (!this.esRespuestaValida(remote)) {
            throw new ProgresoRechazadoError(
              'El servidor devolvió una respuesta de progreso inválida.',
            );
          }
          if (cambiosLocales !== this.cambiosLocales || this.hayPendientes) {
            if (!this.preparado) throw new Error('Progreso aún no preparado.');
            return this.preparado;
          }
          if (remote.revision === 0) return this.preparado!;
          const state =
            remote.estado === null
              ? estadoVacio(this.modalidad)
              : normalizarEstadoEmbed(this.modalidad, remote.estado);
          if (!state) {
            throw new ProgresoRechazadoError(
              'El estado remoto tiene un formato inválido.',
            );
          }
          this.cache = {
            versionFormato: this.versionFormato,
            estado: state,
            pendiente: false,
          };
          this.escribirCache(this.cache);
          this.preparado = this.prepararResultado(
            state,
            true,
            'servidor',
            remote.revision,
          );
          this.cambios.next({
            estado: 'guardado',
            texto: 'Guardado en tu cuenta.',
          });
          return this.preparado;
        }),
      );
  }

  cancelar(): void {
    if (!this.activa) return;
    this.activa = false;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.cerrar$.next();
    this.cerrar$.complete();
    this.acciones.unsubscribe();
    this.cambios.complete();
  }

  private drenar(): void {
    if (!this.activa || this.enVuelo || !this.pendiente) return;
    if (!this.identidadActual()) {
      this.cancelar();
      return;
    }
    const action = this.pendiente;
    this.pendiente = null;
    this.enVuelo = true;
    const request =
      action.tipo === 'delete'
        ? this.http.delete<ProgresoEmbed>(this.url(), { withCredentials: true })
        : action.tipo === 'importar'
          ? this.http.post<ProgresoEmbed & { importado: boolean }>(
              `${this.url()}/importar`,
              { versionFormato: this.versionFormato, estado: action.estado },
              { withCredentials: true },
            )
          : this.http.put<ProgresoEmbed>(
              this.url(),
              { versionFormato: this.versionFormato, estado: action.estado },
              { withCredentials: true },
            );
    const subscription = request
      .pipe(take(1), takeUntil(this.cerrar$))
      .subscribe({
        next: (response) => {
          this.enVuelo = false;
          if (!this.identidadActual()) {
            this.requeue(action);
            this.cancelar();
            return;
          }
          if (
            !this.esRespuestaValida(response) ||
            (action.tipo === 'importar' &&
              (!('importado' in response) ||
                typeof response.importado !== 'boolean'))
          ) {
            const error = new ProgresoRechazadoError(
              'El servidor devolvió una respuesta de progreso inválida.',
            );
            this.cambios.next({ estado: 'error', texto: error.message });
            action.respuesta?.error(error);
            return;
          }
          const empty = estadoVacio(this.modalidad);
          const state =
            response.estado === null
              ? empty
              : normalizarEstadoEmbed(this.modalidad, response.estado);
          if (!state) {
            const error = new ProgresoRechazadoError(
              'El estado de respuesta del servidor tiene un formato inválido.',
            );
            this.cambios.next({ estado: 'error', texto: error.message });
            action.respuesta?.error(error);
            return;
          }
          if (action.tipo === 'importar' || action.tipo === 'delete') {
            this.marcarReserva('importado');
          }
          const current =
            action.tipo === 'delete'
              ? empty
              : action.tipo === 'importar'
                ? state
                : (this.cache?.estado ?? action.estado ?? state);
          const hasNewer = this.pendiente !== null;
          if (!hasNewer) {
            this.cache = {
              versionFormato: this.versionFormato,
              estado: current,
              pendiente: false,
            };
            this.escribirCache(this.cache);
            this.preparado = this.prepararResultado(
              current,
              true,
              action.tipo === 'importar' ? 'importado' : 'servidor',
              response.revision,
            );
            this.cambios.next({
              estado: 'guardado',
              texto: 'Guardado en tu cuenta.',
            });
            if (action.respuesta) {
              action.respuesta.next(this.preparado);
              action.respuesta.complete();
            }
          }
          if (this.pendiente) this.drenar();
        },
        error: (error: unknown) => {
          this.enVuelo = false;
          if (!this.identidadActual()) {
            this.requeue(action);
            this.cancelar();
            return;
          }
          const rechazoPermanente = mensajeRechazoPermanente(error);
          if (rechazoPermanente) {
            this.cambios.next({ estado: 'error', texto: rechazoPermanente });
            action.respuesta?.error(new Error(rechazoPermanente));
            return;
          }
          this.requeue(action);
          this.cambios.next({
            estado: 'pendiente',
            texto: 'Sin conexión: progreso pendiente de sincronizar.',
          });
        },
      });
    this.acciones.add(subscription);
  }

  private requeue(action: AccionOutbox): void {
    if (this.pendiente) return;
    this.pendiente = action;
    if (this.cache) {
      this.cache = {
        ...this.cache,
        pendiente: true,
        borradoPendiente: action.tipo === 'delete',
        accionPendiente: action.tipo,
      };
      this.escribirCache(this.cache, action.tipo);
    }
  }

  private prepararResultado(
    estado: Record<string, unknown>,
    guardado: boolean,
    origen: ProgresoPreparado['origen'],
    revision: number,
  ): ProgresoPreparado {
    const result: ProgresoPreparado = {
      modalidad: this.modalidad,
      versionFormato: this.versionFormato,
      revision,
      estado,
      guardado,
      origen,
    };
    this.preparado = result;
    return result;
  }

  private esRespuestaValida(respuesta: ProgresoEmbed): boolean {
    return Boolean(
      respuesta &&
      typeof respuesta === 'object' &&
      respuesta.modalidad === this.modalidad &&
      respuesta.versionFormato === this.versionFormato &&
      Number.isInteger(respuesta.revision) &&
      respuesta.revision >= 0,
    );
  }

  private restaurarAccion(cache: CacheProgreso): AccionOutbox {
    const tipo =
      cache.accionPendiente ?? (cache.borradoPendiente ? 'delete' : 'put');
    return tipo === 'delete' ? { tipo } : { tipo, estado: cache.estado };
  }

  private leerCache(): { cache: CacheProgreso | null; error: boolean } {
    const storage = this.leerStorage(this.claveCache());
    if (!storage.disponible) return { cache: null, error: true };
    if (storage.valor === null) return { cache: null, error: false };
    try {
      const parsed = JSON.parse(storage.valor) as Partial<CacheProgreso>;
      const estado = normalizarEstadoEmbed(this.modalidad, parsed.estado);
      const accion = parsed.accionPendiente;
      if (
        parsed.versionFormato !== this.versionFormato ||
        typeof parsed.pendiente !== 'boolean' ||
        (accion !== undefined &&
          accion !== 'put' &&
          accion !== 'delete' &&
          accion !== 'importar') ||
        !estado
      ) {
        return { cache: null, error: true };
      }
      return {
        cache: {
          versionFormato: this.versionFormato,
          estado,
          pendiente: parsed.pendiente,
          borradoPendiente: parsed.borradoPendiente === true,
          accionPendiente: parsed.pendiente
            ? (accion ?? (parsed.borradoPendiente === true ? 'delete' : 'put'))
            : undefined,
        },
        error: false,
      };
    } catch {
      return { cache: null, error: true };
    }
  }

  private leerReservaPendiente(): { estado: Record<string, unknown> } | null {
    const storage = this.leerStorage(this.clavePropietario());
    if (!storage.disponible || !storage.valor) return null;
    try {
      const reserve = JSON.parse(storage.valor) as ReservaLegado;
      if (
        reserve.usuarioId !== this.usuarioId ||
        reserve.estado !== 'pendiente'
      )
        return null;
      const backup = this.leerStorage(this.claveLegado());
      if (!backup.disponible || !backup.valor) return null;
      const estado = normalizarEstadoEmbed(
        this.modalidad,
        JSON.parse(backup.valor),
      );
      return estado ? { estado } : null;
    } catch {
      return null;
    }
  }

  private tieneReservaPendientePropia(): boolean {
    const storage = this.leerStorage(this.clavePropietario());
    if (!storage.disponible || storage.valor === null) return false;
    try {
      const reserva = JSON.parse(storage.valor) as Partial<ReservaLegado>;
      return (
        reserva.usuarioId === this.usuarioId && reserva.estado === 'pendiente'
      );
    } catch {
      return false;
    }
  }

  private escribirCache(
    cache: CacheProgreso,
    accion?: AccionOutbox['tipo'],
  ): boolean {
    const persisted: CacheProgreso = { ...cache };
    if (cache.pendiente) {
      persisted.accionPendiente =
        accion ??
        cache.accionPendiente ??
        (cache.borradoPendiente ? 'delete' : 'put');
    } else {
      delete persisted.accionPendiente;
    }
    return this.escribirStorage(this.claveCache(), JSON.stringify(persisted));
  }

  private leerStorage(key: string): {
    disponible: boolean;
    valor: string | null;
  } {
    try {
      return { disponible: true, valor: localStorage.getItem(key) };
    } catch {
      return { disponible: false, valor: null };
    }
  }

  private escribirStorage(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private claveCache(): string {
    return `${PREFIJO_CACHE}:${this.usuarioId}:${this.modalidad}`;
  }

  private claveLegado(): string {
    return `${PREFIJO_LEGADO}:${this.usuarioId}:${this.modalidad}`;
  }

  private clavePropietario(): string {
    return `${PREFIJO_PROPIETARIO}:${this.modalidad}`;
  }

  private url(): string {
    return `${environment.apiUrl}/callejero/mi-progreso/${this.modalidad}`;
  }
}
