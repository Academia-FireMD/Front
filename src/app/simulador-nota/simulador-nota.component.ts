import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { Subject, firstValueFrom, takeUntil } from 'rxjs';
import { AppState } from '../store/app.state';
import { selectCurrentUser } from '../store/user/user.selectors';
import {
  SIMULADOR_NOTA_CHANNEL,
  sanitizeSimuladorSnapshot,
  validateSimuladorMessage,
} from './simulador-nota-bridge';
import {
  SimuladorNotaSnapshot,
  SimuladorNotaVersion,
} from './models/simulador-nota.model';
import { SimuladorNotaService } from './services/simulador-nota.service';

const SAVE_DEBOUNCE_MS = 400;
interface HydrateMessage {
  channel: typeof SIMULADOR_NOTA_CHANNEL;
  type: 'hydrate';
  revision: number;
  estado: SimuladorNotaSnapshot | null;
}

@Component({
  selector: 'app-simulador-nota',
  templateUrl: './simulador-nota.component.html',
  styleUrls: ['./simulador-nota.component.scss'],
})
export class SimuladorNotaComponent implements OnInit, OnDestroy {
  @ViewChild('simulatorFrame')
  private simulatorFrame?: ElementRef<HTMLIFrameElement>;

  readonly iframeUrl: SafeResourceUrl;
  readonly iframeOrigin = window.location.origin;

  loading = false;
  loadingRemote = false;
  loadError = false;
  canShowIframe = false;
  iframeLoaded = false;
  iframeReady = false;
  hydrated = false;
  saving = false;
  hasConflict = false;
  pendingDelete = false;
  statusMessage = '';

  private readonly destroyed$ = new Subject<void>();
  private sessionCancelled$ = new Subject<void>();
  private activeUserId: number | null = null;
  private sessionStarted = false;
  private sessionRevision = 0;
  private serverState: SimuladorNotaSnapshot | null = null;
  private pendingDraft: SimuladorNotaSnapshot | null = null;
  private draftVersion = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionVersion = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private scheduledSnapshots = new Set<SimuladorNotaSnapshot>();

  get hasPendingDraft(): boolean {
    return this.pendingDraft !== null;
  }

