import { Component, Input } from '@angular/core';

export interface KpiStat {
  value: number;
  label: string;
  type: 'correctas' | 'incorrectas' | 'no-contestadas' | 'repasar';
  icon: string;
}

@Component({
  selector: 'app-kpi-stats-cards',
  templateUrl: './kpi-stats-cards.component.html',
  styleUrl: './kpi-stats-cards.component.scss'
})
export class KpiStatsCardsComponent {
  @Input() stats: KpiStat[] = [];
}

