import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Memoize } from 'lodash-decorators';
import { FlashcardDataService } from '../../../services/flashcards.service';
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
}
