import { Component, inject } from '@angular/core';
import { TestService } from '../../../services/test.service';

@Component({
  selector: 'app-dashboard-stats',
  templateUrl: './dashboard-stats.component.html',
  styleUrl: './dashboard-stats.component.scss',
})
export class DashboardStatsComponent {
  private testService = inject(TestService);
  public getAllTestsFinalizados$ = this.testService.getAllFinishedTest();
}
