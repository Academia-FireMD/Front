import { Injectable, inject } from '@angular/core';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { AuthService, CurrentAuthIdentity } from '../../services/auth.service';
import {
  CallejeroProgresoService,
  CallejeroProgresoSesion,
  ModalidadEmbed,
  ProgresoPreparado,
  ProgresoSyncMensaje,
  normalizarEstadoEmbed,
} from './callejero-progreso.service';

const APP_ATLAS = 'tf-atlas';
const VERSION_ATLAS = 2;
const MAX_ID = 128;
const TIPOS_EMBED = new Set([
  'tf-atlas:cargar',
  'tf-atlas:progreso',
  'tf-atlas:borrado',
  'tf-atlas:actividad',
]);

export interface ControlProgresoEmbed {
  reintentar(): void;
  destruir(): void;
}

function esObjeto(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function esId(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= MAX_ID
  );
}

function usuarioIdDeSubject(subject: unknown): number | null {
  const id =
    typeof subject === 'number'
      ? subject
      : typeof subject === 'string' && /^\d+$/.test(subject)
        ? Number(subject)
        : Number.NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function tieneClavesExactas(
  data: Record<string, unknown>,
  claves: string[],
): boolean {
  const actual = Object.keys(data).sort();
  return (
    actual.length === claves.length &&
    actual.join('|') === [...claves].sort().join('|')
  );
}

@Injectable({ providedIn: 'root' })
export class CallejeroProgresoAdapterService {
  private readonly auth = inject(AuthService);
  private readonly progreso = inject(CallejeroProgresoService);
  private secuencia = 0;

  connect(
    iframe: HTMLIFrameElement,
    modalidad: ModalidadEmbed,
    publicarEstado: (estado: ProgresoSyncMensaje) => void,
  ): ControlProgresoEmbed {
    const frameWindow = iframe.contentWindow;
    const origin = window.location.origin;
    const subscriptions = new Subscription();
    let sesion: CallejeroProgresoSesion | null = null;
    let userId: number | null = null;
    let isImpersonating = false;
    let frameLoaded = false;
    let contexto: string | null = null;
    let loadRequestId: string | null = null;
    let resetRequestId: string | null = null;
    let legacy: unknown = null;
    let storageAvailable = false;
    let examActive = false;
    let prepared = false;
    let loadingSubscription: Subscription | null = null;
    let sessionStatusSubscription: Subscription | null = null;

    const newId = (prefix: string): string => {
      this.secuencia += 1;
      const random = Math.random().toString(36).slice(2, 12);
      return `${prefix}-${Date.now().toString(36)}-${this.secuencia}-${random}`.slice(
        0,
        MAX_ID,
      );
    };

    const build = modalidad === 'alicante' ? '17 (23-10-2026)' : '32';

    const enviar = (message: Record<string, unknown>): void => {
      if (!frameWindow || !contexto) return;
      try {
        frameWindow.postMessage(
          {
            app: APP_ATLAS,
            version: VERSION_ATLAS,
            build,
            modalidad,
            contexto,
            ...message,
          },
          origin,
        );
      } catch {
        // El iframe puede estar navegando; su siguiente load inicia un contexto nuevo.
      }
    };

    const publicar = (estado: ProgresoSyncMensaje): void => {
      publicarEstado(estado);
      enviar({
        type: 'tf-atlas:sincronizacion',
        estado: estado.estado,
        texto: estado.texto,
      });
    };

    const enviarPreparado = (result: ProgresoPreparado, id: string): void => {
      if (!sesion || !contexto || !userId) return;
      prepared = true;
      examActive = false;
      enviar({
        type: 'tf-atlas:progreso',
        requestId: id,
        data: result.estado,
        guardado: result.guardado,
        revision: result.revision,
        origen: result.origen,
      });
      const status: ProgresoSyncMensaje = result.guardado
        ? { estado: 'guardado', texto: 'Guardado en tu cuenta.' }
        : result.origen === 'nuevo'
          ? {
              estado: 'listo',
              texto:
                'Progreso preparado; todavía no se ha guardado ningún cambio en tu cuenta.',
            }
          : {
              estado: 'pendiente',
              texto: 'Sin conexión: progreso pendiente de sincronizar.',
            };
      publicarEstado(status);
      enviar({
        type: 'tf-atlas:sincronizacion',
        estado: status.estado,
        texto: status.texto,
      });
    };

    const cargar = (): void => {
      if (!sesion || !loadRequestId) return;
      loadingSubscription?.unsubscribe();
      const id = loadRequestId;
      loadingSubscription = sesion
        .cargar(legacy, storageAvailable, isImpersonating)
        .subscribe({
          next: (result) => {
            if (!sesion || id !== loadRequestId) return;
            enviarPreparado(result, id);
          },
          error: (error: unknown) => {
            if (!sesion || id !== loadRequestId) return;
            prepared = false;
            const texto =
              error instanceof Error && error.message
                ? error.message
                : 'No se pudo cargar el progreso. Reintenta para continuar.';
            publicar({ estado: 'error', texto });
            enviar({ type: 'tf-atlas:error', requestId: id, texto });
          },
        });
      subscriptions.add(loadingSubscription);
    };

    const nuevoContexto = (): void => {
      if (!frameWindow || !userId) return;
      contexto = newId('callejero');
      loadRequestId = null;
      resetRequestId = null;
      prepared = false;
      examActive = false;
      enviar({ type: 'tf-atlas:iniciar', build });
      publicarEstado({
        estado: 'cargando',
        texto: 'Cargando progreso de tu cuenta…',
      });
    };

    const crearSesion = (
      id: number | null,
      subject: unknown,
      impersonating: boolean,
    ): void => {
      if (frameLoaded && contexto) {
        enviar({ type: 'tf-atlas:bloquear', build });
        contexto = null;
      }
      if (sesion) {
        loadingSubscription?.unsubscribe();
        sessionStatusSubscription?.unsubscribe();
        sesion.cancelar();
      }
      sesion = null;
      userId = id;
      isImpersonating = impersonating;
      prepared = false;
      loadRequestId = null;
      resetRequestId = null;
      if (!id) {
        contexto = null;
        publicarEstado({
          estado: 'error',
          texto: 'No hay una sesión autenticada para guardar el progreso.',
        });
        return;
      }
      sesion = this.progreso.crearSesion(id, modalidad, () => {
        const claims = this.auth.decodeToken();
        return (
          claims?.sub === subject &&
          (claims?.isImpersonating === true) === impersonating
        );
      });
      sessionStatusSubscription = sesion.estado$.subscribe(publicar);
      subscriptions.add(sessionStatusSubscription);
      if (frameLoaded) nuevoContexto();
    };

    const clavesBase = [
      'app',
      'version',
      'build',
      'type',
      'modalidad',
      'contexto',
      'requestId',
    ];
    const recibir = (event: MessageEvent): void => {
      if (
        !frameWindow ||
        event.origin !== origin ||
        event.source !== frameWindow
      )
        return;
      const data = event.data;
      if (!esObjeto(data)) return;
      if (
        data['app'] !== APP_ATLAS ||
        data['version'] !== VERSION_ATLAS ||
        data['modalidad'] !== modalidad ||
        data['contexto'] !== contexto ||
        data['build'] !== build ||
        !TIPOS_EMBED.has(String(data['type']))
      ) {
        return;
      }
      const type = data['type'];
      if (type === 'tf-atlas:cargar') {
        if (
          !tieneClavesExactas(data, [
            ...clavesBase,
            'legado',
            'almacenamientoDisponible',
            'examenActivo',
          ]) ||
          !esId(data['requestId']) ||
          typeof data['almacenamientoDisponible'] !== 'boolean' ||
          typeof data['examenActivo'] !== 'boolean'
        ) {
          return;
        }
        if (!sesion || !userId) return;
        loadRequestId = data['requestId'];
        legacy = data['legado'];
        storageAvailable = data['almacenamientoDisponible'];
        examActive = data['examenActivo'];
        cargar();
        return;
      }

      if (type === 'tf-atlas:actividad') {
        if (
          !tieneClavesExactas(data, [...clavesBase, 'examenActivo']) ||
          !esId(data['requestId']) ||
          typeof data['examenActivo'] !== 'boolean'
        ) {
          return;
        }
        examActive = data['examenActivo'];
        return;
      }

      if (type === 'tf-atlas:borrado') {
        if (
          !tieneClavesExactas(data, [...clavesBase, 'examenActivo']) ||
          !esId(data['requestId']) ||
          data['examenActivo'] !== false ||
          !sesion ||
          !prepared
        )
          return;
        resetRequestId = data['requestId'];
        const resetSubscription = sesion.borrar().subscribe({
          next: (result) => {
            if (resetRequestId !== data['requestId']) return;
            enviar({
              type: 'tf-atlas:sincronizacion',
              estado: 'guardado',
              texto: 'Progreso reiniciado y guardado en tu cuenta.',
            });
            publicarEstado({
              estado: 'guardado',
              texto: 'Progreso reiniciado y guardado en tu cuenta.',
            });
            enviar({
              type: 'tf-atlas:reset-confirmado',
              requestId: data['requestId'],
              data: result.estado,
            });
          },
          error: () =>
            publicar({
              estado: 'pendiente',
              texto: 'Sin conexión: progreso pendiente de sincronizar.',
            }),
        });
        subscriptions.add(resetSubscription);
        return;
      }

      if (type === 'tf-atlas:progreso') {
        if (
          !tieneClavesExactas(data, [...clavesBase, 'data', 'examenActivo']) ||
          !esId(data['requestId']) ||
          typeof data['examenActivo'] !== 'boolean' ||
          !sesion ||
          !prepared
        ) {
          return;
        }
        const state = normalizarEstadoEmbed(modalidad, data['data']);
        if (!state) {
          publicar({
            estado: 'error',
            texto:
              'No se guardó el progreso: el formato recibido no es válido.',
          });
          return;
        }
        examActive = data['examenActivo'];
        sesion.guardar(state);
      }
    };

    const alCargarIframe = (): void => {
      frameLoaded = true;
      if (userId) nuevoContexto();
    };

    const alRecuperarFoco = (): void => {
      if (!sesion || !prepared || examActive) return;
      const activeSession = sesion;
      const subscription = activeSession.refrescar(examActive).subscribe({
        next: (result) => {
          if (sesion !== activeSession || examActive) return;
          if (result && loadRequestId) enviarPreparado(result, loadRequestId);
        },
        error: () => undefined,
      });
      subscriptions.add(subscription);
    };

    const alReconectar = (): void => sesion?.reintentar();

    window.addEventListener('message', recibir);
    window.addEventListener('focus', alRecuperarFoco);
    window.addEventListener('online', alReconectar);
    iframe.addEventListener('load', alCargarIframe);

    subscriptions.add(
      this.auth.currentIdentity$
        .pipe(
          map((identity: CurrentAuthIdentity | null) => ({
            subject: identity?.sub ?? null,
            id: usuarioIdDeSubject(identity?.sub),
            impersonating: identity?.isImpersonating === true,
          })),
          distinctUntilChanged(
            (a, b) =>
              a.subject === b.subject && a.impersonating === b.impersonating,
          ),
        )
        .subscribe(({ id, subject, impersonating }) =>
          crearSesion(id, subject, impersonating),
        ),
    );

    if (iframe.contentDocument?.readyState === 'complete') alCargarIframe();

    return {
      reintentar: () => {
        if (sesion && prepared) {
          sesion.reintentar();
          return;
        }
        if (sesion && loadRequestId) cargar();
      },
      destruir: () => {
        window.removeEventListener('message', recibir);
        window.removeEventListener('focus', alRecuperarFoco);
        window.removeEventListener('online', alReconectar);
        iframe.removeEventListener('load', alCargarIframe);
        loadingSubscription?.unsubscribe();
        sessionStatusSubscription?.unsubscribe();
        subscriptions.unsubscribe();
        sesion?.cancelar();
      },
    };
  }
}
