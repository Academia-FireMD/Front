import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastrService } from 'ngx-toastr';
import { Dropdown, DropdownModule } from 'primeng/dropdown';
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  combineLatest,
  filter,
  map,
  of,
  startWith,
  switchMap,
  timeout,
} from 'rxjs';
import { DocumentosDelTemaComponent } from '../../documentacion/documentos-del-tema/documentos-del-tema.component';
import { DocumentosService } from '../../documentacion/services/documentacion.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { TemaService } from '../../services/tema.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import {
  ContextoPdfLibrillo,
  LibrilloContextoPdfService,
} from './librillo-contexto-pdf.service';
import { LibrilloPracticaComponent } from './librillo-practica.component';
import { PreviaLibrillosPdfComponent } from './previa-librillos-pdf.component';
import {
  RUTA_PREVIA_LIBRILLOS,
  VistaTemario,
  parametrosPracticaLibrillo,
  vistaDeTemario,
} from './previa-librillos';
import {
  TemaLibrillo,
  crearTemarioLibrillo,
  pdfDisponible,
  seleccionLibrillo,
} from './temario-librillo';

type FuenteTemario = 'banco' | 'arbol';
type Carga<T> = {
  estado: 'cargando' | 'error' | 'disponible';
  datos: T[];
};

const cargando = { estado: 'cargando', datos: [] as never[] } as const;

