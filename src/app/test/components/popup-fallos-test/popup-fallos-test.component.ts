import { Component, computed, inject } from '@angular/core';
import { tap } from 'rxjs';
import { TestService } from '../../../services/test.service';
import { Respuesta } from '../../../shared/models/test.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { getLetter, getStarsBasedOnDifficulty } from '../../../utils/utils';

@Component({
  selector: 'app-popup-fallos-test',
  templateUrl: './popup-fallos-test.component.html',
  styleUrl: './popup-fallos-test.component.scss',
})
export class PopupFallosTestComponent extends SharedGridComponent<Respuesta> {
  testService = inject(TestService);
  getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;
  getLetter = getLetter;
  public expandedItem!: Respuesta | null;
  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.testService
        .obtenerFallos(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  toggleRowExpansion(item: Respuesta) {
    this.expandedItem = this.expandedItem === item ? null : item;
  }
}
