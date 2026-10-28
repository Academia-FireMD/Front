import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { APLICACION_CODIGO_HIDRAULICA } from '../models/curso.model';
import { CursosAlumnoService } from './cursos-alumno.service';

/**
 * Puente entre el aula Angular y la aplicación autocontenida de Hidráulica
 * (bloque INTERACTIVO, 2026-10-28). El padre es el ÚNICO dueño de HTTP:
 *  - carga el HTML protegido como Blob (lo hace el componente),
 *  - carga el estado de la cuenta (`GET .../progreso/interactivo`),
 *  - recibe snapshots del iframe y los persiste (`PUT ...`) en serie,
 *  - mantiene una copia namespaced por cuenta+lección para fallos de red.
 *
 * El iframe NUNCA recibe el bearer ni habla con la API. Solo intercambia
 * mensajes estructurados validados por ventana, origen, contexto y requestId.
 */

export const HIDRAULICA_BRIDGE_TAG = 'tf-hidraulica-bridge';
export const HIDRAULICA_BRIDGE_VERSION = 1;
export const HIDRAULICA_APLICACION_CODIGO = APLICACION_CODIGO_HIDRAULICA;

export type HidraulicaSyncEstado =
  | 'loading'
  | 'saving'
  | 'saved'
  | 'pending'
  | 'error';

export interface HidraulicaSyncMensaje {
  estado: HidraulicaSyncEstado;
  texto: string;
}

export interface HidraulicaContexto {
  leccionId: number;
  bloqueId: number;
  aplicacionCodigo: string;
}

export interface HidraulicaCallbacks {
  publicarEstado: (mensaje: HidraulicaSyncMensaje) => void;
  publicarAltura: (px: number) => void;
}

export interface ControlHidraulicaInteractivo {
  reintentar(): void;
  destruir(): void;
}

interface Propietario {
  usuarioId: number;
  impersonando: boolean;
  leccionId: number;
}

interface CacheEstado {
  estado: Record<string, unknown>;
  revision: number;
  pending: boolean;
  updatedAt: number;
}

interface SnapshotPendiente {
  requestId: string;
  estado: Record<string, unknown>;
  ownerKey: string;
  generation: number;
}

const MAX_ESTADO_BYTES = 1024 * 1024;
const MAX_ID_LENGTH = 128;
const MAX_PROFUNDIDAD = 12;
const MAX_NODOS = 30000;
const MAX_ALTURA = 30000;
const MIN_ALTURA = 240;
const CLAVES_PROHIBIDAS = new Set(['__proto__', 'prototype', 'constructor']);

function esObjetoPlano(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototipo = Object.getPrototypeOf(value);
  return prototipo === Object.prototype || prototipo === null;
}

