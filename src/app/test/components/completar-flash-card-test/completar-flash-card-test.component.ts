import { Component, HostListener, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
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
    if (this.comunicating) return;
    switch (event.key) {
      case 'ArrowLeft':
        this.selectedEstado(EstadoFlashcard.MAL);
        break;
      case 'ArrowRight':
        this.selectedEstado(EstadoFlashcard.BIEN);
        break;
      case 'ArrowDown':
        this.selectedEstado(EstadoFlashcard.REVISAR);
        break;
      case ' ':
      case 'Space':
        this.lastLoadedTest.flashcards[this.indicePregunta].mostrarSolucion =
          true;
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
  public indicePregunta = 0;
  public lastLoadedTest!: FlashcardTest;
  public comunicating = false;
  public estadoFlashcard = EstadoFlashcard;
  public displayFalloDialog = false;
  public displayClonacion = false;
  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }

  public async finalizarTestFlashcard() {
    await firstValueFrom(
      this.flashcardService
        .finalizarTest(this.lastLoadedTest.id)
        .pipe(switchMap(() => this.cargarTest$()))
    );
    this.router.navigate([
      'app/test/alumno/stats-test-flashcard/' + this.lastLoadedTest.id,
    ]);
  }

  public testCargado$ = this.cargarTest$();
  private cargarTest$() {
    return this.flashcardService.getTestById(Number(this.getId())).pipe(
      tap((entry: FlashcardTest) => {
        this.indicePregunta = entry.flashcards.findIndex(
          (entry) => !entry.respuesta
        );
        if (this.indicePregunta < 0) this.indicePregunta = 0;
        this.lastLoadedTest = entry;
      })
    );
  }

  ngOnInit(): void {}

  public async selectedEstado(estado: EstadoFlashcard) {
    this.comunicating = true;
    await firstValueFrom(
      this.flashcardService
        .actualizarProgresoTest({
          testId: this.lastLoadedTest.id,
          testItemId: this.lastLoadedTest.flashcards[this.indicePregunta].id,
          flashcardId:
            this.lastLoadedTest.flashcards[this.indicePregunta].flashcard.id,
          estado: estado,
        })
        .pipe(
          catchError((err) => {
            this.comunicating = false;
            return of(err);
          })
        )
    );
    this.indicePregunta++;
    this.comunicating = false;
    if (this.indicePregunta == this.lastLoadedTest.flashcards.length) {
      console.log('Test completado');
      this.router.navigate([
        'app/test/alumno/stats-test-flashcard/' + this.lastLoadedTest.id,
      ]);
    }
  }

  public async submitReporteFallo(reportDesc: string) {
    const feedback = await firstValueFrom(
      this.reporteFallo.reportarFalloFlashcard({
        flashcardDataId:
          this.lastLoadedTest.flashcards[this.indicePregunta].flashcardId,
        descripcion: reportDesc ?? '',
      })
    );
    this.toast.success(
      'Reporte de fallo enviado exitosamente. Los administradores revisarán la pregunta.'
    );
    this.displayFalloDialog = false;
  }

  public navigateFlashcard(direction: number) {
    const newIndex = this.indicePregunta + direction;
    if (newIndex >= 0 && newIndex < this.lastLoadedTest.flashcards.length) {
      this.indicePregunta = newIndex;
    }
  }
}
