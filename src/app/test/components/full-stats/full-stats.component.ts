import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, filter, switchMap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TestService } from '../../../services/test.service';
import { Test } from '../../../shared/models/test.model';
import {
  calcular100y50,
  calcular100y75y50,
  colorCorrectas,
  colorIncorretas,
  colorSinResponder,
  getStats,
  obtenerTipoDeTest,
  toPascalCase,
} from '../../../utils/utils';

@Component({
  selector: 'app-full-stats',
  templateUrl: './full-stats.component.html',
  styleUrl: './full-stats.component.scss',
})
export class FullStatsComponent {
  public type: 'TESTS' | 'FLASHCARDS' = 'TESTS';
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  activatedRoute = inject(ActivatedRoute);
  testService = inject(TestService);
  flashcardService = inject(FlashcardDataService);
  public fullStats$ = this.getFullStats();
  public keys = Object.keys;
  public toPascalCase = toPascalCase;
  public calcular100y50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y50(
      statsParsed.stats100,
      statsParsed.stats50,
      numPreguntas
    );
  };
  public calcular100y75y50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y75y50(
      statsParsed.stats100,
      statsParsed.stats75,
      statsParsed.stats50,
      numPreguntas
    );
  };

  public getBlockBarData(testsBlock: Array<Test & { stats: any }>) {
    const labels = [] as Array<any>;
    const datasets = [
      {
        type: 'bar',
        label: 'Correctas',
        backgroundColor: colorCorrectas,
        data: [] as Array<number>,
      },
      {
        type: 'bar',
        label: 'Incorrectas',
        backgroundColor: colorIncorretas,
        data: [] as Array<number>,
      },
      {
        type: 'bar',
        label: 'Omitidas',
        backgroundColor: colorSinResponder,
        data: [] as Array<number>,
      },
    ];
    testsBlock.forEach((test) => {
      const stat = getStats(test.stats);
      const tipoTest = obtenerTipoDeTest(test, this.type);
      datasets[0].data.push(
        stat.stats100.correctas +
          stat.stats50.correctas +
          stat.stats75.correctas
      );
      datasets[1].data.push(
        stat.stats100.incorrectas +
          stat.stats50.incorrectas +
          stat.stats75.incorrectas
      );
      datasets[2].data.push(
        stat.stats100.noRespondidas +
          stat.stats50.noRespondidas +
          stat.stats75.noRespondidas
      );
      labels.push(tipoTest);
    });
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue(
      '--text-color-secondary'
    );
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');
    const data = {
      labels,
      datasets,
    };

    const options = {
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        tooltip: {
          mode: 'index',
          intersect: false,
        },
        legend: {
          labels: {
            color: textColor,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            color: textColorSecondary,
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false,
          },
        },
        y: {
          stacked: true,
          ticks: {
            color: textColorSecondary,
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false,
          },
        },
      },
    };
    return { data, options };
  }

  public calcularMediaCategoria = (tests: Array<Test & { stats: any }>) => {
    const totalTests = tests.length;
    let totalPreguntas = 0;
    const blockStats = tests.reduce(
      (prev, next) => {
        const { stats100, stats75, stats50 } = getStats(next.stats);
        prev.correctas +=
          stats100.correctas + stats75.correctas + stats50.correctas;
        prev.incorrectas +=
          stats100.incorrectas + stats75.incorrectas + stats50.incorrectas;
        prev.omitidas +=
          stats100.noRespondidas +
          stats75.noRespondidas +
          stats50.noRespondidas;
        return prev;
      },
      {
        correctas: 0,
        incorrectas: 0,
        omitidas: 0,
      }
    );
    tests.forEach((test) => {
      totalPreguntas += test.testPreguntas?.length ?? 0;
    });
    const total10050 = tests.reduce((prev, next) => {
      prev =
        prev + this.calcular100y50(next.stats, next.testPreguntas?.length ?? 0);
      return prev;
    }, 0);
    const total1007550 = tests.reduce((prev, next) => {
      prev =
        prev +
        this.calcular100y75y50(next.stats, next.testPreguntas?.length ?? 0);
      return prev;
    }, 0);
    return {
      totalTests: totalTests,
      total10050: total10050 == 0 ? total10050 : total10050 / totalTests,
      total1007550:
        total1007550 == 0 ? total1007550 : total1007550 / totalTests,
      totalPreguntas: totalPreguntas ?? 0,
      blockStats,
    };
  };

  commMap = (from: Date, to: Date) => {
    return {
      ADMIN: {
        FLASHCARDS: this.flashcardService.getStatsByCategoryAdmin({ from, to }),
        TESTS: this.testService.getStatsByCategoryAdmin({ from, to }),
      },
      ALUMNO: {
        FLASHCARDS: this.flashcardService.getStatsByCategory({ from, to }),
        TESTS: this.testService.getStatsByCategory({ from, to }),
      },
    };
  };

  constructor() {}

  private getFullStats() {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      switchMap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        const { from, to } = queryParams;
        this.type = type;
        this.expectedRole = expectedRole;
        return this.commMap(new Date(from), new Date(to))[this.expectedRole][
          this.type
        ];
      })
    );
  }
}
