import { ButtonModule } from 'primeng/button';
import { imagenesPerfilEstudio } from './estudio-tema';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, firstValueFrom, takeUntil, timeout } from 'rxjs';
import { usuarioIdDeSubject } from '../cursos/services/hidraulica-interactivo.service';
import { AuthSessionSnapshot } from '../services/auth-session.service';
import { AuthService } from '../services/auth.service';
import {
  ambitoBorrador,
  escribirBorrador,
  leerBorradores,
} from './estudio-borradores';
import { EstudioApiService } from './estudio-api.service';
import { prepararDocumentoEstudio } from './estudio-documento';
import {
  CanalEstudio,
  EstadoEstudio,
  RespuestaPuente,
} from './estudio-frame-runtime';
import {
  REFERENCIA_PSICO,
  operacionEstudio,
  registro,
} from './estudio-operaciones';

interface InstanciaEstudio {
  session: AuthSessionSnapshot;
  userId: number;
  instance: string;
  scope: string;
  cancel: Subject<void>;
  objectUrl?: string;
  lastRequest: number;
  flush?: () => void;
  salida?: Promise<void>;
}

const ESTADOS: readonly EstadoEstudio[] = [
  'error',
  'offline',
  'limited',
  'saving',
  'pending',
  'loading',
  'saved',
  'ready',
];
const TEXTO: Record<EstadoEstudio, string> = {
  loading: 'Conectando con tu perfil…',
  ready: 'Perfil conectado',
  saving: 'Guardando en tu perfil…',
  pending: 'Cambios pendientes de guardar',
  saved: 'Guardado en tu perfil',
  offline:
    'Sin conexión con tu perfil. Cambios pendientes en este dispositivo.',
  error: 'No se pudo sincronizar con tu perfil',
  limited: 'Algunos cambios solo se han guardado en este dispositivo',
};

