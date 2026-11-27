import {
  DatePipe,
  DecimalPipe,
  DOCUMENT,
  NgTemplateOutlet,
} from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Dialog, DialogModule } from 'primeng/dialog';
import { TabViewModule } from 'primeng/tabview';
import {
  Subject,
  catchError,
  firstValueFrom,
  map,
  of,
  scan,
  startWith,
  switchMap,
  timeout,
} from 'rxjs';
import { FlashcardDataService } from '../../services/flashcards.service';
import { TestModule } from '../../test/test.module';
import { ContextoPdfLibrillo } from './librillo-contexto-pdf.service';
import {
  AlcancePracticaLibrillo,
  ConfiguracionPracticaLibrillo,
  ConflictoPracticaLibrillo,
  ConteoTestLibrillo,
  HistorialPracticaLibrillo,
  IntentoPracticaLibrillo,
  LibrilloPracticaService,
  ModoPracticaLibrillo,
  PenalizacionLibrillo,
  ReferenciaPracticaLibrillo,
  RepasoLibrillo,
  ResumenPracticaLibrillo,
  SegundosPorPreguntaLibrillo,
  TipoPracticaLibrillo,
} from './librillo-practica.service';
import { parametrosPracticaLibrillo } from './previa-librillos';
import type { TemaLibrillo } from './temario-librillo';

type IntentoActivo = IntentoPracticaLibrillo & { tipo: TipoPracticaLibrillo };
type SolicitudInicio = {
  temaId: number;
  documentoId: number | undefined;
  tipo: TipoPracticaLibrillo;
  configuracion: ConfiguracionPracticaLibrillo;
};
type Resumen = {
  temaId: number;
  pdf: ContextoPdfLibrillo | null;
  datos: ResumenPracticaLibrillo;
};
type EstadoCarga = 'cargando' | 'error' | 'disponible';
type EstadoResumen = { tipo: EstadoCarga; resumen: Resumen | null };
type SegmentoPractica = {
  tono: 'bien' | 'fallo' | 'repaso' | 'blanca';
  etiqueta: string;
  cantidad: number;
  icono: string;
};
type EstadoResultado =
  | { tipo: 'cargando' | 'error' }
  | {
      tipo: 'disponible';
      total: number;
      segmentos: SegmentoPractica[];
      indicador: { etiqueta: string; valor: number | null; maximo: number };
    };
type EstadoHistorial = HistorialPracticaLibrillo & {
  filtro: TipoPracticaLibrillo;
  tipo: EstadoCarga;
};

function segmentosTest({
  aciertos,
  fallos,
  blancas,
}: ConteoTestLibrillo): SegmentoPractica[] {
  return [
    {
      tono: 'bien',
      etiqueta: 'Aciertos',
      cantidad: aciertos,
      icono: 'pi-check',
    },
    { tono: 'fallo', etiqueta: 'Fallos', cantidad: fallos, icono: 'pi-times' },
    {
      tono: 'blanca',
      etiqueta: 'En blanco',
      cantidad: blancas,
      icono: 'pi-minus',
    },
  ];
}

function segmentosTarjetas(
  aprendidas: number,
  paraRepasar: number,
  dificultad: number,
): SegmentoPractica[] {
  return [
    {
      tono: 'bien',
      etiqueta: 'Aprendidas',
      cantidad: aprendidas,
      icono: 'pi-check',
    },
    {
      tono: 'repaso',
      etiqueta: 'Para repasar',
      cantidad: paraRepasar,
      icono: 'pi-refresh',
    },
    {
      tono: 'fallo',
      etiqueta: 'Con dificultad',
      cantidad: dificultad,
      icono: 'pi-times',
    },
  ];
}

function mismaPagina(
  anterior: Partial<ContextoPdfLibrillo> | null,
  actual: ContextoPdfLibrillo | null,
) {
  return (
    anterior?.doc === actual?.doc &&
    anterior?.revision === actual?.revision &&
    anterior?.pagina === actual?.pagina
  );
}

