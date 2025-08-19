import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { EChartsOption } from 'echarts';
import { Memoize } from 'lodash-decorators';
import { combineLatest, filter, switchMap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TestService } from '../../../services/test.service';
import { FlashcardTest } from '../../../shared/models/flashcard.model';
import { Test } from '../../../shared/models/test.model';
import { MetodoCalificacion } from '../../../shared/models/user.model';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion } from '../../../store/user/user.selectors';
import {
  calcular100,
  calcular100y75,
  calcular100y75y50,
  colorCorrectas,
  colorFlashcardsCorrectas,
  colorFlashcardsIncorretas,
  colorFlashcardsRevisar,
  colorIncorretas,
  colorSinResponder,
  getDataFromFlashcards,
  getStats,
  obtenerTemas,
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
  public from!: Date;
  public to!: Date;
  public temas: Array<string> = [];
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  plugins = [ChartDataLabels, annotationPlugin];
  activatedRoute = inject(ActivatedRoute);
  testService = inject(TestService);
  router = inject(Router);
  flashcardService = inject(FlashcardDataService);
  store = inject(Store<AppState>);
  
  // Selector para obtener el método de calificación del usuario
  userMetodoCalificacion$ = this.store.select(selectUserMetodoCalificacion);
  public fullStats$ = this.getFullStats();
  public keys = Object.keys;
  public toPascalCase = toPascalCase;
  // Variable para almacenar el método actual
  private currentMetodoCalificacion: MetodoCalificacion = MetodoCalificacion.A1_E1_3_B0;

  constructor() {
    // Suscribirse al método de calificación del usuario
    this.userMetodoCalificacion$.subscribe(metodo => {
      this.currentMetodoCalificacion = metodo;
    });
  }

  public calcular100 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100(statsParsed.stats100, numPreguntas, this.currentMetodoCalificacion);
  };
  public calcular100y75 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y75(
      statsParsed.stats100,
      statsParsed.stats75,
      numPreguntas,
      this.currentMetodoCalificacion
    );
  };
  public calcular100y75y50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular100y75y50(
      statsParsed.stats100,
      statsParsed.stats75,
      statsParsed.stats50,
      numPreguntas,
      this.currentMetodoCalificacion
    );
  };

  @Memoize()
  public getBlockFlashcardBoxes(tests: Array<FlashcardTest & { stats: any }>) {
    const totals = tests.reduce(
      (prev, next) => {
        const estado = next.stats.estado;
        const bien = estado.BIEN.count;
        const mal = estado.MAL.count;
        const revisar = estado.REVISAR.count;

        // Sumar cada categoría
        prev[0].value += bien;
        prev[1].value += mal;
        prev[2].value += revisar;

        return prev;
      },
      [
        { color: colorFlashcardsCorrectas, value: 0, porcentaje: 0 },
        { color: colorFlashcardsIncorretas, value: 0, porcentaje: 0 },
        { color: colorFlashcardsRevisar, value: 0, porcentaje: 0 },
      ]
    );

    // Calcular el total global de todas las flashcards
    const totalGlobal = totals[0].value + totals[1].value + totals[2].value;

    // Calcular el porcentaje de cada categoría
    if (totalGlobal > 0) {
      totals[0].porcentaje = (totals[0].value / totalGlobal) * 100;
      totals[1].porcentaje = (totals[1].value / totalGlobal) * 100;
      totals[2].porcentaje = (totals[2].value / totalGlobal) * 100;
    }

    return totals;
  }

  @Memoize()
  public getFlashcardBarData(
    flashcardsBlock: Array<FlashcardTest & { stats: any }>
  ) {
    const labels = [] as Array<string>;
    const bienData = [] as Array<{ value: number; id: number }>;
    const malData = [] as Array<{ value: number; id: number }>;
    const revisarData = [] as Array<{ value: number; id: number }>;

    // Procesamos cada flashcard y calculamos los datos
    flashcardsBlock.forEach((flashcard) => {
      const estado = flashcard.stats.estado;

      const bien = estado.BIEN.count;
      const mal = estado.MAL.count;
      const revisar = estado.REVISAR.count;

      const total = bien + mal + revisar;

      bienData.push({ value: bien, id: flashcard.id });
      malData.push({ value: mal, id: flashcard.id });
      revisarData.push({ value: revisar, id: flashcard.id });

      const tipo = obtenerTipoDeTest(flashcard, this.type); // Obtener el tipo (similar a tests)
      const temas = obtenerTemas(flashcard, this.type, true); // Obtener los temas de la flashcard

      // Etiqueta para el eje X, incluyendo tipo y temas
      labels.push(`\n Tipo ${tipo} \n ${temas.split(', ').join('\n')}`);
    });

    // Configuración del gráfico en ECharts
    const chartOption: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: ['BIEN', 'MAL', 'REVISAR'],
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      grid: {
        containLabel: true,
      },
      series: [
        {
          name: 'BIEN',
          type: 'bar',
          stack: 'stats',
          data: bienData,
          itemStyle: { color: colorFlashcardsCorrectas },
          label: {
            show: true,
            position: 'inside',
            formatter: function (params: any) {
              const bienValue = bienData[params.dataIndex]?.value || 0;
              const malValue = malData[params.dataIndex]?.value || 0;
              const revisarValue = revisarData[params.dataIndex]?.value || 0;

              const total = bienValue + malValue + revisarValue;
              if (params.value === 0 || total === 0) return ''; // Ignorar etiquetas con valor 0 o total 0
              const porcentaje = ((params.value / total) * 100).toFixed(2);
              return `${params.value} (${porcentaje}%)`;
            },
          },
        },
        {
          name: 'MAL',
          type: 'bar',
          stack: 'stats',
          data: malData,
          itemStyle: { color: colorFlashcardsIncorretas },
          label: {
            show: true,
            position: 'inside',
            formatter: function (params: any) {
              const bienValue = bienData[params.dataIndex]?.value || 0;
              const malValue = malData[params.dataIndex]?.value || 0;
              const revisarValue = revisarData[params.dataIndex]?.value || 0;

              const total = bienValue + malValue + revisarValue;
              if (params.value === 0 || total === 0) return ''; // Ignorar etiquetas con valor 0 o total 0
              const porcentaje = ((params.value / total) * 100).toFixed(2);
              return `${params.value} (${porcentaje}%)`;
            },
          },
        },
        {
          name: 'REVISAR',
          type: 'bar',
          stack: 'stats',
          data: revisarData,
          itemStyle: { color: colorFlashcardsRevisar },
          label: {
            show: true,
            position: 'inside',
            formatter: function (params: any) {
              const bienValue = bienData[params.dataIndex]?.value || 0;
              const malValue = malData[params.dataIndex]?.value || 0;
              const revisarValue = revisarData[params.dataIndex]?.value || 0;

              const total = bienValue + malValue + revisarValue;
              if (params.value === 0 || total === 0) return ''; // Ignorar etiquetas con valor 0 o total 0
              const porcentaje = ((params.value / total) * 100).toFixed(2);
              return `${params.value} (${porcentaje}%)`;
            },
          },
        },
      ],
    };

    return { chartOption };
  }

  @Memoize()
  public getBlockBarData(testsBlock: Array<Test & { stats: any }>) {
    const labels = [] as Array<string>;
    const correctasData = [] as Array<{ value: number; id: number }>;
    const incorrectasData = [] as Array<{ value: number; id: number }>;
    const omitidasData = [] as Array<{ value: number; id: number }>;
    const dataSet100 = [] as Array<number>;
    const dataSet10050 = [] as Array<number>;
    const dataSet1007550 = [] as Array<number>;

    // Procesamos cada test y calculamos los datos
    testsBlock.forEach((test) => {
      const stat = getStats(test.stats);
      const correctas =
        stat.stats100.correctas +
        stat.stats50.correctas +
        stat.stats75.correctas;
      const totalIncorrectas =
        stat.stats100.incorrectas +
        stat.stats50.incorrectas +
        stat.stats75.incorrectas;
      const omitidas =
        (test.testPreguntas?.length ?? 0) - correctas - totalIncorrectas;

      // Ahora en lugar de solo el número, añadimos el id del test
      correctasData.push({ value: correctas, id: test.id });
      incorrectasData.push({ value: totalIncorrectas, id: test.id });
      omitidasData.push({ value: omitidas, id: test.id });
      dataSet100.push(
        Number(
          calcular100(stat.stats100, test.testPreguntas?.length ?? 0).toFixed(2)
        )
      );

      dataSet10050.push(
        Number(
          calcular100y75(
            stat.stats100,
            stat.stats75,
            test.testPreguntas?.length ?? 0
          ).toFixed(2)
        )
      );
      dataSet1007550.push(
        Number(
          calcular100y75y50(
            stat.stats100,
            stat.stats75,
            stat.stats50,
            test.testPreguntas?.length ?? 0
          ).toFixed(2)
        )
      );

      labels.push(
        `\n Tipo ${obtenerTipoDeTest(test, this.type)} \n ${obtenerTemas(
          test,
          this.type,
          true
        )
          .split(', ')
          .join('\n')}`
      );
    });

    // Configuración del gráfico en ECharts
    const chartOption: EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      legend: {
        data: [
          'Correctas',
          'Incorrectas',
          'Omitidas',
          '⭐',
          '⭐ + 👍',
          '⭐ + 👍 + 👎',
        ],
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      grid: {
        containLabel: true,
      },
      series: [
        {
          name: 'Correctas',
          type: 'bar',
          stack: 'stats',
          data: correctasData, // Incluye ahora el id del test en cada dato
          itemStyle: { color: colorCorrectas },
        },
        {
          name: 'Incorrectas',
          type: 'bar',
          stack: 'stats',
          data: incorrectasData, // Incluye ahora el id del test en cada dato
          itemStyle: { color: colorIncorretas },
        },
        {
          name: 'Omitidas',
          type: 'bar',
          stack: 'stats',
          data: omitidasData, // Incluye ahora el id del test en cada dato
          itemStyle: { color: colorSinResponder },
        },
        {
          name: '⭐',
          type: 'line',
          data: dataSet100,
          yAxisIndex: 0,
          lineStyle: {
            color: '#4CAF50', // Verde brillante
            width: 2,
          },
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#4CAF50',
          },
        },
        {
          name: '⭐ + 👎',
          type: 'line',
          data: dataSet10050,
          yAxisIndex: 0,
          lineStyle: {
            color: '#2196F3', // Azul brillante
            width: 2,
          },
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#2196F3',
          },
        },
        {
          name: '⭐ + 👍 + 👎',
          type: 'line',
          data: dataSet1007550,
          yAxisIndex: 0,
          lineStyle: {
            color: '#FF5722', // Naranja profundo
            width: 2,
          },
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#FF5722',
          },
        },
      ],
    };

    return { chartOption };
  }

  @Memoize()
  public obtainAllTests(stats: any) {
    const allTests = Object.keys(stats).reduce((prev, next) => {
      prev = stats[next];
      return prev;
    }, []);
    return allTests;
  }

  @Memoize()
  public obtainEstadoGlobal(stats: any) {
    const allTests = this.obtainAllTests(stats);

    const resultado = {
      BIEN: { count: 0 },
      MAL: { count: 0 },
      REVISAR: { count: 0 },
    };

    allTests.forEach((test: any) => {
      const { estado } = test.stats;

      resultado.BIEN.count += estado.BIEN.count;
      resultado.MAL.count += estado.MAL.count;
      resultado.REVISAR.count += estado.REVISAR.count;
    });

    return resultado;
  }
  @Memoize()
  public getDataFromFlashcards(stats: any) {
    return getDataFromFlashcards(stats);
  }

  @Memoize()
  public obtainSeguridadGlobal(stats: any) {
    const allTests = this.obtainAllTests(stats);
    const resultado = {
      CINCUENTA_POR_CIENTO: {
        correctas: 0,
        incorrectas: 0,
        noRespondidas: 0,
      },
      SETENTA_Y_CINCO_POR_CIENTO: {
        correctas: 0,
        incorrectas: 0,
        noRespondidas: 0,
      },
      CIEN_POR_CIENTO: { correctas: 0, incorrectas: 0, noRespondidas: 0 },
    };

    // Recorrer todos los tests
    allTests.forEach((test: any) => {
      const { seguridad } = test.stats;

      // Sumar estadísticas para cada categoría
      resultado.CINCUENTA_POR_CIENTO.correctas +=
        seguridad.CINCUENTA_POR_CIENTO.correctas;
      resultado.CINCUENTA_POR_CIENTO.incorrectas +=
        seguridad.CINCUENTA_POR_CIENTO.incorrectas;
      resultado.CINCUENTA_POR_CIENTO.noRespondidas +=
        seguridad.CINCUENTA_POR_CIENTO.noRespondidas;

      resultado.SETENTA_Y_CINCO_POR_CIENTO.correctas +=
        seguridad.SETENTA_Y_CINCO_POR_CIENTO.correctas;
      resultado.SETENTA_Y_CINCO_POR_CIENTO.incorrectas +=
        seguridad.SETENTA_Y_CINCO_POR_CIENTO.incorrectas;
      resultado.SETENTA_Y_CINCO_POR_CIENTO.noRespondidas +=
        seguridad.SETENTA_Y_CINCO_POR_CIENTO.noRespondidas;

      resultado.CIEN_POR_CIENTO.correctas +=
        seguridad.CIEN_POR_CIENTO.correctas;
      resultado.CIEN_POR_CIENTO.incorrectas +=
        seguridad.CIEN_POR_CIENTO.incorrectas;
      resultado.CIEN_POR_CIENTO.noRespondidas +=
        seguridad.CIEN_POR_CIENTO.noRespondidas;
    });
    return resultado;
  }

  @Memoize()
  public obtenerGraficosDificultadesTest(tests: Array<Test & { stats: any }>) {
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
    return blockStats;
  }

  public calcularMediaCategoria = (tests: Array<Test & { stats: any }>) => {
    const totalTests = tests.length;
    let totalPreguntas = 0;
    const blockStats = this.obtenerGraficosDificultadesTest(tests);
    tests.forEach((test) => {
      totalPreguntas += test.testPreguntas?.length ?? 0;
    });
    const total100 = tests.reduce((prev, next) => {
      prev =
        prev + this.calcular100(next.stats, next.testPreguntas?.length ?? 0);
      return prev;
    }, 0);
    const total10050 = tests.reduce((prev, next) => {
      prev =
        prev + this.calcular100y75(next.stats, next.testPreguntas?.length ?? 0);
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
      total100: total100 == 0 ? total100 : total100 / totalTests,
      totalPreguntas: totalPreguntas ?? 0,
      blockStats,
    };
  };

  commMap = (from: Date, to: Date, temas: Array<string>) => {
    return {
      ADMIN: {
        FLASHCARDS: this.flashcardService.getStatsByCategoryAdmin({
          from,
          to,
          temas,
        }),
        TESTS: this.testService.getStatsByCategoryAdmin({ from, to, temas }),
      },
      ALUMNO: {
        FLASHCARDS: this.flashcardService.getStatsByCategory({
          from,
          to,
          temas,
        }),
        TESTS: this.testService.getStatsByCategory({ from, to, temas }),
      },
    };
  };



  private getFullStats() {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      switchMap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        const { from, to, temas } = queryParams;
        this.type = type;
        this.expectedRole = expectedRole;
        this.from = new Date(from);
        this.to = new Date(to);
        this.temas = !temas ? [] : (temas as string).split(',');
        return this.commMap(new Date(from), new Date(to), this.temas)[
          this.expectedRole
        ][this.type];
      })
    );
  }

  onChartClick(event: any): void {
    const clickedTestId = event.data.id;
    const mapRoute = {
      ALUMNO: {
        FLASHCARDS: 'app/test/alumno/stats-test-flashcard',
        TESTS: 'app/test/alumno/stats-test',
      },
      ADMIN: {
        FLASHCARDS: 'app/test/stats-test-flashcard',
        TESTS: 'app/test/stats-test',
      },
    };
    this.router.navigate(
      [mapRoute[this.expectedRole][this.type] + '/' + clickedTestId],
      {
        queryParams: {
          goBack: true,
        },
      }
    );
  }
}
