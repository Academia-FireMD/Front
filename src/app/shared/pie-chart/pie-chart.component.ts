import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pie-chart',
  templateUrl: './pie-chart.component.html',
  styleUrl: './pie-chart.component.scss',
})
export class PieChartComponent {
  @Input() public options = {
    cutout: '60%',
    plugins: {},
  };
  @Input() public data = {
    labels: [] as Array<any>,
    datasets: [] as Array<any>,
  };
}
