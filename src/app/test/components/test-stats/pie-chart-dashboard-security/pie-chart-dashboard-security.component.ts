import { Component, Input } from '@angular/core';
import { Memoize } from 'lodash-decorators';
import { SeguridadAlResponder } from '../../../../shared/models/pregunta.model';
import {
  colorCorrectas,
  colorIncorretas,
  colorSinResponder,
} from '../../../../utils/utils';

@Component({
  selector: 'app-pie-chart-dashboard-security',
  templateUrl: './pie-chart-dashboard-security.component.html',
  styleUrl: './pie-chart-dashboard-security.component.scss',
})
export class PieChartDashboardSecurityComponent {
  @Input() stat!: any;
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
          backgroundColor: [colorCorrectas, colorIncorretas, colorSinResponder],
        },
      ],
      percentages: [
        correctasPorcentaje,
        incorrectasPorcentaje,
        noRespondidasPorcentaje,
      ],
    };
  }
}
