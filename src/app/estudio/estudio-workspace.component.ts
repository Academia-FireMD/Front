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
import {
  Subject,
  combineLatest,
  firstValueFrom,
  takeUntil,
  timeout,
} from 'rxjs';
import { environment } from '../../environments/environment';
import { usuarioIdDeSubject } from '../cursos/services/hidraulica-interactivo.service';
import { AulaInmersivaService } from '../cursos/ui/aula-inmersiva.service';
import { AuthSessionSnapshot } from '../services/auth-session.service';
import { AuthService } from '../services/auth.service';
import {
  ambitoBorrador,
  escribirBorrador,
  leerBorradores,
} from './estudio-borradores';
import { RecursoEstudio, EstudioApiService } from './estudio-api.service';
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
  recurso: RecursoEstudio;
  scope: string;
  cancel: Subject<void>;
  edition?: string;
  objectUrl?: string;
  lastRequest: number;
  flush?: () => void;
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
  templateUrl: './estudio-workspace.component.html',
  styleUrl: './estudio-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:message)': 'recibir($event)' },
})
export class EstudioWorkspaceComponent {
  private readonly api = inject(EstudioApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aula = inject(AulaInmersivaService);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly volverButton =
    viewChild<ElementRef<HTMLButtonElement>>('volverButton');
  private active?: InstanciaEstudio;

  readonly tipo = this.route.snapshot.data['recurso'] as RecursoEstudio['tipo'];
  readonly titulo = signal(
    this.tipo === 'psico' ? 'Psicotécnicos' : 'Librillo',
  );
  readonly edicion = signal('');
  readonly edicionCambiada = signal(false);
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
  readonly texto = computed(() =>
    this.edicionCambiada()
      ? 'Hay una nueva edición. Tus anotaciones se conservan.'
      : TEXTO[this.estado()],
  );
  readonly reintentarVisible = computed(
    () =>
      this.edicionCambiada() || ['offline', 'error'].includes(this.estado()),
  );

  constructor() {
    this.aula.activar();
    this.destroyRef.onDestroy(() => {
      this.dispose();
      this.aula.desactivar();
    });
    this.auth.currentIdentity$.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.active && !this.auth.isSessionCurrent(this.active.session))
        this.sesionCambiada();
    });
    combineLatest([this.route.paramMap, this.route.fragment])
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
    this.edicion.set('');
    this.edicionCambiada.set(false);
    this.progreso.set('loading');
    this.reto.set('ready');
    this.borradorNoDisponible.set(false);
    const session = this.auth.sessionSnapshot();
    const userId = usuarioIdDeSubject(session.sub);
    if (!session.authenticated || userId === null) {
      this.fallo.set('Inicia sesión para abrir el visor.');
      return;
    }
    const documentoId = usuarioIdDeSubject(
      this.route.snapshot.paramMap.get('documentoId'),
    );
    if (this.tipo === 'librillo' && documentoId === null) {
      this.fallo.set('El documento no está disponible.');
      return;
    }
    const recurso: RecursoEstudio =
      this.tipo === 'psico'
        ? { tipo: 'psico' }
        : { tipo: 'librillo', documentoId: documentoId! };
    const data: InstanciaEstudio = {
      session,
      userId,
      recurso,
      instance: crypto.randomUUID(),
      scope: ambitoBorrador(userId, session.isImpersonating, recurso),
      cancel: new Subject<void>(),
      lastRequest: 0,
    };
    this.active = data;
    void this.abrir(data);
  }

  private async abrir(data: InstanciaEstudio) {
    try {
      const recurso = data.recurso;
      const meta =
        recurso.tipo === 'librillo'
          ? await firstValueFrom(
              this.api
                .librillo(recurso.documentoId)
                .pipe(takeUntil(data.cancel), timeout(15000)),
            )
          : null;
      if (!this.vigente(data)) return;
      if (
        recurso.tipo === 'librillo' &&
        (meta?.documentoId !== recurso.documentoId ||
          !meta.edicion ||
          !meta.titulo)
      )
        throw new Error('Librillo no disponible');
      data.edition = meta?.edicion;
      const html = await firstValueFrom(
        this.api
          .html(recurso, data.edition)
          .pipe(takeUntil(data.cancel), timeout(15000)),
      );
      const drafts = await leerBorradores(data.scope, recurso).catch(() => {
        if (this.vigente(data)) this.borradorNoDisponible.set(true);
        return {};
      });
      if (!this.vigente(data)) return;
      if (meta) {
        this.titulo.set(meta.titulo);
        this.edicion.set(meta.edicion);
      }
      const page = prepararDocumentoEstudio(html, recurso, {
        origin: window.location.origin,
        instance: data.instance,
        edition: meta?.edicion ?? '',
        drafts,
      });
      const fragment = this.route.snapshot.fragment;
      const q =
        recurso.tipo === 'psico' &&
        fragment?.startsWith('q=') &&
        REFERENCIA_PSICO.test(fragment.slice(2))
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
      if (canal === 'reto' && active.recurso.tipo === 'psico')
        this.reto.set(estado);
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
        await escribirBorrador(
          data.scope,
          data.recurso,
          args['key'],
          args['value'],
        );
        response = { status: 204, result: null };
      } else {
        const op = operacionEstudio(data.recurso, args);
        if (!op) {
          this.enviar(data, 'reply', { id, status: 400, result: null });
          return;
        }
        const result = await firstValueFrom(
          this.api
            .ejecutar(data.recurso, op, data.edition)
            .pipe(takeUntil(data.cancel), timeout(15000)),
        );
        if (data.recurso.tipo === 'psico' && op.path === '/me') {
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
      if (type === 'draft') this.borradorNoDisponible.set(true);
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      if (status === 409 && data.recurso.tipo === 'librillo')
        this.edicionCambiada.set(true);
      response = {
        status,
        result:
          status === 409 &&
          data.recurso.tipo === 'psico' &&
          error instanceof HttpErrorResponse &&
          registro(error.error)
            ? error.error
            : null,
      };
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
    if (this.active && this.url() && !this.edicionCambiada())
      this.enviar(this.active, 'retry');
    else this.cargar();
  }

  etiquetaVolver() {
    if (this.tipo === 'psico')
      return this.route.snapshot.queryParamMap.get('desde') === 'admin'
        ? 'Volver a gestión'
        : 'Volver al aula';
    return this.desdeCatalogo() ? 'Volver a Librillos' : 'Volver al tema';
  }

  async volver() {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    const data = this.active;
    if (data && this.url())
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          data.flush = undefined;
          resolve();
        };
        const timer = setTimeout(finish, 1000);
        data.flush = finish;
        this.enviar(data, 'flush');
      });
    try {
      if (this.tipo === 'psico') {
        const admin =
          this.route.snapshot.queryParamMap.get('desde') === 'admin';
        await this.router.navigateByUrl(
          admin ? '/app/psicotecnicos/admin' : '/app/profile',
        );
      } else if (this.desdeCatalogo()) {
        await this.router.navigate(['/app/librillos'], {
          queryParams: { doc: this.route.snapshot.paramMap.get('documentoId') },
        });
      } else {
        const tema = usuarioIdDeSubject(
          this.route.snapshot.queryParamMap.get('tema'),
        );
        await this.router.navigate(['/app/documentacion/alumno'], {
          queryParams: {
            tema,
            doc: this.route.snapshot.paramMap.get('documentoId'),
          },
        });
      }
    } finally {
      this.saliendo.set(false);
    }
  }

  private desdeCatalogo() {
    return (
      environment.librillosMenu &&
      this.route.snapshot.queryParamMap.get('desde') === 'librillos'
    );
  }
}
