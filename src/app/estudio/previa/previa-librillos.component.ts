import { Location } from '@angular/common';
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
import {
  ActivatedRoute,
  NavigationBehaviorOptions,
  ParamMap,
  Router,
  RouterLink,
  UrlTree,
} from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastrService } from 'ngx-toastr';
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
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';
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
  ORIGEN_BIBLIOTECA,
  EstadoBiblioteca,
  RetornoBiblioteca,
  esVistaBiblioteca,
  parametrosPracticaLibrillo,
} from './previa-librillos';
import {
  agruparBibliotecaDocumentos,
  crearBibliotecaDocumentos,
  crearTemarioLibrillo,
  filtrarBibliotecaDocumentos,
  pdfDisponible,
  seleccionLibrillo,
  tituloDeBiblioteca,
} from './temario-librillo';

type FuenteTemario = 'banco' | 'arbol';
type Carga<T> = {
  estado: 'cargando' | 'error' | 'disponible';
  datos: T[];
};

const cargando = { estado: 'cargando', datos: [] as never[] } as const;

@Component({
  standalone: true,
  imports: [
    RouterLink,
    ButtonModule,
    InputTextModule,
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
  private readonly location = inject(Location);
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
  readonly salidaPendiente = signal<string | null>(null);
  private opcionesSalidaPendiente?: NavigationBehaviorOptions;
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
  private readonly params = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });
  private readonly resultadosBiblioteca = viewChild<ElementRef<HTMLElement>>(
    'resultadosBiblioteca',
  );
  private readonly cabecera =
    viewChild<ElementRef<HTMLHeadingElement>>('tituloTemario');
  readonly busquedaBiblioteca = signal('');
  readonly origenBiblioteca = ORIGEN_BIBLIOTECA;
  private readonly ramasAbiertas = signal<readonly string[]>([]);
  private readonly ramasCerradasConBusqueda = signal<readonly string[]>([]);

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
  readonly esBiblioteca = computed(() => esVistaBiblioteca(this.params()));
  private readonly arbolBiblioteca = computed(
    () => this.fuentes()?.arbol.datos,
  );
  readonly biblioteca = computed(() =>
    crearBibliotecaDocumentos(this.arbolBiblioteca() ?? []),
  );
  readonly gruposBiblioteca = computed(() =>
    agruparBibliotecaDocumentos(
      this.arbolBiblioteca() ?? [],
      filtrarBibliotecaDocumentos(this.biblioteca(), this.busquedaBiblioteca()),
    ),
  );
  private readonly busquedaActiva = computed(
    () => !!this.busquedaBiblioteca().trim(),
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
  readonly seleccion = computed(() =>
    seleccionLibrillo(this.temas(), this.params()),
  );
  readonly tituloLectura = computed(() => {
    const { tema, documento } = this.seleccion();
    return documento
      ? tituloDeBiblioteca(documento, tema?.descripcion)
      : (tema?.titulo ?? 'Temario');
  });
  private readonly claveSeleccion = computed(() => {
    const { tema, documento } = this.seleccion();
    return tema ? `${tema.id}:${documento?.id ?? ''}` : null;
  });
  readonly recursosMontados = computed(() => {
    const clave = this.claveSeleccion();
    return clave ? [clave] : [];
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
    effect(
      () => {
        // Las referencias y páginas del mismo documento conservan su panel de práctica.
        this.claveSeleccion();
        this.referenciaEnCurso = null;
        this.errorReferencia.set(false);
        this.pestana.set('lectura');
      },
      { allowSignalWrites: true },
    );
    effect(
      () => {
        const params = this.params();
        if (esVistaBiblioteca(params) && this.arbolDisponible()) {
          this.restaurarBiblioteca(params);
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

  abrirPdf(id: number) {
    const recurso = this.biblioteca().get(id);
    if (!this.esBiblioteca() || !recurso || !pdfDisponible(recurso.documento))
      return;
    const estado = this.conservarBiblioteca(id);
    void this.router
      .navigate([], {
        relativeTo: this.ruta,
        queryParamsHandling: 'merge',
        queryParams: {
          tema: recurso.tema.id,
          doc: id,
          vista: 'librillo',
          pagina: null,
          referencia: null,
        },
        preserveFragment: true,
        state: { misDocumentos: estado },
      })
      .then((cambio) => {
        if (cambio && !this.esBiblioteca()) {
          this.cabecera()?.nativeElement.focus({ preventScroll: true });
        }
      });
  }

  abrirEdicion({ id, url }: { id: number; url: UrlTree }) {
    if (!this.esBiblioteca()) return;
    const estado = this.conservarBiblioteca(id);
    void this.router.navigateByUrl(url, {
      state: { misDocumentos: estado, volverAMisDocumentos: true },
    });
  }

  readonly estadoRetornoBiblioteca = computed((): RetornoBiblioteca => {
    this.params();
    return { misDocumentos: this.estadoBibliotecaEnHistorial()?.misDocumentos };
  });

  buscarEnBiblioteca(busqueda: string) {
    this.busquedaBiblioteca.set(busqueda);
    this.ramasCerradasConBusqueda.set([]);
    const lista = this.resultadosBiblioteca()?.nativeElement;
    if (lista) lista.scrollTop = 0;
  }

  ramaAbierta(clave: string) {
    return this.busquedaActiva()
      ? !this.ramasCerradasConBusqueda().includes(clave)
      : this.ramasAbiertas().includes(clave);
  }

  alternarRama(clave: string) {
    const ramas = this.busquedaActiva()
      ? this.ramasCerradasConBusqueda
      : this.ramasAbiertas;
    ramas.update((actuales) =>
      actuales.includes(clave)
        ? actuales.filter((actual) => actual !== clave)
        : [...actuales, clave],
    );
  }

  private estadoBibliotecaEnHistorial() {
    return this.location.getState() as RetornoBiblioteca | null;
  }

  private conservarBiblioteca(id: number): EstadoBiblioteca {
    const estado: EstadoBiblioteca = {
      url: this.router.url,
      busqueda: this.busquedaBiblioteca(),
      scroll: this.resultadosBiblioteca()?.nativeElement.scrollTop ?? 0,
      foco: 'temario-doc-' + id,
      ramasAbiertas: this.ramasAbiertas(),
      ramasCerradasConBusqueda: this.ramasCerradasConBusqueda(),
    };
    this.location.replaceState(this.location.path(true), '', {
      ...(this.location.getState() as Record<string, unknown>),
      misDocumentos: estado,
    });
    return estado;
  }

  private restaurarBiblioteca(params: ParamMap) {
    const historial = this.estadoBibliotecaEnHistorial();
    const estado = historial?.misDocumentos;
    const id =
      historial?.enfocarDocumentoBiblioteca ??
      usuarioIdDeSubject(estado?.foco?.match(/^temario-doc-(\d+)$/)?.[1]);
    const temaId = usuarioIdDeSubject(params.get('tema'));
    const ramas = new Set(estado?.ramasAbiertas);
    let foco: string | undefined;

    if (!estado?.url) {
      for (const modulo of this.arbolBiblioteca() ?? []) {
        for (const tema of modulo.temas) {
          const documento = tema.documentos.find((doc) => doc.id === id);
          if (!documento && (tema.id !== temaId || !tema.documentos.length)) {
            continue;
          }
          const claveTema = `tema-${modulo.id}-${tema.id}`;
          ramas.add('modulo-' + modulo.id);
          ramas.add(claveTema);
          foco = documento
            ? 'temario-doc-' + documento.id
            : 'rama-' + claveTema;
        }
      }
    }

    this.busquedaBiblioteca.set(estado?.busqueda ?? '');
    this.ramasAbiertas.set([...ramas]);
    this.ramasCerradasConBusqueda.set(
      estado?.ramasCerradasConBusqueda ?? estado?.ramasCerradasConFiltro ?? [],
    );

    afterNextRender(
      () => {
        if (this.params() !== params) return;
        const lista = this.resultadosBiblioteca()?.nativeElement;
        if (lista) lista.scrollTop = estado?.scroll ?? 0;
        const focoId = estado?.foco ?? foco;
        const destino =
          (focoId && document.getElementById(focoId)) ||
          this.cabecera()?.nativeElement;
        destino?.focus({ preventScroll: true });
        if (!estado?.url && focoId) {
          destino?.scrollIntoView?.({ block: 'nearest' });
        }
      },
      { injector: this.injector },
    );
  }

  volverABiblioteca() {
    const estado = this.estadoRetornoBiblioteca();
    if (estado.misDocumentos) {
      return this.router.navigateByUrl(
        estado.misDocumentos.url ?? RUTA_PREVIA_LIBRILLOS + '?vista=documentos',
        { state: estado },
      );
    }

    const { tema, documento } = this.seleccion();
    return this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { vista: 'documentos', tema: tema?.id },
      state: { enfocarDocumentoBiblioteca: documento?.id },
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
      params.get('pagina') === String(referencia.pagina) &&
      params.get('referencia') === String(referencia.referencia)
    )
      return;

    const abierta = await this.router
      .navigate([], {
        relativeTo: this.ruta,
        queryParamsHandling: 'merge',
        queryParams: {
          tema: tema.id,
          doc: referencia.doc,
          vista: 'librillo',
          pagina: referencia.pagina,
          referencia: referencia.referencia,
        },
        preserveFragment: true,
        replaceUrl: true,
        state: this.estadoRetornoBiblioteca(),
      })
      .catch(() => false);
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
    if (destino) {
      void this.router.navigateByUrl(destino, this.opcionesSalidaPendiente);
    }
  }

  async guardarAntesDeSalir(destino?: string) {
    const visor = this.visorPdf();
    if (!visor) return true;

    const opciones = this.router.getCurrentNavigation()?.extras;
    if (destino) {
      const url = this.router.parseUrl(destino);
      const ruta = url.root.children['primary']?.segments
        .map(({ path }) => path)
        .join('/');
      if (
        `/${ruta}` === RUTA_PREVIA_LIBRILLOS &&
        !esVistaBiblioteca(url.queryParamMap)
      ) {
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
    this.opcionesSalidaPendiente = guardado ? undefined : opciones;
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