  constructor(
    private readonly sanitizer: DomSanitizer,
    private readonly store: Store<AppState>,
    private readonly service: SimuladorNotaService,
  ) {
    this.iframeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `${this.iframeOrigin}/simulador-nota/index.html?modo=privado`,
    );
  }

  ngOnInit(): void {
    this.store
      .select(selectCurrentUser)
      .pipe(takeUntil(this.destroyed$))
      .subscribe((user) => this.startSession(user?.id ?? null));
  }

  ngOnDestroy(): void {
    this.clearSaveTimer();
    this.sessionCancelled$.next();
    this.sessionCancelled$.complete();
    this.destroyed$.next();
    this.destroyed$.complete();
    this.sessionVersion += 1;
  }

  onIframeLoad(): void {
    this.iframeLoaded = true;
    this.sendHydrationIfReady();
  }

  /** Recibe exclusivamente el protocolo versionado del iframe de origen propio. */
  onWindowMessage(event: MessageEvent): void {
    const iframeWindow = this.simulatorFrame?.nativeElement.contentWindow;
    if (!iframeWindow) return;

    const message = validateSimuladorMessage(
      event,
      this.iframeOrigin,
      iframeWindow,
    );
    if (!message) return;

    if (message.type === 'ready') {
      this.iframeReady = true;
      this.sendHydrationIfReady();
      return;
    }

    if (!this.hydrated) return;

    if (message.type === 'delete') {
      this.clearSaveTimer();
      this.draftVersion += 1;
      this.pendingDraft = null;
      this.pendingDelete = true;
      if (this.hasConflict || this.loadingRemote) {
        this.statusMessage = this.loadingRemote
          ? 'Se ha conservado la intención de borrar. La revisión remota sigue en curso; confirma el borrado cuando termine.'
          : 'El borrado requiere confirmación frente a la versión remota más reciente.';
        return;
      }
      this.statusMessage = 'Borrando el estado privado…';
      this.enqueueDelete(this.sessionVersion, this.draftVersion);
      return;
    }

    try {
      this.draftVersion += 1;
      this.pendingDraft = sanitizeSimuladorSnapshot(message.estado);
      this.pendingDelete = false;
      if (this.hasConflict || this.loadingRemote) {
        this.clearSaveTimer();
        this.statusMessage = this.loadingRemote
          ? 'Se ha conservado el cambio recibido durante la consulta. Revisa y confirma de nuevo antes de guardar.'
          : 'Tu borrador actualizado sigue visible y no se sobrescribirá hasta que confirmes.';
        return;
      }
      this.statusMessage = 'Guardando cambios privados…';
      this.scheduleSave(this.sessionVersion);
    } catch {
      this.statusMessage =
        'No se ha guardado el cambio porque el estado no cumple el contrato de privacidad.';
    }
  }

  reintentarCarga(): void {
    if (this.activeUserId !== null) this.loadState(this.sessionVersion);
  }

  reintentarGuardado(): void {
    if (this.hasConflict) return;
    if (this.pendingDelete) this.enqueueDelete(this.sessionVersion);
    else if (this.pendingDraft) this.enqueueSave(this.sessionVersion);
  }

  /** Recarga solo tras acción expresa; reemplaza el borrador visible por el remoto. */
  recargarEstadoRemoto(): void {
    if (this.activeUserId === null || this.loadingRemote) return;
    const version = this.sessionVersion;
    const draftVersion = this.draftVersion;
    this.clearSaveTimer();
    this.loadingRemote = true;
    this.statusMessage =
      'Consultando la versión remota. El simulador está temporalmente bloqueado.';
    this.service
      .cargar()
      .pipe(takeUntil(this.destroyed$), takeUntil(this.sessionCancelled$))
      .subscribe({
        next: (response) => {
          if (version !== this.sessionVersion) return;
          if (draftVersion !== this.draftVersion) {
            this.abortRemoteResolutionAfterEdit();
            return;
          }
          try {
            this.applyRemoteVersion(response, true);
            this.statusMessage = 'Se ha recargado el estado remoto.';
          } catch {
            this.statusMessage = 'El estado remoto no cumple el contrato.';
          } finally {
            this.loadingRemote = false;
          }
        },
        error: () => {
          if (version !== this.sessionVersion) return;
          this.loadingRemote = false;
          this.statusMessage =
            'No se pudo recargar el estado remoto; el borrador sigue visible.';
        },
      });
  }

  /** Sobrescritura explícita: obtiene la revisión actual y vuelve a guardar el borrador. */
  guardarBorradorSobreRemoto(): void {
    if (
      !this.pendingDraft ||
      this.pendingDelete ||
      this.activeUserId === null ||
      this.loadingRemote
    ) {
      return;
    }
    const draftVersion = this.draftVersion;
    this.clearSaveTimer();
    this.loadingRemote = true;
    this.statusMessage =
      'Consultando la versión remota. El simulador está temporalmente bloqueado.';
    const version = this.sessionVersion;

    this.service
      .cargar()
      .pipe(takeUntil(this.destroyed$), takeUntil(this.sessionCancelled$))
      .subscribe({
        next: (remote) => {
          if (version !== this.sessionVersion) return;
          if (draftVersion !== this.draftVersion) {
            this.abortRemoteResolutionAfterEdit();
            return;
          }
          this.sessionRevision = remote.revision;
          this.loadingRemote = false;
          this.hasConflict = false;
          this.enqueueSave(version);
        },
        error: () => {
          if (version !== this.sessionVersion) return;
          this.loadingRemote = false;
          this.statusMessage =
            'No se pudo obtener la revisión remota; el borrador sigue sin cambios.';
        },
      });
  }

  /** Borrado remoto tras conflicto: requiere una segunda acción explícita del alumno. */
  confirmarBorradoRemoto(): void {
    if (!this.pendingDelete || this.activeUserId === null || this.loadingRemote)
      return;
    this.loadingRemote = true;
    const version = this.sessionVersion;
    const draftVersion = this.draftVersion;
    this.clearSaveTimer();
    this.statusMessage =
      'Consultando la versión remota. El simulador está temporalmente bloqueado.';
    this.service
      .cargar()
      .pipe(takeUntil(this.destroyed$), takeUntil(this.sessionCancelled$))
      .subscribe({
        next: (remote) => {
          if (version !== this.sessionVersion) return;
          if (draftVersion !== this.draftVersion) {
            this.abortRemoteResolutionAfterEdit();
            return;
          }
          this.sessionRevision = remote.revision;
          this.loadingRemote = false;
          this.hasConflict = false;
          this.enqueueDelete(version);
        },
        error: () => {
          if (version !== this.sessionVersion) return;
          this.loadingRemote = false;
          this.statusMessage =
            'No se pudo obtener la revisión remota; no se ha borrado ningún dato.';
        },
      });
  }

  @HostListener('window:message', ['$event'])
  private onHostMessage(event: MessageEvent): void {
    this.onWindowMessage(event);
  }

  private startSession(userId: number | null): void {
    if (this.sessionStarted && userId === this.activeUserId) return;
    this.sessionStarted = true;
    this.sessionCancelled$.next();
    this.sessionCancelled$.complete();
    this.sessionCancelled$ = new Subject<void>();
    this.sessionVersion += 1;
    const version = this.sessionVersion;
    this.clearSaveTimer();
    this.writeQueue = Promise.resolve();
    this.scheduledSnapshots = new Set<SimuladorNotaSnapshot>();

    this.activeUserId = userId;
    this.sessionRevision = 0;
    this.serverState = null;
    this.pendingDraft = null;
    this.draftVersion = 0;
    this.pendingDelete = false;
    this.hasConflict = false;
    this.loadingRemote = false;
    this.loading = false;
    this.loadError = false;
    this.canShowIframe = false;
    this.iframeLoaded = false;
    this.iframeReady = false;
    this.hydrated = false;
    this.saving = false;
    this.statusMessage = '';

    if (userId === null) return;
    this.loadState(version);
  }

  private loadState(version: number): void {
    this.loading = true;
    this.loadError = false;
    this.service
      .cargar()
      .pipe(takeUntil(this.destroyed$), takeUntil(this.sessionCancelled$))
      .subscribe({
        next: (response) => {
          if (version !== this.sessionVersion) return;
          try {
            this.applyRemoteVersion(response, false);
            this.canShowIframe = true;
            this.statusMessage = 'Estado privado cargado.';
          } catch {
            this.loadError = true;
            this.canShowIframe = false;
            this.statusMessage =
              'El estado del servidor no cumple el contrato y no se ha restaurado.';
          } finally {
            this.loading = false;
          }
        },
        error: () => {
          if (version !== this.sessionVersion) return;
          this.loading = false;
          this.loadError = true;
          this.canShowIframe = false;
          this.statusMessage =
            'No se pudo cargar el estado privado. No se ha iniciado una simulación vacía.';
        },
      });
  }

  private applyRemoteVersion(
    response: SimuladorNotaVersion,
    replaceDraft: boolean,
  ): void {
    if (!Number.isSafeInteger(response.revision) || response.revision < 0)
      throw new Error('Revisión inválida.');
    const remoteState =
      response.estado === null
        ? null
        : sanitizeSimuladorSnapshot(response.estado);

    this.sessionRevision = response.revision;
    this.serverState = remoteState;
    this.hasConflict = false;
    this.pendingDelete = false;
    if (replaceDraft) this.pendingDraft = null;
    this.sendHydrationIfReady(true);
  }

  private abortRemoteResolutionAfterEdit(): void {
    this.loadingRemote = false;
    this.hasConflict = true;
    this.statusMessage = this.pendingDelete
      ? 'El simulador cambió mientras se consultaba la revisión. No se ha borrado nada; revisa y confirma el borrado de nuevo.'
      : 'El simulador cambió mientras se consultaba la revisión. No se ha guardado ni borrado nada; revisa el borrador y confirma de nuevo.';
  }

  private sendHydrationIfReady(force = false): void {
    if (
      !this.canShowIframe ||
      !this.iframeLoaded ||
      !this.iframeReady ||
      (this.hydrated && !force)
    ) {
      return;
    }
    const iframeWindow = this.simulatorFrame?.nativeElement.contentWindow;
    if (!iframeWindow) return;

    const message: HydrateMessage = {
      channel: SIMULADOR_NOTA_CHANNEL,
      type: 'hydrate',
      revision: this.sessionRevision,
      estado: this.serverState,
    };
    try {
      iframeWindow.postMessage(message, this.iframeOrigin);
      this.hydrated = true;
    } catch {
      this.hydrated = false;
      this.statusMessage = 'No se pudo inicializar el simulador privado.';
    }
  }

  private scheduleSave(version: number): void {
    this.clearSaveTimer();
    this.saveTimer = setTimeout(
      () => this.enqueueSave(version),
      SAVE_DEBOUNCE_MS,
    );
  }

  private enqueueSave(
    version: number,
    explicitDraft: SimuladorNotaSnapshot | null = null,
  ): void {
    const snapshot = explicitDraft ?? this.pendingDraft;
    if (!snapshot || version !== this.sessionVersion) return;
    const scheduledSnapshots = this.scheduledSnapshots;
    if (scheduledSnapshots.has(snapshot)) return;
    scheduledSnapshots.add(snapshot);
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.persistSnapshot(version, snapshot);
      } finally {
        scheduledSnapshots.delete(snapshot);
      }
    });
  }

  private async persistSnapshot(
    version: number,
    snapshot: SimuladorNotaSnapshot,
  ): Promise<void> {
    if (
      version !== this.sessionVersion ||
      this.hasConflict ||
      this.loadingRemote ||
      this.pendingDelete ||
      this.activeUserId === null
    ) {
      return;
    }
    this.saving = true;
    try {
      const response = await firstValueFrom(
        this.service
          .guardar(this.sessionRevision, snapshot)
          .pipe(takeUntil(this.destroyed$), takeUntil(this.sessionCancelled$)),
      );
      if (version !== this.sessionVersion) return;
      this.sessionRevision = response.revision;
      this.serverState =
        response.estado === null
          ? null
          : sanitizeSimuladorSnapshot(response.estado);
      this.hasConflict = false;
      if (this.pendingDraft === snapshot) this.pendingDraft = null;
      this.statusMessage = this.pendingDraft
        ? 'Guardado; quedan cambios más recientes por guardar.'
        : 'Cambios privados guardados.';
    } catch (error) {
      if (version !== this.sessionVersion) return;
      if (this.isConflict(error)) {
        this.hasConflict = true;
        this.clearSaveTimer();
        this.statusMessage =
          'Hay cambios remotos más recientes. Tu borrador sigue visible y no se ha sobrescrito.';
      } else {
        this.statusMessage =
          'No se pudo guardar. Tu borrador sigue en esta sesión; puedes reintentar.';
      }
    } finally {
      if (version === this.sessionVersion) this.saving = false;
    }
  }

  private enqueueDelete(
    version: number,
    draftVersion = this.draftVersion,
  ): void {
    if (version !== this.sessionVersion) return;
    this.writeQueue = this.writeQueue.then(() =>
      this.persistDelete(version, draftVersion),
    );
  }

  private async persistDelete(
    version: number,
    draftVersion: number,
  ): Promise<void> {
    if (
      version !== this.sessionVersion ||
      this.hasConflict ||
      !this.pendingDelete ||
      this.activeUserId === null
    ) {
      return;
    }
    this.saving = true;
    try {
      const response = await firstValueFrom(
        this.service
          .borrar(this.sessionRevision)
          .pipe(takeUntil(this.destroyed$), takeUntil(this.sessionCancelled$)),
      );
      if (version !== this.sessionVersion) return;
      this.sessionRevision = response.revision;
      this.serverState = null;
      const newerDraft =
        this.draftVersion !== draftVersion && this.pendingDraft !== null;
      this.pendingDelete = false;
      this.hasConflict = false;
      if (newerDraft) {
        this.statusMessage =
          'El estado anterior se ha borrado; los cambios posteriores siguen en esta sesión y se guardarán ahora.';
        this.clearSaveTimer();
        this.enqueueSave(version);
      } else {
        this.statusMessage = 'Estado privado borrado.';
        this.sendHydrationIfReady(true);
      }
    } catch (error) {
      if (version !== this.sessionVersion) return;
      if (this.isConflict(error)) {
        this.hasConflict = true;
        this.statusMessage =
          'El estado remoto cambió antes del borrado. No se ha eliminado ningún dato sin confirmación.';
      } else {
        this.statusMessage =
          'No se pudo borrar el estado. Puedes reintentar sin sobrescribir datos.';
      }
    } finally {
      if (version === this.sessionVersion) this.saving = false;
    }
  }

  private clearSaveTimer(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private isConflict(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
  }
}
