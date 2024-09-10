import { Component, inject } from '@angular/core';
import { FlashcardDataService } from '../../../services/flashcards.service';

@Component({
  selector: 'app-dashboard-stats-flashcards',
  templateUrl: './dashboard-stats-flashcards.component.html',
  styleUrl: './dashboard-stats-flashcards.component.scss',
})
export class DashboardStatsFlashcardsComponent {
  private testService = inject(FlashcardDataService);
  public getAllTestsFinalizados$ = this.testService.getAllFinishedTest();
}