function esEnteroPositivo(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function esEnteroNoNegativo(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Identidad numérica segura desde el claim `sub` (string numérico o número). */
export function usuarioIdDeSubject(subject: unknown): number | null {
  const id =
    typeof subject === 'number'
      ? subject
      : typeof subject === 'string' && /^\d+$/.test(subject)
        ? Number(subject)
        : Number.NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Copia profunda solo de valores JSON, con presupuesto de nodos/profundidad y
 * sin claves de prototipo. Evita que un estado remoto/cache manipulado agote
 * la pila o contamine prototipos.
 */
function clonSeguro(
  value: unknown,
  profundidad = 0,
  presupuesto = { nodos: 0 },
): unknown {
  presupuesto.nodos += 1;
  if (profundidad > MAX_PROFUNDIDAD || presupuesto.nodos > MAX_NODOS) {
    throw new Error('Estado interactivo demasiado profundo o grande');
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Número no finito');
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => clonSeguro(item, profundidad + 1, presupuesto));
  }
  if (esObjetoPlano(value)) {
    const salida: Record<string, unknown> = {};
    for (const clave of Object.keys(value)) {
      if (CLAVES_PROHIBIDAS.has(clave)) continue;
      Object.defineProperty(salida, clave, {
        value: clonSeguro(value[clave], profundidad + 1, presupuesto),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return salida;
  }
  throw new Error('Tipo no serializable en el estado interactivo');
}

/**
 * Valida y normaliza un `S` v1 de Hidráulica. Conserva los campos compatibles
 * con la app (incluidos los anidados reales de pref/est/Clase) y solo repara
 * las secciones conocidas si llegan con un tipo inválido. Devuelve null si el
 * documento raíz no es un objeto v1 válido o supera 1 MiB.
 */
export function normalizarEstadoHidraulica(
  value: unknown,
): Record<string, unknown> | null {
  if (!esObjetoPlano(value) || value['v'] !== 1) return null;
  try {
    const copia = clonSeguro(value) as Record<string, unknown>;
    if (!esObjetoPlano(copia['hist'])) copia['hist'] = {};
    if (!Array.isArray(copia['sims'])) {
      copia['sims'] = [];
    } else {
      copia['sims'] = copia['sims'].slice(-50);
    }
    if (!esObjetoPlano(copia['pref'])) copia['pref'] = {};
    if (!esObjetoPlano(copia['est'])) {
      copia['est'] = { hist: {}, cards: {}, pref: {} };
    } else {
      const est = copia['est'];
      if (!esObjetoPlano(est['hist'])) est['hist'] = {};
      if (!esObjetoPlano(est['cards'])) est['cards'] = {};
      if (!esObjetoPlano(est['pref'])) est['pref'] = {};
    }
    if (!esObjetoPlano(copia['daily'])) {
      copia['daily'] = { goal: { p: 10, f: 15 }, days: {} };
    } else {
      const daily = copia['daily'];
      if (!esObjetoPlano(daily['goal'])) daily['goal'] = { p: 10, f: 15 };
      if (!esObjetoPlano(daily['days'])) daily['days'] = {};
    }
    copia['alumno'] =
      typeof copia['alumno'] === 'string' ? copia['alumno'].slice(0, 60) : '';
    if (copia['live'] != null && !esObjetoPlano(copia['live'])) {
      delete copia['live'];
    }
    const serializado = JSON.stringify(copia);
    const bytes =
      typeof TextEncoder === 'undefined'
        ? serializado.length
        : new TextEncoder().encode(serializado).byteLength;
    if (bytes > MAX_ESTADO_BYTES) return null;
    return copia;
  } catch {
    return null;
  }
}

/** Estado inicial EXACTO del contrato (nunca se comparte la misma referencia). */
export function estadoHidraulicaFresco(): Record<string, unknown> {
  return {
    v: 1,
    hist: {},
    sims: [],
    pref: {},
    est: { hist: {}, cards: {}, pref: {} },
    daily: { goal: { p: 10, f: 15 }, days: {} },
    alumno: '',
  };
}

export function claveCacheHidraulica(owner: Propietario): string {
  return `tf:hidraulica:progreso:v1:u${owner.usuarioId}:i${
    owner.impersonando ? 1 : 0
  }:l${owner.leccionId}`;
}

function leerCache(owner: Propietario): CacheEstado | null {
  try {
    const raw = window.localStorage.getItem(claveCacheHidraulica(owner));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!esObjetoPlano(parsed)) return null;
    const estado = normalizarEstadoHidraulica(parsed['estado']);
    if (!estado) return null;
    return {
      estado,
      revision: esEnteroNoNegativo(parsed['revision']) ? parsed['revision'] : 0,
      pending: parsed['pending'] === true,
      updatedAt: esEnteroNoNegativo(parsed['updatedAt'])
        ? parsed['updatedAt']
        : 0,
    };
  } catch {
    return null;
  }
}

function escribirCache(owner: Propietario, cache: CacheEstado): void {
  try {
    window.localStorage.setItem(
      claveCacheHidraulica(owner),
      JSON.stringify(cache),
    );
  } catch {
    // localStorage lleno/denegado: la app sigue funcionando en memoria.
  }
}

function borrarCache(owner: Propietario): void {
  try {
    window.localStorage.removeItem(claveCacheHidraulica(owner));
  } catch {
    // Sin almacenamiento disponible; nada que borrar.
  }
}

function esRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

@Injectable({ providedIn: 'root' })
export class HidraulicaInteractivoService {
  private readonly auth = inject(AuthService);
  private readonly service = inject(CursosAlumnoService);
  private secuencia = 0;

  connect(
    iframe: HTMLIFrameElement,
    contexto: HidraulicaContexto,
    callbacks: HidraulicaCallbacks,
  ): ControlHidraulicaInteractivo {
    const frameWindow = iframe.contentWindow;
    const origin = window.location.origin;
    const subscriptions = new Subscription();
    let propietario: Propietario | null = null;
    let contextId: string | null = null;
    let generation = 0;
    let frameReady = false;
    let cargando = false;
    let saving = false;
    let revision = 0;
    let startAllowed = true;
    let latest: SnapshotPendiente | null = null;
    let loadSub: Subscription | null = null;
    let saveSub: Subscription | null = null;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;
    let lastLoadFailed = false;
    let destroyed = false;

    const nuevoId = (prefijo: string): string => {
      this.secuencia += 1;
      const azar = Math.random().toString(36).slice(2, 10);
      return `${prefijo}-${Date.now().toString(36)}-${this.secuencia}-${azar}`.slice(
        0,
        MAX_ID_LENGTH,
      );
    };

    const publicar = (estado: HidraulicaSyncEstado, texto: string): void => {
      if (destroyed) return;
      callbacks.publicarEstado({ estado, texto });
    };

    const post = (tipo: string, datos: Record<string, unknown> = {}): void => {
      if (!frameWindow || destroyed) return;
      try {
        frameWindow.postMessage(
          {
            tf: HIDRAULICA_BRIDGE_TAG,
            v: HIDRAULICA_BRIDGE_VERSION,
            type: tipo,
            contextId,
            ...datos,
          },
          origin,
        );
      } catch {
        // El iframe puede estar navegando; el siguiente ready reinicia contexto.
      }
    };

    const limpiarTimers = (): void => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const cancelarOperaciones = (): void => {
      limpiarTimers();
      loadSub?.unsubscribe();
      loadSub = null;
      saveSub?.unsubscribe();
      saveSub = null;
      cargando = false;
      saving = false;
      latest = null;
      retryDelay = 2000;
    };

    const enviarInit = (
      estado: Record<string, unknown> | null,
      revisionInicial: number,
      puedeEmpezar: boolean,
    ): void => {
      startAllowed = puedeEmpezar;
      post('init', {
        requestId: nuevoId('init'),
        estado,
        revision: revisionInicial,
        startAllowed: puedeEmpezar,
      });
    };

    const programarReintento = (): void => {
      if (destroyed || retryTimer || !latest) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        publicar(
          'pending',
          'Sin conexión: tus cambios quedan pendientes en este dispositivo.',
        );
        return;
      }
      const espera = retryDelay;
      retryDelay = Math.min(retryDelay * 2, 30000);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        flush();
      }, espera);
    };

    const programarEnvio = (ms: number): void => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, ms);
    };

    const flush = (): void => {
      if (
        destroyed ||
        saving ||
        !latest ||
        !propietario ||
        !contextId ||
        cargando
      ) {
        return;
      }
      const snap = latest;
      const gen = generation;
      const owner = propietario;
      saving = true;
      publicar('saving', 'Guardando progreso…');

      saveSub = this.service
        .guardarProgresoInteractivo(contexto.leccionId, snap.estado)
        .subscribe({
          next: (respuesta) => {
            if (
              destroyed ||
              gen !== generation ||
              owner !== propietario ||
              snap.ownerKey !== claveCacheHidraulica(owner)
            ) {
              return;
            }
            saving = false;
            retryDelay = 2000;
            const accepted =
              normalizarEstadoHidraulica(respuesta.estado) ?? snap.estado;
            revision = esEnteroPositivo(respuesta.revision)
              ? respuesta.revision
              : revision + 1;
            const esUltimo = latest?.requestId === snap.requestId;
            const estadoCache = latest ? latest.estado : accepted;
            escribirCache(owner, {
              estado: estadoCache,
              revision,
              pending: !esUltimo,
              updatedAt: Date.now(),
            });
            post('ack', {
              requestId: snap.requestId,
              revision,
            });
            if (esUltimo) {
              latest = null;
              publicar('saved', 'Progreso guardado en tu cuenta.');
              return;
            }
            // Llegó un snapshot más nuevo mientras el PUT estaba en vuelo:
            // el ACK antiguo NO puede marcar pendiente=false ni "guardado".
            publicar(
              'pending',
              'Cambios pendientes de guardar; enviando la última versión.',
            );
            programarEnvio(0);
          },
          error: () => {
            if (destroyed || gen !== generation || owner !== propietario) {
              return;
            }
            saving = false;
            post('nack', { requestId: snap.requestId });
            publicar(
              'error',
              'No se pudo guardar el progreso. Reintentaremos al recuperar la conexión.',
            );
            programarReintento();
          },
        });
    };

    const usarCache = (cache: CacheEstado, owner: Propietario): void => {
      revision = cache.revision;
      if (cache.pending) {
        enviarInit(cache.estado, cache.revision, true);
        latest = {
          requestId: nuevoId('retry'),
          estado: cache.estado,
          ownerKey: claveCacheHidraulica(owner),
          generation,
        };
        publicar(
          'pending',
          'Cambios pendientes de guardar; reintentando la sincronización.',
        );
        programarEnvio(0);
        return;
      }
      enviarInit(cache.estado, cache.revision, true);
      publicar(
        'pending',
        'Sin conexión: mostrando el progreso guardado en este dispositivo.',
      );
    };

    const iniciarCarga = (): void => {
      if (destroyed || !frameReady || !propietario) return;
      const owner = propietario;
      generation += 1;
      const gen = generation;
      cancelarOperaciones();
      cargando = true;
      lastLoadFailed = false;
      contextId = contextId ?? nuevoId('hidraulica');
      publicar('loading', 'Cargando tu progreso…');

      const cache = leerCache(owner);
      loadSub = this.service
        .getProgresoInteractivo(contexto.leccionId)
        .subscribe({
          next: (respuesta) => {
            if (destroyed || gen !== generation || owner !== propietario) {
              return;
            }
            cargando = false;
            const estadoServidor = normalizarEstadoHidraulica(respuesta.estado);
            if (respuesta.estado != null && estadoServidor == null) {
              if (cache) {
                usarCache(cache, owner);
              } else {
                enviarInit(null, 0, false);
                publicar(
                  'error',
                  'El progreso recibido no es válido. No se ha sobrescrito nada.',
                );
              }
              return;
            }

            const revisionServidor = esEnteroNoNegativo(respuesta.revision)
              ? respuesta.revision
              : 0;

            if (estadoServidor) {
              revision = revisionServidor;
              if (cache?.pending) {
                usarCache(cache, owner);
                return;
              }
              escribirCache(owner, {
                estado: estadoServidor,
                revision: revisionServidor,
                pending: false,
                updatedAt: Date.now(),
              });
              enviarInit(estadoServidor, revisionServidor, true);
              publicar('saved', 'Progreso cargado.');
              return;
            }

            // Servidor responde null de forma autoritativa: no hay estado.
            if (cache?.pending) {
              usarCache(cache, owner);
              return;
            }
            revision = 0;
            borrarCache(owner);
            enviarInit(null, 0, true);
            publicar('saved', 'Sin progreso guardado todavía.');
          },
          error: () => {
            if (destroyed || gen !== generation || owner !== propietario) {
              return;
            }
            cargando = false;
            lastLoadFailed = true;
            if (cache) {
              usarCache(cache, owner);
              return;
            }
            enviarInit(null, 0, false);
            publicar(
              'error',
              'No se pudo cargar tu progreso. Reintenta para empezar.',
            );
          },
        });
      subscriptions.add(loadSub);
    };

    const manejarSnapshot = (data: Record<string, unknown>): void => {
      if (
        !propietario ||
        !contextId ||
        data['contextId'] !== contextId ||
        !esRequestId(data['requestId'])
      ) {
        return;
      }
      const estado = normalizarEstadoHidraulica(data['estado']);
      if (!estado) return;
      const owner = propietario;
      latest = {
        requestId: data['requestId'],
        estado,
        ownerKey: claveCacheHidraulica(owner),
        generation,
      };
      escribirCache(owner, {
        estado,
        revision,
        pending: true,
        updatedAt: Date.now(),
      });
      publicar('pending', 'Cambios pendientes de guardar.');
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      programarEnvio(500);
    };

    const manejarMensaje = (event: MessageEvent): void => {
      if (destroyed) return;
      if (event.origin !== origin) return;
      if (!frameWindow || event.source !== frameWindow) return;
      const data: unknown = event.data;
      if (!esObjetoPlano(data)) return;
      if (
        data['tf'] !== HIDRAULICA_BRIDGE_TAG ||
        data['v'] !== HIDRAULICA_BRIDGE_VERSION
      ) {
        return;
      }
      const tipo = data['type'];
      if (tipo === 'ready') {
        if (frameReady) return;
        frameReady = true;
        if (propietario) {
          iniciarCarga();
        } else {
          publicar('loading', 'Esperando la identidad de tu cuenta…');
        }
        return;
      }
      if (tipo === 'height') {
        const altura = data['height'];
        const contextoMensaje = data['contextId'];
        if (
          esEnteroPositivo(altura) &&
          (contextoMensaje == null || contextoMensaje === contextId)
        ) {
          callbacks.publicarAltura(
            Math.max(MIN_ALTURA, Math.min(MAX_ALTURA, altura)),
          );
        }
        return;
      }
      if (tipo === 'scrollTop') {
        if (data['contextId'] === contextId) {
          try {
            iframe.scrollIntoView({ block: 'start', inline: 'nearest' });
          } catch {
            // Navegador sin scrollIntoView: sin acción.
          }
        }
        return;
      }
      if (tipo === 'snapshot') {
        manejarSnapshot(data);
      }
    };

    const manejarOnline = (): void => {
      if (destroyed) return;
      if (latest) {
        flush();
      } else if (lastLoadFailed) {
        iniciarCarga();
      }
    };

    const manejarOffline = (): void => {
      if (destroyed || !latest) return;
      publicar(
        'pending',
        'Sin conexión: tus cambios quedan pendientes en este dispositivo.',
      );
    };

    window.addEventListener('message', manejarMensaje);
    window.addEventListener('online', manejarOnline);
    window.addEventListener('offline', manejarOffline);

    subscriptions.add(
      this.auth.currentIdentity$.subscribe((identidad) => {
        if (destroyed) return;
        const usuarioId = usuarioIdDeSubject(identidad?.sub);
        const impersonando = identidad?.isImpersonating === true;
        if (
          propietario &&
          propietario.usuarioId === usuarioId &&
          propietario.impersonando === impersonando
        ) {
          return;
        }

        // Cierra el contexto anterior ANTES de cualquier carga diferida: los
        // snapshots pendientes del dueño anterior ya están en su cache y no
        // deben viajar a la cuenta nueva.
        const contextoAnterior = contextId;
        if (contextoAnterior) {
          try {
            frameWindow?.postMessage(
              {
                tf: HIDRAULICA_BRIDGE_TAG,
                v: HIDRAULICA_BRIDGE_VERSION,
                type: 'close',
                contextId: contextoAnterior,
              },
              origin,
            );
          } catch {
            // Ignorado: el iframe se reemplaza en el cambio de lección.
          }
        }
        generation += 1;
        cancelarOperaciones();
        contextId = usuarioId ? nuevoId('hidraulica') : null;
        startAllowed = true;
        lastLoadFailed = false;

        propietario =
          usuarioId != null
            ? { usuarioId, impersonando, leccionId: contexto.leccionId }
            : null;

        if (!usuarioId) {
          publicar('error', 'Inicia sesión para cargar tu progreso.');
          return;
        }
        if (frameReady) {
          iniciarCarga();
        } else {
          publicar('loading', 'Cargando tu progreso…');
        }
      }),
    );

    publicar('loading', 'Cargando aplicación…');

    return {
      reintentar: (): void => {
        if (destroyed) return;
        if (!propietario) {
          publicar('error', 'Inicia sesión para cargar tu progreso.');
          return;
        }
        if (latest) {
          limpiarTimers();
          flush();
          return;
        }
        if (!frameReady) return;
        iniciarCarga();
      },
      destruir: (): void => {
        if (destroyed) return;
        const ultimoContexto = contextId;
        destroyed = true;
        generation += 1;
        cancelarOperaciones();
        subscriptions.unsubscribe();
        window.removeEventListener('message', manejarMensaje);
        window.removeEventListener('online', manejarOnline);
        window.removeEventListener('offline', manejarOffline);
        if (ultimoContexto) {
          try {
            frameWindow?.postMessage(
              {
                tf: HIDRAULICA_BRIDGE_TAG,
                v: HIDRAULICA_BRIDGE_VERSION,
                type: 'close',
                contextId: ultimoContexto,
              },
              origin,
            );
          } catch {
            // Ignorado: el iframe ya no existe.
          }
        }
      },
    };
  }
}