interface GrupoTemas {
  label: string;
  items: TemaLibrillo[];
}

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DropdownModule,
    DocumentosDelTemaComponent,
    PreviaLibrillosPdfComponent,
    LibrilloPracticaComponent,
  ],
  providers: [LibrilloContextoPdfService],
  templateUrl: './previa-librillos.component.html',
  styleUrl: './previa-librillos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviaLibrillosComponent {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly documentos = inject(DocumentosService);
  private readonly banco = inject(TemaService);
  private readonly config = inject(AppConfigService);
  private readonly contextoPdf = inject(LibrilloContextoPdfService);
  private readonly sesion = this.auth.sessionSnapshot();
  private readonly actualizar = new Subject<FuenteTemario>();
  private readonly toast = inject(ToastrService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private guardando: Promise<boolean> | null = null;
  private readonly recursoMontado = signal<string | null>(null);
  readonly salidaPendiente = signal<string | null>(null);
  readonly selectorMovilAbierto = signal(false);
  private readonly selectorTema = viewChild<Dropdown>('selectorTema');
  private readonly selectorPdf = viewChild<Dropdown>('selectorPdf');
  private readonly botonTemas =
    viewChild<ElementRef<HTMLButtonElement>>('botonTemas');
  private readonly tabDocumentos =
    viewChild<ElementRef<HTMLButtonElement>>('tabDocumentos');
  private readonly tabLibrillo =
    viewChild<ElementRef<HTMLButtonElement>>('tabLibrillo');
  private readonly panelLectura =
    viewChild<ElementRef<HTMLElement>>('panelLectura');
  private readonly panelDocumentos =
    viewChild<ElementRef<HTMLElement>>('panelDocumentos');
  private focoLectura?: HTMLElement;
  private focoDocumentos?: HTMLElement;
  private readonly visorPdf = viewChild(PreviaLibrillosPdfComponent);
  readonly panelPractica = viewChild(LibrilloPracticaComponent);
  private readonly botonRegreso =
    viewChild<ElementRef<HTMLButtonElement>>('botonRegreso');
  private readonly tabLectura =
    viewChild<ElementRef<HTMLButtonElement>>('tabLectura');
  private referenciaEnCurso:
    | (ContextoPdfLibrillo & { referencia: number })
    | null = null;
  readonly errorReferencia = signal(false);
  private readonly enfocarDocumentoAlEntrar =
    this.ruta.snapshot.queryParamMap.has('doc');
  private readonly params = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  private readonly fuentes = toSignal(
    this.auth.currentIdentity$.pipe(
      startWith(null),
      map(() => this.auth.isSessionCurrent(this.sesion)),
      distinctUntilChanged(),
      switchMap((vigente) =>
        vigente
          ? combineLatest({
              banco: this.cargarFuente('banco', () =>
                this.banco.getAllTemas$(),
              ),
              arbol: this.cargarFuente('arbol', () =>
                this.documentos.getDocumentTree$(),
              ),
            })
          : of(null),
      ),
    ),
    { initialValue: { banco: cargando, arbol: cargando } },
  );

  readonly estado = computed(() => {
    const fuentes = this.fuentes();
    if (!fuentes) return 'sesion';
    if (
      fuentes.banco.estado === 'disponible' ||
      fuentes.arbol.estado === 'disponible'
    )
      return 'disponible';
    if (
      fuentes.banco.estado === 'cargando' ||
      fuentes.arbol.estado === 'cargando'
    )
      return 'cargando';
    return 'error';
  });
  readonly fallos = computed(() => {
    const fuentes = this.fuentes();
    if (!fuentes) return [];
    return (['banco', 'arbol'] as const).filter(
      (fuente) => fuentes[fuente].estado === 'error',
    );
  });
  readonly arbolDisponible = computed(
    () => this.fuentes()?.arbol.estado === 'disponible',
  );
  readonly arbolCargando = computed(
    () => this.fuentes()?.arbol.estado === 'cargando',
  );
  readonly temas = computed(() => {
    const fuentes = this.fuentes();
    return fuentes
      ? crearTemarioLibrillo(fuentes.banco.datos, fuentes.arbol.datos)
      : [];
  });
  readonly temasDePractica = computed(() =>
    this.temas().filter((tema) => tema.enBanco),
  );
  readonly gruposTemas = computed(() => {
    const grupos = new Map<string, GrupoTemas>();
    for (const tema of this.temas()) {
      const grupo = grupos.get(tema.modulo) ?? {
        label: tema.modulo,
        items: [],
      };
      grupo.items.push(tema);
      grupos.set(tema.modulo, grupo);
    }
    return [...grupos.values()];
  });
  readonly seleccion = computed(() =>
    seleccionLibrillo(this.temas(), this.params()),
  );
  readonly vistaDeTemario = computed<VistaTemario>(() =>
    this.salidaPendiente()
      ? 'librillo'
      : (vistaDeTemario(this.params().get('vista')) ?? 'librillo'),
  );
  private readonly claveSeleccion = computed(() => {
    const { tema, documento } = this.seleccion();
    return tema ? `${tema.id}:${documento?.id ?? ''}` : null;
  });
  readonly recursosMontados = computed(() => {
    const clave = this.claveSeleccion();
    return clave &&
      (this.vistaDeTemario() === 'librillo' || this.recursoMontado() === clave)
      ? [clave]
      : [];
  });
  readonly parametrosPractica = computed(() => {
    const { tema, documento } = this.seleccion();
    return tema?.enBanco
      ? parametrosPracticaLibrillo({
          id: tema.id,
          documentoId: documento?.isDownloadable ? documento.id : undefined,
        })
      : undefined;
  });
  readonly testActivo = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.TEST),
  );
  readonly flashcardsActivas = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.FLASHCARDS),
  );
  readonly pdfInteractivo = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.LIBRILLO_PDF_INTERACTIVO),
  );
  readonly librillosActivos = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.LIBRILLOS),
  );
  readonly practicaDisponible = computed(
    () =>
      !!this.seleccion().tema?.enBanco &&
      this.pdfInteractivo() &&
      (this.testActivo() || this.flashcardsActivas()),
  );
  readonly lectorPdfActivo = computed(() => {
    const { documento } = this.seleccion();
    return !!documento && pdfDisponible(documento);
  });
  readonly contextoPractica = computed(() => {
    const pdf = this.contextoPdf.contexto();
    return this.lectorPdfActivo() && pdf?.doc === this.seleccion().documento?.id
      ? pdf
      : null;
  });
  readonly pestana = this.contextoPdf.pestana;

  constructor() {
    let anterior: string | null = null;
    let vistaAnterior: VistaTemario | undefined;
    let restaurarFoco = this.enfocarDocumentoAlEntrar;
    effect(
      () => {
        const clave = this.claveSeleccion();
        const vista = this.vistaDeTemario();
        const id = this.seleccion().documento?.id;

        if (clave !== anterior) {
          anterior = clave;
          this.recursoMontado.set(null);
          this.focoLectura = undefined;
          this.focoDocumentos = undefined;
          this.referenciaEnCurso = null;
          this.errorReferencia.set(false);
          this.pestana.set('lectura');
        }
        if (vista === 'librillo') this.recursoMontado.set(clave);

        if (vista !== vistaAnterior) {
          vistaAnterior = vista;
          const destino =
            vista === 'librillo' ? this.focoLectura : this.focoDocumentos;
          if (destino) this.enfocarTrasRender(destino);
        }

        if (id && restaurarFoco) {
          restaurarFoco = false;
          afterNextRender(
            () => {
              if (document.activeElement !== document.body) return;
              const panel =
                vista === 'documentos'
                  ? this.panelDocumentos()
                  : this.panelLectura();
              const selector =
                vista === 'documentos'
                  ? '#librillo-doc-'
                  : '#librillo-edicion-';
              const enlace = panel?.nativeElement.querySelector<HTMLElement>(
                selector + id,
              );
              enlace?.focus({ preventScroll: true });
              enlace?.scrollIntoView?.({ block: 'nearest' });
            },
            { injector: this.injector },
          );
        }
      },
      { allowSignalWrites: true },
    );
    this.destroyRef.onDestroy(() => this.actualizar.complete());
  }

  private cargarFuente<T>(
    fuente: FuenteTemario,
    cargar: () => Observable<T[]>,
  ): Observable<Carga<T>> {
    return this.actualizar.pipe(
      filter((actualizar) => actualizar === fuente),
      startWith(fuente),
      switchMap(() =>
        cargar().pipe(
          timeout(15000),
          map((datos): Carga<T> => ({ estado: 'disponible', datos })),
          catchError(() => of<Carga<T>>({ estado: 'error', datos: [] })),
          startWith(cargando),
        ),
      ),
    );
  }

  abrirCatalogoMovil() {
    this.selectorMovilAbierto.set(true);
    afterNextRender(() => this.selectorTema()?.show(), {
      injector: this.injector,
    });
  }

  cerrarCatalogoMovil() {
    if (!this.selectorMovilAbierto()) return;
    this.selectorMovilAbierto.set(false);
    const boton = this.botonTemas()?.nativeElement;
    if (boton) this.enfocarTrasRender(boton);
  }

  private enfocarTrasRender(destino: HTMLElement) {
    afterNextRender(
      () => {
        if (destino.isConnected) destino.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  registrarFoco(evento: FocusEvent, vista: VistaTemario) {
    if (!(evento.target instanceof HTMLElement)) return;
    if (vista === 'librillo') this.focoLectura = evento.target;
    else this.focoDocumentos = evento.target;
  }

  async seleccionarTema(id: number) {
    const { tema } = this.seleccion();
    if (id !== tema?.id && this.temas().some((actual) => actual.id === id)) {
      const cambio = await this.navegarTemario({
        tema: id,
        doc: null,
        pagina: null,
        referencia: null,
      });
      if (!cambio)
        this.selectorTema()?.writeValue(this.seleccion().tema?.id ?? null);
    }
    if (this.selectorMovilAbierto()) {
      this.selectorMovilAbierto.set(false);
      const boton = this.botonTemas()?.nativeElement;
      if (boton) this.enfocarTrasRender(boton);
    }
  }

  abrirPdf(id: number) {
    const permitido = this.seleccion().tema?.documentos.some(
      (doc) => doc.id === id && pdfDisponible(doc),
    );
    if (permitido) void this.seleccionarDocumento(id);
  }

  async seleccionarDocumento(id: number) {
    const { tema, documento } = this.seleccion();
    if (!tema?.documentos.some((actual) => actual.id === id)) return;
    const cambio = await this.navegarTemario({
      tema: tema.id,
      doc: id,
      vista: 'librillo',
      ...(documento?.id === id ? {} : { pagina: null, referencia: null }),
    });
    if (!cambio)
      this.selectorPdf()?.writeValue(this.seleccion().documento?.id ?? null);
  }

  navegarPestanas(evento: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key))
      return;
    evento.preventDefault();
    const documentos =
      evento.key === 'Home' ||
      (evento.key !== 'End' && this.vistaDeTemario() === 'librillo');
    (documentos
      ? this.tabDocumentos()
      : this.tabLibrillo()
    )?.nativeElement.focus();
    void this.seleccionarVista(documentos ? 'documentos' : 'librillo');
  }

  seleccionarVista(vista: VistaTemario) {
    return this.navegarTemario({ vista });
  }

  private navegarTemario(queryParams: Record<string, string | number | null>) {
    return this.router.navigate([], {
      relativeTo: this.ruta,
      queryParamsHandling: 'merge',
      queryParams,
      preserveFragment: true,
    });
  }

  async verEnTexto(referencia: ContextoPdfLibrillo & { referencia: number }) {
    const { tema, documento } = this.seleccion();
    const panel = this.panelPractica();
    if (!tema || documento?.id !== referencia.doc || !this.lectorPdfActivo())
      return;
    this.referenciaEnCurso = referencia;
    this.errorReferencia.set(false);
    this.pestana.set('lectura');
    const params = this.params();
    if (
      this.vistaDeTemario() === 'librillo' &&
      params.get('pagina') === String(referencia.pagina) &&
      params.get('referencia') === String(referencia.referencia)
    )
      return;

    const abierta = await this.navegarTemario({
      tema: tema.id,
      doc: referencia.doc,
      vista: 'librillo',
      pagina: referencia.pagina,
      referencia: referencia.referencia,
    }).catch(() => false);
    if (
      referencia === this.referenciaEnCurso &&
      panel === this.panelPractica() &&
      panel?.regreso()
    ) {
      this.errorReferencia.set(!abierta);
    }
  }

  volverAPractica() {
    this.referenciaEnCurso = null;
    this.errorReferencia.set(false);
    this.panelPractica()?.volverAlIntento();
  }

  enfocarLectura() {
    (this.botonRegreso() ?? this.tabLectura())?.nativeElement.focus({
      preventScroll: true,
    });
  }

  recargar(fuente: FuenteTemario) {
    this.actualizar.next(fuente);
  }

  reintentarSalida() {
    const destino = this.salidaPendiente();
    if (destino) void this.router.navigateByUrl(destino);
  }

  async guardarAntesDeSalir(destino?: string) {
    const visor = this.visorPdf();
    if (!visor) return true;

    if (destino) {
      const url = this.router.parseUrl(destino);
      const ruta = url.root.children['primary']?.segments
        .map(({ path }) => path)
        .join('/');
      if (`/${ruta}` === RUTA_PREVIA_LIBRILLOS) {
        const actual = this.seleccion();
        const siguiente = seleccionLibrillo(this.temas(), url.queryParamMap);
        if (
          actual.tema?.id === siguiente.tema?.id &&
          actual.documento?.id === siguiente.documento?.id
        ) {
          return true;
        }
      }
    }

    this.guardando ??= visor
      .guardarAntesDeSalir()
      .catch(() => false)
      .finally(() => {
        this.guardando = null;
      });
    const guardado = await this.guardando;
    this.salidaPendiente.set(guardado ? null : (destino ?? null));
    const estado = visor.estadoGuardadoAlSalir();
    if (guardado && estado === 'local') {
      this.toast.warning(
        'Cambios guardados en este dispositivo. Sincronización pendiente.',
      );
    }
    return guardado;
  }
}
