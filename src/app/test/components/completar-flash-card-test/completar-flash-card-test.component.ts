import {
  parametrosPracticaLibrillo,
  temaDePracticaLibrillo,
} from '../../../estudio/previa/previa-librillos';
import type { ReferenciaPracticaLibrillo } from '../../../estudio/previa/librillo-practica.service';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  Subject,
  catchError,
  firstValueFrom,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { ViewportService } from '../../../services/viewport.service';
import {
  EstadoFlashcard,
  FlashcardTest,
} from '../../../shared/models/flashcard.model';

@Component({
  selector: 'app-completar-flash-card-test',
  templateUrl: './completar-flash-card-test.component.html',
  styleUrl: './completar-flash-card-test.component.scss',
})
export class CompletarFlashCardTestComponent {
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.embedded || this.comunicating) return;
    const tarjeta = this.lastLoadedTest?.flashcards[this.indicePregunta];
    if (!tarjeta) return;
    switch (event.key) {
      case 'ArrowLeft':
        if (!tarjeta.mostrarSolucion) return;
        this.selectedEstado(EstadoFlashcard.MAL);
        break;
      case 'ArrowRight':
        if (!tarjeta.mostrarSolucion) return;
        this.selectedEstado(EstadoFlashcard.BIEN);
        break;
      case 'ArrowDown':
        if (!tarjeta.mostrarSolucion) return;
        this.selectedEstado(EstadoFlashcard.REVISAR);
        break;
      case ' ':
      case 'Space':
        tarjeta.mostrarSolucion = true;
        break;
    }
  }

  activedRoute = inject(ActivatedRoute);
  flashcardService = inject(FlashcardDataService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  reporteFallo = inject(ReportesFalloService);
  viewport = inject(ViewportService);
  private readonly cdr = inject(ChangeDetectorRef);
  public indicePregunta = 0;
  public lastLoadedTest!: FlashcardTest;
  public comunicating = false;
  public estadoFlashcard = EstadoFlashcard;
  public displayFalloDialog = false;
  public displayClonacion = false;

  @Input() testId: number | null = null;
  @Input() embedded = false;
  @Input() referenciasLibrillo: ReferenciaPracticaLibrillo[] = [];
  @Output() finalizado = new EventEmitter<{ testId: number }>();
  @Output() verReferenciaLibrillo =
    new EventEmitter<ReferenciaPracticaLibrillo>();

  readonly errorCarga = signal(false);
  readonly errorGuardado = signal('');
  private readonly recargar = new Subject<void>();
  private readonly respondidas = new Set<number>();
  private resultadoEmitido = false;

  public getId() {
    return this.testId ?? this.activedRoute.snapshot.paramMap.get('id');
  }

  public async finalizarTestFlashcard() {
    if (this.comunicating || this.resultadoEmitido) return;
    this.comunicating = true;
    this.errorGuardado.set('');
    const id = this.lastLoadedTest.id;
    try {
      await firstValueFrom(this.flashcardService.finalizarTest(id));
      if (!this.embedded) await firstValueFrom(this.cargarTest$());
      this.navegarAResultados();
    } catch {
      if (this.embedded) {
        const test = await firstValueFrom(
          this.flashcardService
            .getTestById(id)
            .pipe(catchError(() => of(null))),
        );
        if (test?.status === 'FINALIZADO') {
          this.navegarAResultados();
          return;
        }
      }
      this.errorGuardado.set(
        'No se pudo finalizar el repaso. Inténtalo de nuevo.',
      );
    } finally {
      this.comunicating = false;
      this.cdr.markForCheck();
    }
  }

  private navegarAResultados() {
    if (this.embedded) {
      if (this.resultadoEmitido) return;
      this.resultadoEmitido = true;
      this.finalizado.emit({ testId: this.lastLoadedTest.id });
      return;
    }
    this.router.navigate(
      ['app/test/alumno/stats-test-flashcard/' + this.lastLoadedTest.id],
      {
        queryParams: parametrosPracticaLibrillo(
          temaDePracticaLibrillo(this.activedRoute.snapshot?.queryParamMap),
        ),
      },
    );
  }

  public testCargado$ = this.recargar.pipe(
    startWith(undefined),
    switchMap(() =>
      this.cargarTest$().pipe(
        catchError(() => {
          this.errorCarga.set(true);
          return of(null);
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public reintentarCarga() {
    this.errorCarga.set(false);
    this.recargar.next();
  }

  private cargarTest$() {
    return this.flashcardService.getTestById(Number(this.getId())).pipe(
      tap((entry: FlashcardTest) => {
        this.respondidas.clear();
        for (const tarjeta of entry.flashcards) {
          const { respuesta } = tarjeta;
          if (Array.isArray(respuesta) ? respuesta.length : respuesta)
            this.respondidas.add(tarjeta.id);
        }
        this.indicePregunta = entry.flashcards.findIndex(
          (tarjeta) => !this.respondidas.has(tarjeta.id),
        );
        if (this.indicePregunta < 0) this.indicePregunta = 0;
        this.lastLoadedTest = entry;
        if (this.embedded && entry.status === 'FINALIZADO') {
          queueMicrotask(() => this.navegarAResultados());
        }
      }),
    );
  }

  public async selectedEstado(estado: EstadoFlashcard) {
    const tarjeta = this.lastLoadedTest?.flashcards[this.indicePregunta];
    if (
      this.comunicating ||
      !tarjeta ||
      (this.embedded && !tarjeta.mostrarSolucion)
    )
      return;
    this.comunicating = true;
    this.errorGuardado.set('');
    try {
      await firstValueFrom(
        this.flashcardService.actualizarProgresoTest({
          testId: this.lastLoadedTest.id,
          testItemId: tarjeta.id,
          flashcardId: tarjeta.flashcard.id,
          estado: estado,
        }),
      );
    } catch {
      this.errorGuardado.set(
        'No se pudo guardar tu respuesta. Inténtalo de nuevo.',
      );
      return;
    } finally {
      this.comunicating = false;
      this.cdr.markForCheck();
    }
    if (this.embedded) {
      this.respondidas.add(tarjeta.id);
      const siguiente = this.lastLoadedTest.flashcards.findIndex(
        (item) => !this.respondidas.has(item.id),
      );
      if (siguiente === -1) await this.finalizarTestFlashcard();
      else this.indicePregunta = siguiente;
      return;
    }
    this.indicePregunta++;
    if (this.indicePregunta == this.lastLoadedTest.flashcards.length) {
      this.navegarAResultados();
    }
  }

  public async submitReporteFallo(reportDesc: string) {
    const feedback = await firstValueFrom(
      this.reporteFallo.reportarFalloFlashcard({
        flashcardDataId:
          this.lastLoadedTest.flashcards[this.indicePregunta].flashcardId,
        descripcion: reportDesc ?? '',
      }),
    );
    this.toast.success(
      'Reporte de fallo enviado exitosamente. Los administradores revisarán la pregunta.',
    );
    this.displayFalloDialog = false;
  }

  public navigateFlashcard(direction: number) {
    if (this.embedded && this.comunicating) return;
    const newIndex = this.indicePregunta + direction;
    if (newIndex >= 0 && newIndex < this.lastLoadedTest.flashcards.length) {
      this.indicePregunta = newIndex;
    }
  }

  public referenciaTarjeta(id: number) {
    return this.referenciasLibrillo.find(
      (referencia) => referencia.flashcardId === id,
    );
  }
}
