import { Location } from '@angular/common';
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
  input,
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
  BorradorReiniciado,
  escribirBorrador,
  leerBorradores,
  reiniciarBorradoresLibrillo,
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
import {
  RUTA_PREVIA_LIBRILLOS,
  RetornoBiblioteca,
  retornoDeEdicionInteractiva,
} from './previa/previa-librillos';

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
  selector: 'app-estudio-workspace',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './estudio-workspace.component.html',
  styleUrl: './estudio-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-testid': 'estudio-workspace',
    '[class.visor-inmersivo]': 'visorInmersivo',
    '[class.visor-en-previa]': 'enPrevia',
    '[class.visor-psico]': 'tipo === "psico"',
    '[attr.data-estado]': 'estado()',
    '(window:message)': 'recibir($event)',
  },
})
export class EstudioWorkspaceComponent {
  private readonly api = inject(EstudioApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly aula = inject(AulaInmersivaService);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly volverButton =
    viewChild<ElementRef<HTMLButtonElement>>('volverButton');
  private active?: InstanciaEstudio;

  readonly documentoPrevia = input<number>();
  get tipo(): RecursoEstudio['tipo'] {
    return this.enPrevia ? 'librillo' : this.route.snapshot.data['recurso'];
  }
  get enPrevia() {
    return this.documentoPrevia() !== undefined;
  }
  get visorInmersivo() {
    return (
      this.tipo === 'librillo' && !this.enPrevia && !environment.librillosMenu
    );
  }
  readonly titulo = signal(
    this.tipo === 'psico' ? 'Psicotécnicos' : 'Edición interactiva',
  );
  readonly edicion = signal('');
  readonly edicionCambiada = signal(false);
  readonly url = signal<SafeResourceUrl | null>(null);
  readonly fallo = signal('');
  readonly borradorNoDisponible = signal(false);
  readonly borradorReiniciado = signal(false);
  readonly saliendo = signal(false);
  private readonly progreso = signal<EstadoEstudio>('loading');
  private readonly reto = signal<EstadoEstudio>('ready');
  readonly estado = computed(
    () =>
      ESTADOS.find(
        (value) => value === this.progreso() || value === this.reto(),
      ) ?? 'loading',
  );
  readonly texto = computed(() => {
    if (this.borradorReiniciado())
      return 'Se ha reiniciado el progreso en otra pestaña.';
    if (this.edicionCambiada()) return 'Hay una nueva edición del documento.';
    return TEXTO[this.estado()];
  });
  readonly reintentarVisible = computed(
    () =>
      this.borradorReiniciado() ||
      this.edicionCambiada() ||
      ['offline', 'error'].includes(this.estado()),
  );
  readonly mostrarEstado = computed(
    () =>
      this.url() !== null &&
      (this.tipo === 'librillo' ||
        this.reintentarVisible() ||
        this.estado() === 'limited'),
  );

  ngOnInit() {
    const inmersivo = this.visorInmersivo;
    if (inmersivo) this.aula.activar();
    this.destroyRef.onDestroy(() => {
      this.dispose();
      if (inmersivo) this.aula.desactivar();
    });
    this.auth.currentIdentity$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.active && !this.auth.isSessionCurrent(this.active.session))
          this.sesionCambiada();
      });
    if (this.enPrevia) {
      this.cargar();
    } else {
      combineLatest([this.route.paramMap, this.route.fragment])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.cargar());
    }
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
    this.borradorReiniciado.set(false);
    const session = this.auth.sessionSnapshot();
    const userId = usuarioIdDeSubject(session.sub);
    if (!session.authenticated || userId === null) {
      this.fallo.set('Inicia sesión para abrir el visor.');
      return;
    }
    const documentoId = usuarioIdDeSubject(
      this.documentoPrevia() ?? this.route.snapshot.paramMap.get('documentoId'),
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
        throw new Error('Edición interactiva no disponible');
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
      const imagenes =
        recurso.tipo === 'psico' ? await imagenesPerfilEstudio() : {};
      if (!this.vigente(data)) return;
      const page = prepararDocumentoEstudio(
        html,
        recurso,
        {
          origin: window.location.origin,
          instance: data.instance,
          edition: meta?.edicion ?? '',
          drafts,
        },
        imagenes,
      );
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
      (type !== 'api' && type !== 'draft' && type !== 'draft-reset') ||
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
    type: 'api' | 'draft' | 'draft-reset',
    id: number,
    args: unknown,
  ) {
    let response: RespuestaPuente;
    try {
      if (type !== 'api') {
        if (!registro(args)) throw new Error('Borrador inválido');
        if (type === 'draft') {
          await escribirBorrador(
            data.scope,
            data.recurso,
            args['key'],
            args['value'],
            args['reinicio'],
          );
        } else if (data.recurso.tipo === 'librillo') {
          await reiniciarBorradoresLibrillo(
            data.scope,
            args['anterior'],
            args['borrado'],
            args['pendiente'],
            args['estado'],
          );
        } else {
          this.enviar(data, 'reply', { id, status: 400, result: null });
          return;
        }
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
      if (error instanceof BorradorReiniciado) {
        this.borradorReiniciado.set(true);
        this.enviar(data, 'reply', { id, status: 409, result: null });
        return;
      }
      if (type !== 'api') this.borradorNoDisponible.set(true);
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      const conflicto =
        status === 409 &&
        error instanceof HttpErrorResponse &&
        registro(error.error)
          ? error.error
          : null;
      const nuevoBorrado =
        conflicto?.['error'] === 'librillo_reiniciado' &&
        typeof conflicto['borrado'] === 'number' &&
        Number.isSafeInteger(conflicto['borrado']) &&
        conflicto['borrado'] >= 0
          ? conflicto['borrado']
          : null;
      if (
        status === 409 &&
        data.recurso.tipo === 'librillo' &&
        nuevoBorrado === null
      )
        this.edicionCambiada.set(true);
      response = {
        status,
        result:
          data.recurso.tipo === 'psico'
            ? conflicto
            : nuevoBorrado === null
              ? null
              : { error: 'librillo_reiniciado', borrado: nuevoBorrado },
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
    if (
      this.active &&
      this.url() &&
      !this.edicionCambiada() &&
      !this.borradorReiniciado()
    )
      this.enviar(this.active, 'retry');
    else this.cargar();
  }

  desdeGestion() {
    return (
      this.tipo === 'psico' &&
      this.route.snapshot.queryParamMap.get('desde') === 'admin'
    );
  }

  etiquetaVolver() {
    if (this.tipo === 'psico') return 'Volver a gestión';
    if (this.desdeBiblioteca()) return 'Volver a Mis documentos';
    return 'Volver al tema';
  }

  get parametrosPdfOriginal() {
    const params = this.route.snapshot.queryParamMap;
    const doc = this.route.snapshot.paramMap.get('documentoId');
    if (!environment.librillosMenu || params.get('original') !== 'pdf' || !doc)
      return undefined;
    return { doc, tema: params.get('tema'), vista: 'librillo' };
  }

  async abrirPdfOriginal() {
    const queryParams = this.parametrosPdfOriginal;
    if (!queryParams || this.saliendo()) return;
    this.saliendo.set(true);
    try {
      await this.router.navigate([RUTA_PREVIA_LIBRILLOS], {
        queryParams,
        state: { misDocumentos: this.estadoDelVisor()?.misDocumentos },
      });
    } finally {
      this.saliendo.set(false);
    }
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
      if (this.tipo === 'psico') {
        await this.router.navigateByUrl('/app/psicotecnicos/admin');
        return;
      }
      if (!this.desdeBiblioteca()) await this.guardarAntesDeSalir();
      const estado = this.estadoDelVisor();
      if (this.desdeBiblioteca()) {
        if (estado?.volverAMisDocumentos) {
          this.location.back();
          return;
        }
        if (estado?.misDocumentos?.url) {
          await this.router.navigateByUrl(estado.misDocumentos.url, {
            state: { misDocumentos: estado.misDocumentos },
          });
          return;
        }
      }
      const { ruta, parametros } = this.retornoLibrillo();
      const documentoId = this.route.snapshot.paramMap.get('documentoId');
      await this.router.navigate([ruta], {
        queryParams: parametros,
        state: {
          misDocumentos: estado?.misDocumentos,
          enfocarDocumentoBiblioteca: this.desdeBiblioteca()
            ? (usuarioIdDeSubject(documentoId) ?? undefined)
            : undefined,
        },
      });
    } finally {
      this.saliendo.set(false);
    }
  }

  private estadoDelVisor() {
    return this.location.getState() as RetornoBiblioteca | null;
  }

  desdeBiblioteca() {
    return this.tipo === 'librillo' && environment.librillosMenu;
  }

  private retornoLibrillo() {
    return retornoDeEdicionInteractiva(
      this.route.snapshot.queryParamMap,
      this.route.snapshot.paramMap.get('documentoId'),
      environment.librillosMenu,
    );
  }
}
