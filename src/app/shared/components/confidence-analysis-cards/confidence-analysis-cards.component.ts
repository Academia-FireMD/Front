import { Component, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Memoize } from 'lodash-decorators';

export interface ConfidenceAnalysis {
  id: string;
  title: string;
  icon: string;
  score: number;
  totalPreguntas: number;
  correctas: number;
  incorrectas: number;
  noContestadas: number;
  accuracyPercentage: number;
  buttonLabel?: string;
  buttonDisabled?: boolean;
  onButtonClick?: () => void;
}

@Component({
  selector: 'app-confidence-analysis-cards',
  templateUrl: './confidence-analysis-cards.component.html',
  styleUrl: './confidence-analysis-cards.component.scss',
})
export class ConfidenceAnalysisCardsComponent implements OnInit, OnDestroy {
  @Input() analyses: ConfidenceAnalysis[] = [];
  @Input() cardCol: string = "md:col-3";
  // Cache de IDs para evitar regeneración en cada detección de cambios
  private chartIdCache = new Map<string, string>();
  private componentId: string = '';

  constructor(private elementRef: ElementRef) { }

  ngOnInit(): void {
    // Generar ID único para este componente
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    this.componentId = `conf-comp-${timestamp}-${random}`;
  }

  // Método para generar IDs únicos para cada gráfico (solo una vez)
  getChartId(analysisId: string): string {
    if (!this.chartIdCache.has(analysisId)) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      this.chartIdCache.set(
        analysisId,
        `${this.componentId}-chart-${analysisId}-${timestamp}-${random}`
      );
    }
    return this.chartIdCache.get(analysisId)!;
  }
  @Memoize()
  getNotaChartOptions(score: number): EChartsOption {
    return {
      series: [
        {
          type: 'pie',
          radius: ['35%', '65%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          data: [
            {
              value: score,
              name: 'Nota',
              itemStyle: {
                color: this.getScoreColor(score),
              },
            },
            {
              value: 10 - score,
              name: 'Restante',
              itemStyle: {
                color: '#E6E6E6',
              },
            },
          ],
        },
      ],
      graphic: {
        type: 'text',
        left: 'center',
        top: 'center',
        style: {
          text: `${score.toFixed(1)}/10`,
          fontSize: 16,
          fontWeight: 'bold',
          fill: '#2c3e50',
        },
      },
    };
  }

  private getScoreColor(score: number): string {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    if (score >= 40) return '#FF5722';
    return '#F44336';
  }

  trackByAnalysisId(index: number, analysis: ConfidenceAnalysis): string {
    return analysis.id;
  }

  handleButtonClick(analysis: ConfidenceAnalysis): void {
    if (analysis.onButtonClick) {
      analysis.onButtonClick();
    }
  }

  ngOnDestroy(): void {
    // Limpiar cache de IDs y elementos DOM
    this.chartIdCache.forEach((chartId) => {
      const chartElement = document.getElementById(chartId);
      if (chartElement) {
        chartElement.innerHTML = '';
        chartElement.removeAttribute('_echarts_instance_');
      }
    });
    this.chartIdCache.clear();
  }

  getProgressBarColor(score: number): string {
    return this.getScoreColor(score);
  }
}
