import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EChartsOption } from 'echarts';
import { Memoize } from 'lodash-decorators';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { ViewportService } from '../../../services/viewport.service';
import { KpiStat } from '../../../shared/components/kpi-stats-cards/kpi-stats-cards.component';
import { getDataFromFlashcards } from '../../../utils/utils';

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
  viewportService = inject(ViewportService);

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public test$ = this.testService.getTestById(Number(this.getId()));
  public stats$ = this.testService.getStats(Number(this.getId()));

  @Memoize()
  getDataFromSeguridad(data: any) {
    return getDataFromFlashcards(data);
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/alumno/realizar-flash-cards-test']);
    }
  }

  // Métodos para estadísticas
  public getTotalFlashcards(stat: any): number {
    const data = this.getDataFromSeguridad(stat);
    return data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
  }

  public getAprendidas(stat: any): number {
    const data = this.getDataFromSeguridad(stat);
    return data.datasets[0].data[0] || 0;
  }

  public getRepasar(stat: any): number {
    const data = this.getDataFromSeguridad(stat);
    return data.datasets[0].data[1] || 0;
  }

  public getDificultad(stat: any): number {
    const data = this.getDataFromSeguridad(stat);
    return data.datasets[0].data[2] || 0;
  }

  public getCompletionPercentage(stat: any): number {
    const total = this.getTotalFlashcards(stat);
    if (!total) return 0;
    return Math.round((this.getAprendidas(stat) / total) * 100);
  }

  public getPercentage(stat: any, type: 'aprendidas' | 'repasar' | 'dificultad'): number {
    const total = this.getTotalFlashcards(stat);
    if (!total) return 0;

    let value: number;
    switch (type) {
      case 'aprendidas':
        value = this.getAprendidas(stat);
        break;
      case 'repasar':
        value = this.getRepasar(stat);
        break;
      case 'dificultad':
        value = this.getDificultad(stat);
        break;
    }

    return Math.round((value / total) * 100);
  }

  // Método para los componentes reutilizables
  getKpiStatsForFlashcards(stat: any): KpiStat[] {
    return [
      {
        value: this.getAprendidas(stat),
        label: 'Aprendidas',
        type: 'correctas',
        icon: 'pi-check'
      },
      {
        value: this.getRepasar(stat),
        label: 'Para Repasar',
        type: 'repasar',
        icon: 'pi-refresh'
      },
      {
        value: this.getDificultad(stat),
        label: 'Con Dificultad',
        type: 'incorrectas',
        icon: 'pi-times'
      }
    ];
  }

  // Configuración del gráfico circular
  public getNotaFinalChartOptions(stat: any): EChartsOption {
    const aprendidas = this.getAprendidas(stat);
    const repasar = this.getRepasar(stat);
    const dificultad = this.getDificultad(stat);

    return {
      series: [
        {
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          label: {
            show: false
          },
          emphasis: {
            scale: false
          },
          labelLine: {
            show: false
          },
          animation: false,
          data: [
            {
              value: aprendidas,
              name: 'Aprendidas',
              itemStyle: { color: '#4caf50' }
            },
            {
              value: repasar,
              name: 'Para Repasar',
              itemStyle: { color: '#ff9800' }
            },
            {
              value: dificultad,
              name: 'Con Dificultad',
              itemStyle: { color: '#f44336' }
            }
          ]
        }
      ]
    };
  }

}
