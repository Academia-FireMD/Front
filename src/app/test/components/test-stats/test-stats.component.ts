import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { EChartsOption } from 'echarts';
import { tap } from 'rxjs';
import { TestService } from '../../../services/test.service';
import { ViewportService } from '../../../services/viewport.service';
import { ConfidenceAnalysis } from '../../../shared/components/confidence-analysis-cards/confidence-analysis-cards.component';
import { KpiStat } from '../../../shared/components/kpi-stats-cards/kpi-stats-cards.component';
import { SeguridadAlResponder } from '../../../shared/models/pregunta.model';
import { Test } from '../../../shared/models/test.model';
import { MetodoCalificacion } from '../../../shared/models/user.model';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion } from '../../../store/user/user.selectors';
import {
    calcular0,
    calcular100,
    calcular100y50,
    calcular100y75y50,
    calcular50,
    calcular75,
    getStats,
} from '../../../utils/utils';

interface ConfidenceCard {
  id: string;
  title: string;
  icon: string;
  seguridadKey: string;
  calcularNota: () => number;
}

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
  store = inject(Store<AppState>);

  // Selector para obtener el método de calificación del usuario
  userMetodoCalificacion$ = this.store.select(selectUserMetodoCalificacion);

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
  public viewportService = inject(ViewportService);

  // Variable para almacenar el método actual
  private currentMetodoCalificacion: MetodoCalificacion =
    MetodoCalificacion.A1_E1_3_B0;

  public showIndividualConfidence = false;

  // Configuración de las tarjetas de confianza
  confidenceCards: ConfidenceCard[] = [
    {
      id: 'cien',
      title: '100% Seguro',
      icon: '⭐',
      seguridadKey: 'CIEN_POR_CIENTO',
      calcularNota: () => this.calcular100(),
    },
    {
      id: 'setenta-cinco',
      title: '75% Seguro',
      icon: '👍',
      seguridadKey: 'SETENTA_Y_CINCO_POR_CIENTO',
      calcularNota: () => this.calcular75(),
    },
    {
      id: 'cincuenta',
      title: '50% Seguro',
      icon: '👎',
      seguridadKey: 'CINCUENTA_POR_CIENTO',
      calcularNota: () => this.calcular50(),
    },
    {
      id: 'cero',
      title: '0% Seguro',
      icon: '❌',
      seguridadKey: 'CERO_POR_CIENTO',
      calcularNota: () => this.calcular0(),
    },
  ];

  constructor() {
    // Suscribirse al método de calificación del usuario
    this.userMetodoCalificacion$.subscribe((metodo) => {
      this.currentMetodoCalificacion = metodo;
    });
  }

  public calcular100() {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100 } = getStats(this.lastLoadedStats);
    return calcular100(
      stats100,
      this.lastLoadedTest.preguntas.length,
      this.currentMetodoCalificacion
    );
  }

  public calcular75(): number {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats75 } = getStats(this.lastLoadedStats);
    return calcular75(
      stats75,
      this.lastLoadedTest.preguntas.length,
      this.currentMetodoCalificacion
    );
  }

  public calcular50(): number {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats50 } = getStats(this.lastLoadedStats);
    return calcular50(
      stats50,
      this.lastLoadedTest.preguntas.length,
      this.currentMetodoCalificacion
    );
  }

  public calcular0(): number {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats0 } = getStats(this.lastLoadedStats);
    return calcular0(
      stats0,
      this.lastLoadedTest.preguntas.length,
      this.currentMetodoCalificacion
    );
  }

  public calcular100y50(): number {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100, stats50 } = getStats(this.lastLoadedStats);
    return calcular100y50(
      stats100,
      stats50,
      this.lastLoadedTest.preguntas.length,
      this.currentMetodoCalificacion
    );
  }

  public calcular100y75y50(): number {
    if (!this.lastLoadedStats || !this.lastLoadedTest) return 0;
    const { stats100, stats75, stats50 } = getStats(this.lastLoadedStats);
    return calcular100y75y50(
      stats100,
      stats75,
      stats50,
      this.lastLoadedTest.preguntas.length,
      this.currentMetodoCalificacion
    );
  }

  // Métodos helper para las estadísticas
  public getTotalCorrectas(stat: any): number {
    if (!stat?.seguridad) return 0;
    return Object.values(stat.seguridad).reduce(
      (total: number, seguridad: any) => {
        return total + (seguridad.correctas || 0);
      },
      0
    );
  }

  public getTotalIncorrectas(stat: any): number {
    if (!stat?.seguridad) return 0;
    return Object.values(stat.seguridad).reduce(
      (total: number, seguridad: any) => {
        return total + (seguridad.incorrectas || 0);
      },
      0
    );
  }

  public getTotalNoContestadas(stat: any): number {
    if (!stat?.seguridad) return 0;
    return Object.values(stat.seguridad).reduce(
      (total: number, seguridad: any) => {
        return total + (seguridad.noRespondidas || 0);
      },
      0
    );
  }

  public getTotalPreguntas(stat: any, tipoSeguridad: string): number {
    if (!stat?.seguridad?.[tipoSeguridad]) return 0;
    const seguridad = stat.seguridad[tipoSeguridad];
    return (
      (seguridad.correctas || 0) +
      (seguridad.incorrectas || 0) +
      (seguridad.noRespondidas || 0)
    );
  }

  public getCorrectas(stat: any, tipoSeguridad: string): number {
    return stat?.seguridad?.[tipoSeguridad]?.correctas || 0;
  }

  public getIncorrectas(stat: any, tipoSeguridad: string): number {
    return stat?.seguridad?.[tipoSeguridad]?.incorrectas || 0;
  }

  public getNoContestadas(stat: any, tipoSeguridad: string): number {
    return stat?.seguridad?.[tipoSeguridad]?.noRespondidas || 0;
  }

  public getAccuracyPercentage(stat: any, tipoSeguridad: string): number {
    const total = this.getTotalPreguntas(stat, tipoSeguridad);
    if (total === 0) return 0;
    const correctas = this.getCorrectas(stat, tipoSeguridad);
    return Math.round((correctas / total) * 100);
  }

  // Métodos para estadísticas combinadas
  public getCombinedCorrects(stat: any, tipos: string[]): number {
    if (!stat?.seguridad) return 0;
    return tipos.reduce((total, tipo) => {
      return total + (stat.seguridad[tipo]?.correctas || 0);
    }, 0);
  }

  public getCombinedIncorrects(stat: any, tipos: string[]): number {
    if (!stat?.seguridad) return 0;
    return tipos.reduce((total, tipo) => {
      return total + (stat.seguridad[tipo]?.incorrectas || 0);
    }, 0);
  }

  public getCombinedNoAnswered(stat: any, tipos: string[]): number {
    if (!stat?.seguridad) return 0;
    return tipos.reduce((total, tipo) => {
      return total + (stat.seguridad[tipo]?.noRespondidas || 0);
    }, 0);
  }

  public getCombinedTotal(stat: any, tipos: string[]): number {
    return this.getCombinedCorrects(stat, tipos) +
      this.getCombinedIncorrects(stat, tipos) +
      this.getCombinedNoAnswered(stat, tipos);
  }

  public getCombinedAccuracy(stat: any, tipos: string[]): number {
    const total = this.getCombinedTotal(stat, tipos);
    if (total === 0) return 0;
    const correctas = this.getCombinedCorrects(stat, tipos);
    return Math.round((correctas / total) * 100);
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/alumno/realizar-test']);
    }
  }

  public verRespuestas(): void {
    this.router.navigate(
      ['/app/test/alumno/realizar-test/modo-ver-respuestas/' + this.getId()],
      {
        queryParams: {
          goBack: true,
        },
      }
    );
  }



  public toggleIndividualConfidence() {
    this.showIndividualConfidence = !this.showIndividualConfidence;
  }

  // Método para optimizar el rendimiento del ngFor
  public trackByCardId(index: number, card: ConfidenceCard): string {
    return card.id;
  }

  // Métodos para los componentes reutilizables
  getKpiStatsForTestStats(stat: any): KpiStat[] {
    return [
      {
        value: this.getTotalCorrectas(stat),
        label: 'Correctas',
        type: 'correctas',
        icon: 'pi-check',
      },
      {
        value: this.getTotalIncorrectas(stat),
        label: 'Incorrectas',
        type: 'incorrectas',
        icon: 'pi-times',
      },
      {
        value: this.getTotalNoContestadas(stat),
        label: 'No contestadas',
        type: 'no-contestadas',
        icon: 'pi-minus',
      },
    ];
  }

  getConfidenceAnalysisForTestStats(stat: any): ConfidenceAnalysis[] {
    return this.confidenceCards.map((card) => ({
      id: card.id,
      title: card.title,
      icon: card.icon,
      score: card.calcularNota(),
      totalPreguntas: this.getTotalPreguntas(stat, card.seguridadKey),
      correctas: this.getCorrectas(stat, card.seguridadKey),
      incorrectas: this.getIncorrectas(stat, card.seguridadKey),
      noContestadas: this.getNoContestadas(stat, card.seguridadKey),
      accuracyPercentage: this.getAccuracyPercentage(stat, card.seguridadKey),
      buttonLabel: 'Analizar Errores',
      buttonDisabled: true,
    }));
  }

  getCombinedConfidenceAnalysis(stat: any): ConfidenceAnalysis[] {
    const combinations = [
      {
        id: 'only-100',
        title: 'Solo 100% Seguro',
        icon: '⭐',
        tipos: ['CIEN_POR_CIENTO'],
        calcularNota: () => this.calcular100()
      },
      {
        id: 'combined-100-50',
        title: '100% + 50% Seguro',
        icon: '🎯',
        tipos: ['CIEN_POR_CIENTO', 'CINCUENTA_POR_CIENTO'],
        calcularNota: () => this.calcular100y50()
      },
      {
        id: 'combined-100-75-50',
        title: '100% + 75% + 50% Seguro',
        icon: '📈',
        tipos: ['CIEN_POR_CIENTO', 'SETENTA_Y_CINCO_POR_CIENTO', 'CINCUENTA_POR_CIENTO'],
        calcularNota: () => this.calcular100y75y50()
      }
    ];

    return combinations.map(combination => ({
      id: combination.id,
      title: combination.title,
      icon: combination.icon,
      score: combination.calcularNota(),
      totalPreguntas: this.getCombinedTotal(stat, combination.tipos),
      correctas: this.getCombinedCorrects(stat, combination.tipos),
      incorrectas: this.getCombinedIncorrects(stat, combination.tipos),
      noContestadas: this.getCombinedNoAnswered(stat, combination.tipos),
      accuracyPercentage: this.getCombinedAccuracy(stat, combination.tipos),
      buttonLabel: 'Ver Detalles',
      buttonDisabled: true,
    }));
  }

  // Métodos para crear las opciones de los donut charts
  private getNotaColor(nota: number): string {
    if (nota >= 7) return '#4caf50'; // Verde para notas buenas
    if (nota >= 4) return '#ff9800'; // Naranja para notas medias
    return '#f44336'; // Rojo para notas malas
  }

  private getLightColor(baseColor: string): string {
    const colors = {
      '#4caf50': '#e8f5e8', // Verde claro
      '#ff9800': '#fff3e0', // Naranja claro
      '#f44336': '#ffebee', // Rojo claro
    };
    return colors[baseColor as keyof typeof colors] || '#f5f5f5';
  }

  public getNotaFinalChartOptions(): EChartsOption {
    const nota = this.calcular100();

    const color = this.getNotaColor(nota);
    const lightColor = this.getLightColor(color);

    // Si la nota es 0, usar un valor mínimo visible para mostrar la etiqueta
    const notaValue = nota === 0 ? 0.1 : nota;
    const restanteValue = nota === 0 ? 9.9 : 10 - nota;

    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'pie',
          radius: ['60%', '90%'],
          center: ['50%', '50%'],
          startAngle: 90,
          data: [
            {
              value: notaValue,
              name: `Nota_${nota}`, // Guardar el valor original
              itemStyle: {
                color: color,
              },
            },
            {
              value: restanteValue,
              name: 'Restante',
              itemStyle: {
                color: lightColor,
              },
            },
          ],
          label: {
            show: true,
            position: 'center',
            formatter: (params: any) => {
              const data = params.data || params;
              if (data.name && data.name.startsWith('Nota_')) {
                // Extraer el valor original del name
                const notaReal = parseFloat(data.name.replace('Nota_', ''));
                return `${notaReal.toFixed(2)}/10`;
              }
              return '0/10';
            },
            fontSize: 16,
            fontWeight: 'bold',
            color: '#333',
          },
          emphasis: {
            disabled: true,
          },
        },
      ],
      // Asegurar que el gráfico se redimensione automáticamente
      media: [
        {
          query: { maxWidth: 768 },
          option: {
            series: [
              {
                radius: ['50%', '80%'],
                label: {
                  fontSize: 14,
                },
              },
            ],
          },
        },
      ],
    };
  }

  public getNotaChartOptions(nota: number): EChartsOption {
    const color = this.getNotaColor(nota);
    const lightColor = this.getLightColor(color);

    // Si la nota es 0, usar un valor mínimo visible para mostrar la etiqueta
    const notaValue = nota === 0 ? 0.1 : nota;
    const restanteValue = nota === 0 ? 9.9 : 10 - nota;

    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'pie',
          radius: ['50%', '80%'],
          center: ['50%', '50%'],
          startAngle: 90,
          data: [
            {
              value: notaValue,
              name: `Nota_${nota}`, // Guardar el valor original
              itemStyle: {
                color: color,
              },
            },
            {
              value: restanteValue,
              name: 'Restante',
              itemStyle: {
                color: lightColor,
              },
            },
          ],
          label: {
            show: true,
            position: 'center',
            formatter: (params: any) => {
              const data = params.data || params;
              if (data.name && data.name.startsWith('Nota_')) {
                // Extraer el valor original del name
                const notaReal = parseFloat(data.name.replace('Nota_', ''));
                return `${notaReal.toFixed(2)}/10`;
              }
              return '0/10';
            },
            fontSize: 14,
            fontWeight: 'bold',
            color: '#333',
          },
          emphasis: {
            disabled: true,
          },
        },
      ],
      // Asegurar que el gráfico se redimensione automáticamente
      media: [
        {
          query: { maxWidth: 768 },
          option: {
            series: [
              {
                radius: ['40%', '70%'],
                label: {
                  fontSize: 12,
                },
              },
            ],
          },
        },
      ],
    };
  }
}