@Component({
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './estudio-workspace.component.html',
  styleUrl: './estudio-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'estudio-workspace',
    class: 'visor-psico',
    '[attr.data-estado]': 'estado()',
    '(window:message)': 'recibir($event)',
  },
})
export class EstudioWorkspaceComponent {
  private readonly api = inject(EstudioApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly volverButton =
    viewChild<ElementRef<HTMLButtonElement>>('volverButton');
  private active?: InstanciaEstudio;

  readonly titulo = 'Psicotécnicos';
  readonly url = signal<SafeResourceUrl | null>(null);
  readonly fallo = signal('');
  readonly borradorNoDisponible = signal(false);
  readonly saliendo = signal(false);
  private readonly progreso = signal<EstadoEstudio>('loading');
  private readonly reto = signal<EstadoEstudio>('ready');
  readonly estado = computed(
    () =>
      ESTADOS.find(
        (value) => value === this.progreso() || value === this.reto(),
      ) ?? 'loading',
  );
  readonly texto = computed(() => TEXTO[this.estado()]);
  readonly reintentarVisible = computed(() =>
    ['offline', 'error'].includes(this.estado()),
  );
  readonly mostrarEstado = computed(
    () =>
      this.url() !== null &&
      (this.reintentarVisible() || this.estado() === 'limited'),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.dispose();
    });
    this.auth.currentIdentity$.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.active && !this.auth.isSessionCurrent(this.active.session))
        this.sesionCambiada();
    });
    this.route.fragment
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.cargar());
    setTimeout(() => this.volverButton()?.nativeElement.focus());
  }

  private dispose() {
    const previous = this.active;
    this.active = undefined;
    previous?.cancel.next();
    previous?.cancel.complete();
    previous?.flush?.();
    if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
    this.url.set(null);
  }

  private sesionCambiada() {
    this.dispose();
    this.fallo.set(
      'Tu sesión ha cambiado. Vuelve a abrir el visor desde tu cuenta.',
    );
  }

  cargar() {
    this.dispose();
    this.fallo.set('');
    this.progreso.set('loading');
    this.reto.set('ready');
    this.borradorNoDisponible.set(false);
    const session = this.auth.sessionSnapshot();
    const userId = usuarioIdDeSubject(session.sub);
    if (!session.authenticated || userId === null) {
      this.fallo.set('Inicia sesión para abrir el visor.');
      return;
    }
    const data: InstanciaEstudio = {
      session,
      userId,
      instance: crypto.randomUUID(),
      scope: ambitoBorrador(userId, session.isImpersonating),
      cancel: new Subject<void>(),
      lastRequest: 0,
    };
    this.active = data;
    void this.abrir(data);
  }

  private async abrir(data: InstanciaEstudio) {
    try {
      const html = await firstValueFrom(
        this.api.html().pipe(takeUntil(data.cancel), timeout(15000)),
      );
      const drafts = await leerBorradores(data.scope).catch(() => {
        if (this.vigente(data)) this.borradorNoDisponible.set(true);
        return {};
      });
      if (!this.vigente(data)) return;
      const imagenes = await imagenesPerfilEstudio();
      if (!this.vigente(data)) return;
      const page = prepararDocumentoEstudio(
        html,
        {
          origin: window.location.origin,
          instance: data.instance,
          drafts,
        },
        imagenes,
      );
      const fragment = this.route.snapshot.fragment;
      const q =
        fragment?.startsWith('q=') && REFERENCIA_PSICO.test(fragment.slice(2))
          ? '#' + fragment
          : '';
      data.objectUrl = URL.createObjectURL(
        new Blob([page], { type: 'text/html' }),
      );
      this.url.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(data.objectUrl + q),
      );
    } catch (error) {
      if (!this.vigente(data)) return;
      const status =
        error instanceof HttpErrorResponse ? error.status : undefined;
      this.fallo.set(
        status === 403 || status === 404
          ? 'Este contenido no está disponible para tu cuenta.'
          : 'No se pudo abrir el visor. Vuelve a intentarlo.',
      );
    }
  }

  private vigente(data: InstanciaEstudio) {
    if (this.active !== data) return false;
    if (this.auth.isSessionCurrent(data.session)) return true;
    this.sesionCambiada();
    return false;
  }

  recibir(event: MessageEvent): void {
    const active = this.active;
    const frame = this.frame()?.nativeElement.contentWindow;
    const msg: unknown = event.data;
    if (
      !active ||
      !frame ||
      event.origin !== 'null' ||
      event.source !== frame ||
      !registro(msg) ||
      msg['instance'] !== active.instance ||
      !this.vigente(active)
    )
      return;
    const type = msg['type'];
    if (type === 'flushed') {
      active.flush?.();
      return;
    }
    if (type === 'status') {
      const estado = msg['estado'] as EstadoEstudio;
      const canal = msg['canal'] as CanalEstudio;
      if (!ESTADOS.includes(estado)) return;
      if (canal === 'progreso') this.progreso.set(estado);
      if (canal === 'reto') this.reto.set(estado);
      return;
    }
    const id = msg['id'];
    if (
      (type !== 'api' && type !== 'draft') ||
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= active.lastRequest
    )
      return;
    active.lastRequest = id;
    void this.responder(active, type, id, msg['args']);
  }

  private async responder(
    data: InstanciaEstudio,
    type: 'api' | 'draft',
    id: number,
    args: unknown,
  ) {
    let response: RespuestaPuente;
    try {
      if (type === 'draft') {
        if (!registro(args)) throw new Error('Borrador inválido');
        await escribirBorrador(data.scope, args['key'], args['value']);
        response = { status: 204, result: null };
      } else {
        const op = operacionEstudio(args);
        if (!op) {
          this.enviar(data, 'reply', { id, status: 400, result: null });
          return;
        }
        const result = await firstValueFrom(
          this.api.ejecutar(op).pipe(takeUntil(data.cancel), timeout(15000)),
        );
        if (op.path === '/me') {
          if (
            !registro(result) ||
            usuarioIdDeSubject(result['id']) !== data.userId
          ) {
            this.sesionCambiada();
            return;
          }
          const { id: _, name: __, admin: ___, ...perfil } = result;
          response = { status: 200, result: perfil };
        } else {
          response = { status: 200, result };
        }
      }
    } catch (error) {
      if (!this.vigente(data)) return;
      if (type !== 'api') this.borradorNoDisponible.set(true);
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      const conflicto =
        status === 409 &&
        error instanceof HttpErrorResponse &&
        registro(error.error)
          ? error.error
          : null;
      response = { status, result: conflicto };
    }
    this.enviar(data, 'reply', { id, ...response });
  }

  private enviar(data: InstanciaEstudio, type: string, payload = {}) {
    if (this.vigente(data))
      this.frame()?.nativeElement.contentWindow?.postMessage(
        { instance: data.instance, type, ...payload },
        '*',
      );
  }

  reintentar() {
    if (this.active && this.url()) this.enviar(this.active, 'retry');
    else this.cargar();
  }

  desdeGestion() {
    return this.route.snapshot.queryParamMap.get('desde') === 'admin';
  }

  async guardarAntesDeSalir() {
    const data = this.active;
    if (!data || !this.url()) return;
    data.salida ??= new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        data.flush = undefined;
        resolve();
      };
      const timer = setTimeout(finish, 1000);
      data.flush = finish;
      this.enviar(data, 'flush');
    }).finally(() => {
      data.salida = undefined;
    });
    await data.salida;
  }

  async volver() {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    try {
      await this.router.navigateByUrl('/app/psicotecnicos/admin');
    } finally {
      this.saliendo.set(false);
    }
  }
}