@Component({
  selector: 'app-librillo-practica',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    NgTemplateOutlet,
    TabViewModule,
    TestModule,
  ],
  templateUrl: './librillo-practica.component.html',
  styleUrl: './librillo-practica.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrilloPracticaComponent {
  readonly temaId = input.required<number>();
  readonly documentoId = input<number>();
  readonly temas = input<readonly Pick<TemaLibrillo, 'id' | 'etiqueta'>[]>([]);
  readonly pdf = input<ContextoPdfLibrillo | null>(null);
  readonly testActivo = input.required<boolean>();
  readonly flashcardsActivas = input.required<boolean>();
  readonly verEnTexto = output<ContextoPdfLibrillo & { referencia: number }>();
  readonly enfocarLectura = output<void>();

  private readonly api = inject(LibrilloPracticaService);
  private readonly flashcards = inject(FlashcardDataService);
  private readonly documento = inject(DOCUMENT);
  private readonly destruir = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly dialogo = viewChild(Dialog);
  private readonly botonInicio =
    viewChild<ElementRef<HTMLButtonElement>>('botonInicio');
  private readonly botonHistorial =
    viewChild<ElementRef<HTMLButtonElement>>('botonHistorial');
  private readonly refrescar = new Subject<void>();
  private readonly intento = signal<IntentoActivo | null>(null);
  private readonly solicitud = signal<SolicitudInicio | null>(null);
  private readonly conflicto = signal<{
    solicitud: SolicitudInicio;
    pendiente: ConflictoPracticaLibrillo;
  } | null>(null);
  private readonly suspendida = signal(false);
  private regresoReferencia: {
    foco: HTMLElement | null;
    scroll: number;
  } | null = null;
  private focoAlCerrar: 'inicio' | 'historial' = 'inicio';

  private readonly consulta = computed(() => ({
    temaId: this.temaId(),
    pdf: this.pdf(),
  }));

  readonly estado = toSignal(
    toObservable(this.consulta).pipe(
      switchMap(({ temaId, pdf }) =>
        this.refrescar.pipe(
          startWith(undefined),
          switchMap(() =>
            this.api.resumen(temaId, pdf).pipe(
              map(
                (datos): EstadoResumen => ({
                  tipo: 'disponible',
                  resumen: { temaId, pdf, datos },
                }),
              ),
              catchError(() => of({ tipo: 'error', resumen: null } as const)),
              startWith({ tipo: 'cargando', resumen: null } as const),
            ),
          ),
        ),
      ),
      scan(
        (anterior, actual): EstadoResumen => ({
          tipo: actual.tipo,
          resumen: actual.resumen ?? anterior.resumen,
        }),
      ),
    ),
    { initialValue: { tipo: 'cargando', resumen: null } as const },
  );
  private readonly resumenDelTema = computed(() => {
    const resumen = this.estado().resumen;
    return resumen?.temaId === this.temaId() ? resumen : null;
  });
  readonly resumen = computed(() => {
    const resumen = this.resumenDelTema();
    return resumen && mismaPagina(resumen.pdf, this.pdf())
      ? resumen.datos
      : null;
  });
  readonly progreso = computed(() => this.resumenDelTema()?.datos.progreso);
  readonly referencias = computed(() => {
    const pdf = this.pdf();
    const resumen = this.resumenDelTema();
    return pdf &&
      resumen?.pdf?.doc === pdf.doc &&
      resumen.pdf.revision === pdf.revision
      ? resumen.datos.referencias
      : [];
  });

  readonly intentoActual = computed(() => {
    const intento = this.intento();
    return intento?.origenLibrillo.temaId === this.temaId() &&
      this.tipos().includes(intento.tipo)
      ? intento
      : null;
  });
  readonly conflictoActual = computed(() => {
    const conflicto = this.conflicto();
    return conflicto && this.solicitudVigente(conflicto.solicitud)
      ? conflicto
      : null;
  });
  readonly temaPendiente = computed(() => {
    const temas = this.conflictoActual()?.pendiente.temas ?? [];
    if (temas.length > 1) return 'Varios temas';
    return (
      this.temas().find(({ id }) => id === temas[0])?.etiqueta ??
      'Tema no disponible'
    );
  });
  readonly ocupado = computed(() => {
    const solicitud = this.solicitud();
    return !!solicitud && this.solicitudVigente(solicitud);
  });
  readonly errorAccion = signal('');
  readonly vista = signal<'actividad' | 'resultado' | 'historial' | null>(null);
  readonly resultado = signal<EstadoResultado | null>(null);
  readonly correccion = signal(false);
  readonly historial = signal<EstadoHistorial | null>(null);
  readonly filasHistorial = computed(() =>
    (this.historial()?.items ?? []).map((item) => ({
      item,
      tipo: 'aciertos' in item ? 'test' : 'flashcards',
      segmentos:
        'aciertos' in item
          ? segmentosTest(item)
          : segmentosTarjetas(
              item.aprendidas,
              item.paraRepasar,
              item.dificultad,
            ),
    })),
  );
  readonly progresoHistorial = computed(() => {
    const progreso = this.progreso();
    if (!progreso) return [];
    return this.tipos().map((tipo) =>
      tipo === 'test'
        ? {
            tipo,
            nombre: 'Preguntas',
            icono: 'pi-list',
            total: progreso.preguntas.total,
            vistas: progreso.preguntas.vistas,
            logradas: progreso.preguntas.acertadas,
            etiquetaLogradas: 'acertadas',
          }
        : {
            tipo,
            nombre: 'Flashcards',
            icono: 'pi-clone',
            total: progreso.tarjetas.total,
            vistas: progreso.tarjetas.vistas,
            logradas: progreso.tarjetas.dominadas,
            etiquetaLogradas: 'dominadas',
          },
    );
  });
  readonly dialogoVisible = computed(
    () =>
      !!this.conflictoActual() ||
      (!this.suspendida() &&
        (!!this.intentoActual() || this.vista() === 'historial')),
  );
  readonly tituloDialogo = computed(() => {
    if (this.conflictoActual()) return 'Sesión pendiente';
    if (!this.intentoActual()) return 'Historial del tema';
    if (this.intentoActual()?.tipo === 'flashcards')
      return 'Repaso de flashcards';
    return this.intentoActual()?.origenLibrillo.modo === 'simulacro'
      ? 'Simulacro'
      : 'Test de práctica';
  });
  readonly regreso = computed(() => {
    const intento = this.intentoActual();
    if (!this.suspendida() || !intento) return '';
    if (this.correccion()) return 'Volver a la corrección';
    if (this.resultado()) return 'Volver al resultado';
    if (intento.tipo === 'flashcards') return 'Volver a las flashcards';
    return intento.origenLibrillo.modo === 'simulacro'
      ? 'Volver al simulacro'
      : 'Volver al test';
  });
  readonly campus = computed(() =>
    this.conflictoActual()?.solicitud.tipo === 'test'
      ? '/app/test/alumno/realizar-test'
      : '/app/test/alumno/realizar-flash-cards-test',
  );
  readonly parametrosRegreso = computed(() =>
    parametrosPracticaLibrillo({
      id: this.temaId(),
      documentoId: this.documentoId(),
    }),
  );

  readonly tipoElegido = signal<TipoPracticaLibrillo>('test');
  readonly modo = signal<ModoPracticaLibrillo>('practica');
  readonly alcance = signal<AlcancePracticaLibrillo>('tema');
  readonly repaso = signal<RepasoLibrillo>('todo');
  readonly repasoActual = computed(() =>
    this.tipo() === 'flashcards' && this.repaso() === 'dudas'
      ? 'todo'
      : this.repaso(),
  );
  readonly cantidad = signal(10);
  readonly segundosPorPregunta = signal<SegundosPorPreguntaLibrillo>(0);
  readonly penalizacion = signal<PenalizacionLibrillo>(0);
  readonly tipos = computed<TipoPracticaLibrillo[]>(() => {
    const tipos: TipoPracticaLibrillo[] = [];
    if (this.testActivo()) tipos.push('test');
    if (this.flashcardsActivas()) tipos.push('flashcards');
    return tipos;
  });
  readonly tipo = computed(() => {
    const tipos = this.tipos();
    const elegido = this.tipoElegido();
    return tipos.includes(elegido) ? elegido : tipos[0];
  });
  readonly accion = computed(() => {
    if (this.tipo() === 'flashcards') return 'Repasar flashcards';
    return this.modo() === 'simulacro' ? 'Hacer simulacro' : 'Hacer test';
  });
  readonly disponiblesTema = computed(() => this.resumen()?.[this.tipo()] ?? 0);
  readonly disponiblesPagina = computed(() => {
    const resumen = this.resumen();
    return (
      (this.tipo() === 'test'
        ? resumen?.testPagina
        : resumen?.flashcardsPagina) ?? 0
    );
  });
  readonly alcanceActual = computed(() =>
    this.alcance() === 'pagina' && this.pdf() ? 'pagina' : 'tema',
  );
  readonly disponibles = computed(() =>
    this.alcanceActual() === 'pagina'
      ? this.disponiblesPagina()
      : this.disponiblesTema(),
  );

  constructor() {
    effect(
      () => {
        const solicitud = this.solicitud();
        if (solicitud && !this.solicitudVigente(solicitud))
          this.solicitud.set(null);
        const conflicto = this.conflicto();
        if (conflicto && !this.solicitudVigente(conflicto.solicitud))
          this.conflicto.set(null);
      },
      { allowSignalWrites: true },
    );
  }

  recargar() {
    this.refrescar.next();
  }

  iniciar() {
    if (this.ocupado() || !this.disponibles() || this.dialogoVisible()) return;

    const tipo = this.tipo();
    const alcance = this.alcanceActual();
    const pdf = this.pdf();
    const modo = tipo === 'test' ? this.modo() : 'practica';
    const cantidad = this.cantidad();
    this.focoAlCerrar = 'inicio';
    return this.enviarInicio({
      temaId: this.temaId(),
      documentoId: this.documentoId(),
      tipo,
      configuracion: {
        modo,
        alcance,
        repaso: this.repasoActual(),
        cantidad: cantidad === 0 ? 0 : Math.min(cantidad, this.disponibles()),
        ...(pdf && alcance === 'pagina' ? pdf : {}),
        ...(modo === 'simulacro'
          ? {
              segundosPorPregunta: this.segundosPorPregunta(),
              penalizacion: this.penalizacion(),
            }
          : {}),
      },
    });
  }

  confirmarReemplazo() {
    const conflicto = this.conflictoActual();
    if (!conflicto?.pendiente.reemplazable || this.ocupado()) return;
    return this.enviarInicio(conflicto.solicitud, conflicto.pendiente.id);
  }

  private solicitudVigente({
    temaId,
    documentoId,
    tipo,
    configuracion,
  }: SolicitudInicio) {
    return (
      temaId === this.temaId() &&
      documentoId === this.documentoId() &&
      this.tipos().includes(tipo) &&
      (configuracion.alcance === 'tema' ||
        mismaPagina(configuracion, this.pdf()))
    );
  }

  private async enviarInicio(
    solicitud: SolicitudInicio,
    reemplazarPendienteId?: number,
  ) {
    const { temaId, tipo, configuracion } = solicitud;
    const vigente = () =>
      this.solicitud() === solicitud && this.solicitudVigente(solicitud);
    this.errorAccion.set('');
    this.solicitud.set(solicitud);
    try {
      const intento = await firstValueFrom(
        this.api
          .iniciar(
            temaId,
            tipo,
            reemplazarPendienteId === undefined
              ? configuracion
              : { ...configuracion, reemplazarPendienteId },
          )
          .pipe(takeUntilDestroyed(this.destruir)),
      );
      if (vigente()) this.abrirIntento({ ...intento, tipo });
    } catch (error) {
      if (!vigente()) return;
      const respuesta =
        error instanceof HttpErrorResponse && error.status === 409
          ? error.error
          : null;
      if (
        respuesta?.codigo === 'intento_pendiente' &&
        Number.isSafeInteger(respuesta.id) &&
        respuesta.id > 0
      ) {
        const pendiente: ConflictoPracticaLibrillo = respuesta;
        if (
          reemplazarPendienteId === undefined &&
          pendiente.coincide &&
          pendiente.reemplazable &&
          pendiente.origenLibrillo?.temaId === temaId
        ) {
          this.abrirIntento({
            id: pendiente.id,
            origenLibrillo: pendiente.origenLibrillo,
            tipo,
          });
        } else {
          const estabaAbierto = this.dialogoVisible();
          this.conflicto.set({ solicitud, pendiente });
          if (estabaAbierto) this.enfocarTrasRender();
        }
      } else {
        this.conflicto.set(null);
        this.errorAccion.set(
          respuesta?.codigo === 'pendiente_cambiado'
            ? 'La sesión pendiente ha cambiado. Vuelve a pulsar el botón de la actividad.'
            : 'No se pudo iniciar la sesión. Revisa la selección o inténtalo de nuevo.',
        );
      }
    } finally {
      if (this.solicitud() === solicitud) this.solicitud.set(null);
    }
  }

  private abrirIntento(intento: IntentoActivo) {
    const estabaAbierto = this.dialogoVisible();
    this.conflicto.set(null);
    if (
      !this.suspendida() ||
      this.intentoActual()?.id !== intento.id ||
      this.intentoActual()?.tipo !== intento.tipo
    ) {
      this.limpiarVentana();
      this.intento.set(intento);
      this.vista.set('actividad');
    }
    this.suspendida.set(false);
    if (estabaAbierto) this.enfocarTrasRender();
  }

  cerrarDialogo() {
    if (this.conflictoActual()) {
      if (!this.ocupado()) this.conflicto.set(null);
      return;
    }
    this.limpiarVentana();
  }

  private limpiarVentana() {
    this.intento.set(null);
    this.vista.set(null);
    this.resultado.set(null);
    this.correccion.set(false);
    this.historial.set(null);
    this.suspendida.set(false);
    this.regresoReferencia = null;
  }

  finalizar(intento: IntentoActivo, id: number) {
    if (
      id !== intento.id ||
      this.intentoActual() !== intento ||
      this.resultado()
    )
      return;
    this.vista.set('resultado');
    this.recargar();
    if (this.dialogoVisible()) this.enfocarTrasRender();
    return this.cargarResultado(intento);
  }

  async cargarResultado(intento: IntentoActivo) {
    if (this.intentoActual() !== intento) return;
    const carga: EstadoResultado = { tipo: 'cargando' };
    this.resultado.set(carga);
    const vigente = () =>
      this.intentoActual() === intento && this.resultado() === carga;
    const consulta =
      intento.tipo === 'test'
        ? this.api.resultado(intento.origenLibrillo.temaId, intento.id).pipe(
            map(
              (datos): EstadoResultado => ({
                tipo: 'disponible',
                total: datos.total,
                segmentos: segmentosTest(datos),
                indicador: { etiqueta: 'Nota', valor: datos.nota, maximo: 10 },
              }),
            ),
          )
        : this.flashcards.getStats(intento.id, true).pipe(
            timeout(15000),
            map(({ estado }): EstadoResultado => {
              const aprendidas = estado.BIEN.count;
              const total =
                aprendidas + estado.REVISAR.count + estado.MAL.count;
              return {
                tipo: 'disponible',
                total,
                segmentos: segmentosTarjetas(
                  aprendidas,
                  estado.REVISAR.count,
                  estado.MAL.count,
                ),
                indicador: {
                  etiqueta: 'Aprendidas',
                  valor: aprendidas,
                  maximo: total,
                },
              };
            }),
          );
    try {
      const datos = await firstValueFrom(
        consulta.pipe(takeUntilDestroyed(this.destruir)),
      );
      if (vigente()) this.resultado.set(datos);
    } catch {
      if (vigente()) this.resultado.set({ tipo: 'error' });
    }
  }

  abrirHistorial() {
    if (this.ocupado() || this.dialogoVisible()) return;
    this.limpiarVentana();
    this.focoAlCerrar = 'historial';
    this.errorAccion.set('');
    return this.mostrarHistorial();
  }

  mostrarHistorial() {
    this.vista.set('historial');
    if (this.historial()) return;
    return this.cargarHistorial(this.intentoActual()?.tipo ?? this.tipo());
  }

  cambiarFiltro(tipo: TipoPracticaLibrillo) {
    if (this.historial()?.filtro === tipo) return;
    return this.cargarHistorial(tipo);
  }

  async cargarHistorial(
    filtro: TipoPracticaLibrillo,
    cursor: number | null = null,
  ) {
    if (this.vista() !== 'historial' || !this.tipos().includes(filtro)) return;
    const temaId = this.temaId();
    const anterior = this.historial();
    const carga: EstadoHistorial = {
      filtro,
      tipo: 'cargando',
      items:
        cursor !== null && anterior?.filtro === filtro ? anterior.items : [],
      siguienteCursor: cursor,
    };
    this.historial.set(carga);
    const vigente = () =>
      this.temaId() === temaId && this.historial() === carga;
    try {
      const pagina = await firstValueFrom(
        this.api
          .historial(temaId, filtro, cursor)
          .pipe(takeUntilDestroyed(this.destruir)),
      );
      if (vigente())
        this.historial.set({
          ...carga,
          tipo: 'disponible',
          items: [...carga.items, ...pagina.items],
          siguienteCursor: pagina.siguienteCursor,
        });
    } catch {
      if (vigente()) this.historial.set({ ...carga, tipo: 'error' });
    }
  }

  porcentaje(cantidad: number, total: number) {
    return total > 0 ? Math.min(100, Math.max(0, (100 * cantidad) / total)) : 0;
  }

  abrirReferencia(referencia: ReferenciaPracticaLibrillo) {
    const pdf = this.pdf();
    if (
      !this.intentoActual() ||
      !pdf ||
      !this.referencias().includes(referencia)
    )
      return;
    const foco = this.documento.activeElement;
    const ventana = this.dialogo()?.container as HTMLElement | undefined;
    this.regresoReferencia = {
      foco: foco instanceof HTMLElement ? foco : null,
      scroll: ventana?.querySelector('.p-dialog-content')?.scrollTop ?? 0,
    };
    this.suspendida.set(true);
    this.verEnTexto.emit({
      ...pdf,
      pagina: referencia.pagina,
      referencia: referencia.id,
    });
  }

  volverAlIntento() {
    if (this.regreso() && !this.dialogoVisible()) this.suspendida.set(false);
  }

  enfocarDialogo() {
    const contenedor = this.dialogo()?.container as HTMLElement | undefined;
    let objetivo = contenedor?.querySelector<HTMLElement>(
      '[data-foco-conflicto]',
    );
    const regreso = !this.conflictoActual() ? this.regresoReferencia : null;
    if (regreso) {
      this.regresoReferencia = null;
      const contenido = contenedor?.querySelector('.p-dialog-content');
      if (contenido) contenido.scrollTop = regreso.scroll;
      if (regreso.foco && contenedor?.contains(regreso.foco))
        objetivo = regreso.foco;
    }
    (
      objetivo ??
      contenedor?.querySelector<HTMLElement>('.p-dialog-header-close')
    )?.focus({ preventScroll: true });
  }

  private enfocarTrasRender() {
    afterNextRender(
      () => {
        if (this.dialogoVisible()) this.enfocarDialogo();
      },
      { injector: this.injector },
    );
  }

  enfocarAlCerrar() {
    const boton = (
      this.focoAlCerrar === 'historial'
        ? this.botonHistorial()
        : this.botonInicio()
    )?.nativeElement;
    if (!this.regreso() && boton?.getClientRects().length) {
      boton.focus({ preventScroll: true });
    } else {
      this.enfocarLectura.emit();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  cerrarConEscape(evento: KeyboardEvent) {
    const ventana = this.dialogo()?.container as HTMLElement | undefined;
    if (!this.dialogoVisible() || !ventana || evento.defaultPrevented) return;
    const dialogoConFoco = (evento.target as Element | null)?.closest?.(
      '[role="dialog"]',
    );
    if (dialogoConFoco && dialogoConFoco !== ventana) return;
    const dialogos = this.documento.querySelectorAll<HTMLElement>(
      '.p-dialog[role="dialog"]',
    );
    if (
      Array.from(dialogos).some(
        (otro) => Number(otro.style.zIndex) > Number(ventana.style.zIndex),
      )
    )
      return;
    evento.preventDefault();
    this.cerrarDialogo();
  }
}
