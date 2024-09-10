import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Memoize } from 'lodash-decorators';
import { tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import {
  EstadoFlashcard,
  FlashcardTest,
} from '../../../shared/models/flashcard.model';
@Component({
  selector: 'app-test-stats-flashcards',
  templateUrl: './test-stats-flashcards.component.html',
  styleUrl: './test-stats-flashcards.component.scss',
})
export class TestStatsFlashcardsComponent {
  testService = inject(FlashcardDataService);
  activedRoute = inject(ActivatedRoute);
  router = inject(Router);
  location = inject(Location);
  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }
  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }
  public test$ = this.testService
    .getTestById(Number(this.getId()))
    .pipe(tap((test) => (this.lastLoadedTest = test)));
  public stats$ = this.testService
    .getStats(Number(this.getId()))
    .pipe(tap((entry) => (this.lastLoadedStats = entry)));

  private lastLoadedStats!: any;
  private lastLoadedTest!: FlashcardTest;
  public colorCorrectas = '#00eb003d';
  public colorIncorretas = '#ff9c9c';
  public colorRevisar = '#FFD54F';
  @Memoize()
  getDataFromSeguridad(data: any) {
    const dataParsed = data as {
      estado: any;
    };
    const bien = dataParsed.estado[EstadoFlashcard.BIEN].count;
    const revisar = dataParsed.estado[EstadoFlashcard.REVISAR].count;
    const mal = dataParsed.estado[EstadoFlashcard.MAL].count;
    const totalRespuestas = bien + revisar + mal;

    const bienPorcentaje =
      totalRespuestas > 0 ? ((bien / totalRespuestas) * 100).toFixed(2) : '0';
    const revisarPorcentaje =
      totalRespuestas > 0
        ? ((revisar / totalRespuestas) * 100).toFixed(2)
        : '0';
    const malPorcentaje =
      totalRespuestas > 0 ? ((mal / totalRespuestas) * 100).toFixed(2) : '0';

    return {
      labels: ['Bien', 'Repasar', 'Mal'],
      datasets: [
        {
          data: [bien, revisar, mal],
          backgroundColor: [
            this.colorCorrectas,
            this.colorRevisar,
            this.colorIncorretas,
          ],
        },
      ],
      percentages: [bienPorcentaje, revisarPorcentaje, malPorcentaje],
    };
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/alumno/realizar-flash-cards-test']);
    }
  }
}
