import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import {
  Subject,
  catchError,
  firstValueFrom,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import { TestModule } from '../../test/test.module';
import {
  ContextoPdfLibrillo,
  LibrilloContextoPdfService,
} from './librillo-contexto-pdf.service';
import {
  AlcancePracticaLibrillo,
  ConfiguracionPracticaLibrillo,
  IntentoPendienteLibrillo,
  IntentoPracticaLibrillo,
  LibrilloPracticaService,
  ModoPracticaLibrillo,
  OrigenPracticaLibrillo,
  PenalizacionLibrillo,
  ReferenciaPracticaLibrillo,
  RepasoLibrillo,
  ResultadoPracticaLibrillo,
  ResumenPracticaLibrillo,
  SegundosPorPreguntaLibrillo,
  TipoPracticaLibrillo,
} from './librillo-practica.service';
import { parametrosPracticaLibrillo } from './previa-librillos';

type IntentoActivo = IntentoPracticaLibrillo & { tipo: TipoPracticaLibrillo };
type Resumen = {
  temaId: number;
  pdf: ContextoPdfLibrillo | null;
  datos: ResumenPracticaLibrillo;
};
type EstadoResumen =
  | { tipo: 'cargando' | 'error' }
  | { tipo: 'disponible'; resumen: Resumen };
type EstadoResultado =
  | { tipo: 'cargando' | 'error' }
  | { tipo: 'disponible'; datos: ResultadoPracticaLibrillo };

@Component({
  selector: 'app-librillo-practica',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    NgTemplateOutlet,
    TestModule,
  ],
  templateUrl: './librillo-practica.component.html',
  styleUrl: './librillo-practica.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrilloPracticaComponent {
  readonly temaId = input.required<number>();
  readonly documentoId = input<number>();
  readonly pdf = input<ContextoPdfLibrillo | null>(null);
  readonly testActivo = input.required<boolean>();
  readonly flashcardsActivas = input.required<boolean>();
  readonly verEnTexto = output<ContextoPdfLibrillo & { referencia: number }>();

  private readonly api = inject(LibrilloPracticaService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly contexto = inject(LibrilloContextoPdfService);
  private readonly destruir = inject(DestroyRef);
  private readonly refrescar = new Subject<void>();
  private readonly intento = signal<IntentoActivo | null>(null);
  private readonly conflicto = signal<{
    temaId: number;
    tipo: TipoPracticaLibrillo;
    intento: IntentoPendienteLibrillo;
  } | null>(null);
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
              catchError(() => of({ tipo: 'error' } as const)),
              startWith({ tipo: 'cargando' } as const),
            ),
          ),
        ),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as const },
  );
  readonly resumen = computed(() => {
    const estado = this.estado();
    if (estado.tipo !== 'disponible') return null;
    const { temaId, pdf } = this.consulta();
    const anterior = estado.resumen;
    return temaId === anterior.temaId &&
      pdf?.doc === anterior.pdf?.doc &&
      pdf?.revision === anterior.pdf?.revision &&
      pdf?.pagina === anterior.pdf?.pagina
      ? anterior.datos
      : null;
  });
  readonly intentoActual = computed(() => {
    const intento = this.intento();
    return intento?.origenLibrillo.temaId === this.temaId() &&
      (intento.tipo === 'test' ? this.testActivo() : this.flashcardsActivas())
      ? intento
      : null;
  });
  readonly ocupado = signal(false);
  readonly mostrarConflicto = signal(false);
  readonly conflictoActual = computed(() => {
    const conflicto = this.conflicto();
    return conflicto?.temaId === this.temaId() &&
      this.tipos().includes(conflicto.tipo)
      ? conflicto
      : null;
  });
  readonly errorAccion = signal('');
  readonly resultado = signal<EstadoResultado | null>(null);
  readonly correccion = signal(false);
  readonly tarjetasFinalizadas = signal(false);
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
  readonly referencias = computed(() => this.resumen()?.referencias ?? []);

  pendiente(tipo: TipoPracticaLibrillo) {
    const conflicto = this.conflicto();
    return conflicto?.temaId === this.temaId() && conflicto.tipo === tipo
      ? conflicto.intento
      : this.resumen()?.pendientes[tipo];
  }

  rutaAnterior(tipo: TipoPracticaLibrillo, id: number) {
    return [
      '/app/test/alumno',
      tipo === 'test' ? 'realizar-test' : 'realizar-flash-cards-test',
      id,
    ];
  }

  parametrosRegreso() {
    return parametrosPracticaLibrillo({
      id: this.temaId(),
      documentoId: this.documentoId(),
    });
  }

  async iniciar() {
    const tipo = this.tipo();
    if (this.ocupado() || !this.disponibles() || this.pendiente(tipo)) return;

    const temaId = this.temaId();
    const alcance = this.alcanceActual();
    const pdf = this.pdf();
    const modo = tipo === 'test' ? this.modo() : 'practica';
    const cantidad = this.cantidad();
    const configuracion: ConfiguracionPracticaLibrillo = {
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
    };

    this.errorAccion.set('');
    this.ocupado.set(true);
    try {
      const intento = await firstValueFrom(
        this.api
          .iniciar(temaId, tipo, configuracion)
          .pipe(takeUntilDestroyed(this.destruir)),
      );
      if (temaId === this.temaId()) this.abrirIntento({ ...intento, tipo });
    } catch (error) {
      if (temaId !== this.temaId()) return;
      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.codigo === 'intento_pendiente' &&
        Number.isSafeInteger(error.error.id) &&
        error.error.id > 0
      ) {
        this.conflicto.set({
          temaId,
          tipo,
          intento: {
            id: error.error.id,
            origenLibrillo: error.error.origenLibrillo,
          },
        });
        this.mostrarConflicto.set(true);
      } else {
        this.errorAccion.set(
          'No se pudo iniciar la sesión. Revisa la selección o inténtalo de nuevo.',
        );
      }
    } finally {
      this.ocupado.set(false);
    }
  }

  async retomar(
    tipo: TipoPracticaLibrillo,
    pendiente: IntentoPendienteLibrillo,
  ) {
    const origen = pendiente.origenLibrillo;
    if (this.ocupado() || !origen) return;

    this.errorAccion.set('');
    this.ocupado.set(true);
    try {
      const params = this.ruta.snapshot.queryParamMap;
      const irAlOrigen =
        origen.temaId !== this.temaId() ||
        (origen.doc != null &&
          (params.get('doc') !== String(origen.doc) ||
            params.get('pagina') !==
              (origen.pagina == null ? null : String(origen.pagina)) ||
            params.has('referencia')));
      if (
        irAlOrigen &&
        !(await this.router.navigate([], {
          relativeTo: this.ruta,
          queryParamsHandling: 'merge',
          queryParams: {
            tema: origen.temaId,
            doc: origen.doc ?? null,
            pagina: origen.pagina ?? null,
            referencia: null,
          },
        }))
      ) {
        throw new Error('Origen inaccesible');
      }
      this.contexto.pestana.set('practica');
      this.mostrarConflicto.set(false);
      this.abrirIntento({ id: pendiente.id, tipo, origenLibrillo: origen });
    } catch {
      this.errorAccion.set(
        'No se pudo abrir el origen de la sesión pendiente.',
      );
    } finally {
      this.ocupado.set(false);
    }
  }

  recargar() {
    this.refrescar.next();
  }

  cerrarIntento() {
    this.intento.set(null);
    this.resultado.set(null);
    this.correccion.set(false);
    this.tarjetasFinalizadas.set(false);
    this.conflicto.set(null);
    this.errorAccion.set('');
    this.recargar();
  }

  async cargarResultado(intento: IntentoActivo) {
    this.resultado.set({ tipo: 'cargando' });
    this.conflicto.set(null);
    this.recargar();
    try {
      const datos = await firstValueFrom(
        this.api
          .resultado(intento.origenLibrillo.temaId, intento.id)
          .pipe(takeUntilDestroyed(this.destruir)),
      );
      if (this.intento() === intento)
        this.resultado.set({ tipo: 'disponible', datos });
    } catch {
      if (this.intento() === intento) this.resultado.set({ tipo: 'error' });
    }
  }

  finalizarTarjetas() {
    this.tarjetasFinalizadas.set(true);
    this.conflicto.set(null);
    this.recargar();
  }

  abrirReferencia(referencia: ReferenciaPracticaLibrillo) {
    const pdf = this.pdf();
    if (!pdf || !this.referencias().includes(referencia)) return;
    this.verEnTexto.emit({
      ...pdf,
      pagina: referencia.pagina,
      referencia: referencia.id,
    });
  }

  private abrirIntento(intento: IntentoActivo) {
    this.resultado.set(null);
    this.correccion.set(false);
    this.tarjetasFinalizadas.set(false);
    this.intento.set(intento);
  }
}
