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
import { ConfidenceAnalysis } from '../../../shared/components/confidence-analysis-cards/confidence-analysis-cards.component';
import { KpiStat } from '../../../shared/components/kpi-stats-cards/kpi-stats-cards.component';
import { FlashcardTest } from '../../../shared/models/flashcard.model';
import { Test } from '../../../shared/models/test.model';
import { MetodoCalificacion } from '../../../shared/models/user.model';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion } from '../../../store/user/user.selectors';
import {
  calcular100,
  calcular50,
  calcular75,
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
  public calcular75 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular75(
      statsParsed.stats75,
      numPreguntas,
      this.currentMetodoCalificacion
    );
  };
  public calcular50 = (rawStats: any, numPreguntas: number) => {
    const statsParsed = getStats(rawStats);
    return calcular50(
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
    const dataSet75 = [] as Array<number>;
    const dataSet50 = [] as Array<number>;

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
          this.calcular100(test.stats, test.testPreguntas?.length ?? 0).toFixed(2)
        )
      );

      dataSet75.push(
        Number(
          this.calcular75(test.stats, test.testPreguntas?.length ?? 0).toFixed(2)
        )
      );
      
      dataSet50.push(
        Number(
          this.calcular50(test.stats, test.testPreguntas?.length ?? 0).toFixed(2)
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
          '⭐ (100%)',
          '👍 (75%)',
          '👎 (50%)',
        ],
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          interval: 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Preguntas',
          position: 'left',
        },
        {
          type: 'value',
          name: 'Nota',
          position: 'right',
          min: 0,
          max: 10,
        }
      ],
      grid: {
        containLabel: true,
      },
      series: [
        {
          name: 'Correctas',
          type: 'bar',
          stack: 'stats',
          data: correctasData,
          itemStyle: { color: colorCorrectas },
          yAxisIndex: 0,
        },
        {
          name: 'Incorrectas',
          type: 'bar',
          stack: 'stats',
          data: incorrectasData,
          itemStyle: { color: colorIncorretas },
          yAxisIndex: 0,
        },
        {
          name: 'Omitidas',
          type: 'bar',
          stack: 'stats',
          data: omitidasData,
          itemStyle: { color: colorSinResponder },
          yAxisIndex: 0,
        },
        {
          name: '⭐ (100%)',
          type: 'line',
          data: dataSet100,
          yAxisIndex: 1,
          lineStyle: {
            color: '#4CAF50',
            width: 3,
          },
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#4CAF50',
          },
        },
        {
          name: '👍 (75%)',
          type: 'line',
          data: dataSet75,
          yAxisIndex: 1,
          lineStyle: {
            color: '#2196F3',
            width: 3,
          },
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: {
            color: '#2196F3',
          },
        },
        {
          name: '👎 (50%)',
          type: 'line',
          data: dataSet50,
          yAxisIndex: 1,
          lineStyle: {
            color: '#FF5722',
            width: 3,
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
  public getNotaFinalChartOptions(nota: number): EChartsOption {
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 10,
          splitNumber: 10,
          itemStyle: {
            color: '#58D68D',
          },
          progress: {
            show: true,
            roundCap: true,
            width: 18,
          },
          pointer: {
            show: false,
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 18,
            },
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            show: false,
          },
          anchor: {
            show: false,
          },
          title: {
            show: false,
          },
          detail: {
            show: true,
            valueAnimation: true,
            offsetCenter: [0, '0%'],
            fontSize: 30,
            fontWeight: 'bold',
            formatter: '{value}',
            color: 'inherit',
          },
          data: [
            {
              value: nota,
            },
          ],
        },
      ],
    };
  }

  public getNotaChartOptions(nota: number): EChartsOption {
    return {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 10,
          splitNumber: 10,
          radius: '100%',
          itemStyle: {
            color: '#58D68D',
          },
          progress: {
            show: true,
            roundCap: true,
            width: 18,
          },
          pointer: {
            show: false,
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 18,
            },
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            show: false,
          },
          anchor: {
            show: false,
          },
          title: {
            show: false,
          },
          detail: {
            show: true,
            valueAnimation: true,
            offsetCenter: [0, '0%'],
            fontSize: 24,
            fontWeight: 'bold',
            formatter: '{value}',
            color: 'inherit',
          },
          data: [
            {
              value: nota,
            },
          ],
        },
      ],
    };
  }

  public obtainTotalPreguntasPorSeguridad(tests: Array<Test & { stats: any }>, nivelSeguridad: number): number {
    return tests.reduce((total, test) => {
      const stats = getStats(test.stats);
      if (nivelSeguridad === 100) {
        return total + stats.stats100.correctas + stats.stats100.incorrectas + stats.stats100.noRespondidas;
      } else if (nivelSeguridad === 75) {
        return total + stats.stats75.correctas + stats.stats75.incorrectas + stats.stats75.noRespondidas;
      } else if (nivelSeguridad === 50) {
        return total + stats.stats50.correctas + stats.stats50.incorrectas + stats.stats50.noRespondidas;
      } else if (nivelSeguridad === 0) {
        return total + stats.stats0.correctas + stats.stats0.incorrectas + stats.stats0.noRespondidas;
      }
      return total;
    }, 0);
  }

  public obtainNoContestadasPorSeguridad(tests: Array<Test & { stats: any }>, nivelSeguridad: number): number {
    return tests.reduce((total, test) => {
      const stats = getStats(test.stats);
      if (nivelSeguridad === 100) {
        return total + stats.stats100.noRespondidas;
      } else if (nivelSeguridad === 75) {
        return total + stats.stats75.noRespondidas;
      } else if (nivelSeguridad === 50) {
        return total + stats.stats50.noRespondidas;
      } else if (nivelSeguridad === 0) {
        return total + stats.stats0.noRespondidas;
      }
      return total;
    }, 0);
  }

  public obtainAccuracyPorSeguridad(tests: Array<Test & { stats: any }>, nivelSeguridad: number): number {
    let correctas = this.obtainCorrectasPorSeguridad(tests, nivelSeguridad);
    let total = correctas + this.obtainIncorrectasPorSeguridad(tests, nivelSeguridad);
    return total > 0 ? Math.round((correctas / total) * 100) : 0;
  }

  public calcularMediaPorSeguridad(tests: Array<Test & { stats: any }>, nivelSeguridad: number): number {
    let totalCorrectas = 0;
    let totalPreguntas = 0;

    tests.forEach((test) => {
      const stats = getStats(test.stats);
      if (nivelSeguridad === 100) {
        totalCorrectas += stats.stats100.correctas;
        totalPreguntas += stats.stats100.correctas + stats.stats100.incorrectas;
      } else if (nivelSeguridad === 75) {
        totalCorrectas += stats.stats75.correctas;
        totalPreguntas += stats.stats75.correctas + stats.stats75.incorrectas;
      } else if (nivelSeguridad === 50) {
        totalCorrectas += stats.stats50.correctas;
        totalPreguntas += stats.stats50.correctas + stats.stats50.incorrectas;
      } else if (nivelSeguridad === 0) {
        totalCorrectas += stats.stats0.correctas;
        totalPreguntas += stats.stats0.correctas + stats.stats0.incorrectas;
      }
    });

    return totalPreguntas > 0 ? (totalCorrectas / totalPreguntas) * 10 : 0;
  }

  public obtainCorrectasPorSeguridad(tests: Array<Test & { stats: any }>, nivelSeguridad: number): number {
    return tests.reduce((total, test) => {
      const stats = getStats(test.stats);
      if (nivelSeguridad === 100) {
        return total + stats.stats100.correctas;
      } else if (nivelSeguridad === 75) {
        return total + stats.stats75.correctas;
      } else if (nivelSeguridad === 50) {
        return total + stats.stats50.correctas;
      } else if (nivelSeguridad === 0) {
        return total + stats.stats0.correctas;
      }
      return total;
    }, 0);
  }

  public obtainIncorrectasPorSeguridad(tests: Array<Test & { stats: any }>, nivelSeguridad: number): number {
    return tests.reduce((total, test) => {
      const stats = getStats(test.stats);
      if (nivelSeguridad === 100) {
        return total + stats.stats100.incorrectas;
      } else if (nivelSeguridad === 75) {
        return total + stats.stats75.incorrectas;
      } else if (nivelSeguridad === 50) {
        return total + stats.stats50.incorrectas;
      } else if (nivelSeguridad === 0) {
        return total + stats.stats0.incorrectas;
      }
      return total;
    }, 0);
  }

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
    const total75 = tests.reduce((prev, next) => {
      prev =
        prev + this.calcular75(next.stats, next.testPreguntas?.length ?? 0);
      return prev;
    }, 0);
    const total50 = tests.reduce((prev, next) => {
      prev =
        prev + this.calcular50(next.stats, next.testPreguntas?.length ?? 0);
      return prev;
    }, 0);
    return {
      totalTests: totalTests,
      total75: total75 == 0 ? total75 : total75 / totalTests,
      total50: total50 == 0 ? total50 : total50 / totalTests,
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



  // Métodos para mapear datos a los componentes reutilizables
  getKpiStatsForTests(mediaBloque: any): KpiStat[] {
    return [
      {
        value: mediaBloque.blockStats.correctas,
        label: 'Correctas',
        type: 'correctas',
        icon: 'pi-check'
      },
      {
        value: mediaBloque.blockStats.incorrectas,
        label: 'Incorrectas',
        type: 'incorrectas',
        icon: 'pi-times'
      },
      {
        value: mediaBloque.blockStats.omitidas,
        label: 'Sin Contestar',
        type: 'no-contestadas',
        icon: 'pi-minus'
      }
    ];
  }

  getKpiStatsForFlashcards(blocks: any[]): KpiStat[] {
    const labels = ['Aprendidas', 'Con Dificultad', 'Para Repasar'];
    const types: ('correctas' | 'incorrectas' | 'repasar')[] = ['correctas', 'incorrectas', 'repasar'];
    const icons = ['pi-check', 'pi-times', 'pi-refresh'];
    
    return blocks.map((block, i) => ({
      value: block.value,
      label: labels[i],
      type: types[i],
      icon: icons[i]
    }));
  }

  getConfidenceAnalysisForTests(tests: Array<Test & { stats: any }>): ConfidenceAnalysis[] {
    return [
      {
        id: 'cien',
        title: '100% Seguro',
        icon: '⭐',
        score: this.calcularMediaPorSeguridad(tests, 100),
        totalPreguntas: this.obtainTotalPreguntasPorSeguridad(tests, 100),
        correctas: this.obtainCorrectasPorSeguridad(tests, 100),
        incorrectas: this.obtainIncorrectasPorSeguridad(tests, 100),
        noContestadas: this.obtainNoContestadasPorSeguridad(tests, 100),
        accuracyPercentage: this.obtainAccuracyPorSeguridad(tests, 100)
      },
      {
        id: 'setenta-cinco',
        title: '75% Seguro',
        icon: '👍',
        score: this.calcularMediaPorSeguridad(tests, 75),
        totalPreguntas: this.obtainTotalPreguntasPorSeguridad(tests, 75),
        correctas: this.obtainCorrectasPorSeguridad(tests, 75),
        incorrectas: this.obtainIncorrectasPorSeguridad(tests, 75),
        noContestadas: this.obtainNoContestadasPorSeguridad(tests, 75),
        accuracyPercentage: this.obtainAccuracyPorSeguridad(tests, 75)
      },
      {
        id: 'cincuenta',
        title: '50% Seguro',
        icon: '👎',
        score: this.calcularMediaPorSeguridad(tests, 50),
        totalPreguntas: this.obtainTotalPreguntasPorSeguridad(tests, 50),
        correctas: this.obtainCorrectasPorSeguridad(tests, 50),
        incorrectas: this.obtainIncorrectasPorSeguridad(tests, 50),
        noContestadas: this.obtainNoContestadasPorSeguridad(tests, 50),
        accuracyPercentage: this.obtainAccuracyPorSeguridad(tests, 50)
      },
      {
        id: 'cero',
        title: '0% Seguro',
        icon: '❌',
        score: this.calcularMediaPorSeguridad(tests, 0),
        totalPreguntas: this.obtainTotalPreguntasPorSeguridad(tests, 0),
        correctas: this.obtainCorrectasPorSeguridad(tests, 0),
        incorrectas: this.obtainIncorrectasPorSeguridad(tests, 0),
        noContestadas: this.obtainNoContestadasPorSeguridad(tests, 0),
        accuracyPercentage: this.obtainAccuracyPorSeguridad(tests, 0)
      }
    ];
  }

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
