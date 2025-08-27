import { Component, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-score-chart-card',
  templateUrl: './score-chart-card.component.html',
  styleUrl: './score-chart-card.component.scss'
})
export class ScoreChartCardComponent implements OnInit, OnDestroy {
  @Input() title: string = 'Nota';
  @Input() score: number = 0;
  @Input() description: string = '';
  
  // ID único para evitar conflictos de ECharts
  public chartId: string = '';

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Generar ID único basado en el elemento DOM y timestamp
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    this.chartId = `score-chart-${timestamp}-${random}`;
  }
  
  get chartOptions(): EChartsOption {
    const nota = this.score > 0 ? this.score : 0;
    return {
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '16',
              fontWeight: 'bold',
              formatter: '{c}/10'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            {
              value: nota,
              name: 'Nota',
              itemStyle: {
                color: this.getScoreColor(nota)
              }
            },
            {
              value: 10 - nota,
              name: 'Restante',
              itemStyle: {
                color: '#E6E6E6'
              }
            }
          ]
        }
      ],
      graphic: {
        type: 'text',
        left: 'center',
        top: 'center',
        style: {
          text: `${nota.toFixed(1)}/10`,
          fontSize: 20,
          fontWeight: 'bold',
          fill: '#2c3e50'
        }
      }
    };
  }

  ngOnDestroy(): void {
    // Limpiar la instancia de ECharts al destruir el componente
    if (this.chartId) {
      const chartElement = document.getElementById(this.chartId);
      if (chartElement) {
        // Limpiar completamente el elemento
        chartElement.innerHTML = '';
        chartElement.removeAttribute('_echarts_instance_');
      }
    }
  }

  private getScoreColor(score: number): string {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    if (score >= 40) return '#FF5722';
    return '#F44336';
  }
}
