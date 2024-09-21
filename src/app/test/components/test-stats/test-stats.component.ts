import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Memoize } from 'lodash-decorators';
import { tap } from 'rxjs';
import { TestService } from '../../../services/test.service';
import { SeguridadAlResponder } from '../../../shared/models/pregunta.model';
import { Test } from '../../../shared/models/test.model';
import { colorCorrectas, colorIncorretas, colorSinResponder, getStats } from '../../../utils/utils';
@Component({
  selector: 'app-test-stats',
  templateUrl: './test-stats.component.html',
  styleUrl: './test-stats.component.scss',
})
export class TestStatsComponent {
  testService = inject(TestService);
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
  private lastLoadedTest!: Test;
  public seguridad = SeguridadAlResponder;

  @Memoize()
  getDataFromSeguridad(seguridad: SeguridadAlResponder, data: any) {
    const dataParsed = data.seguridad[seguridad] as {
      correctas: number;
      incorrectas: number;
      noRespondidas: number;
    };
    const totalRespuestas =
      dataParsed.correctas + dataParsed.incorrectas + dataParsed.noRespondidas;

    const correctasPorcentaje =
      totalRespuestas > 0
        ? ((dataParsed.correctas / totalRespuestas) * 100).toFixed(2)
        : '0';
    const incorrectasPorcentaje =
      totalRespuestas > 0
        ? ((dataParsed.incorrectas / totalRespuestas) * 100).toFixed(2)
        : '0';
    const noRespondidasPorcentaje =
      totalRespuestas > 0
        ? ((dataParsed.noRespondidas / totalRespuestas) * 100).toFixed(2)
        : '0';
    return {
      labels: ['Correctas', 'Incorrectas', 'Sin Responder'],
      datasets: [
        {
          data: [
            dataParsed.correctas,
            dataParsed.incorrectas,
            dataParsed.noRespondidas,
          ],
          backgroundColor: [
            colorCorrectas,
            colorIncorretas,
            colorSinResponder,
          ],
        },
      ],
      percentages: [
        correctasPorcentaje,
        incorrectasPorcentaje,
        noRespondidasPorcentaje,
      ],
    };
  }

  public calcular100y50() {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100, stats75, stats50 } = getStats(this.lastLoadedStats);

    return this.calcularCalificacion(
      stats100.correctas + stats50.correctas,
      stats100.incorrectas + stats50.incorrectas,
      this.lastLoadedTest.preguntas.length,
      'calcular100y50'
    );
  }

  public calcular100y75y50() {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100, stats75, stats50 } = getStats(this.lastLoadedStats);
    return this.calcularCalificacion(
      stats100.correctas + stats75.correctas + stats50.correctas,
      stats100.incorrectas + stats75.incorrectas + stats50.incorrectas,
      this.lastLoadedTest.preguntas.length,
      'calcular100y75y50'
    );
  }

  public calcularCalificacion(
    A: number,
    E: number,
    N: number,
    identificador?: string
  ): number {
    console.table([identificador, A, E, N]);

    const Q = ((A - E / 3) * 10) / N;
    return Q;
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/alumno/realizar-test']);
    }
  }
}
