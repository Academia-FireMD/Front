import { Component, Input, Signal, signal } from '@angular/core';
import { Debounce } from 'lodash-decorators';
import { PaginatorState } from 'primeng/paginator';
import { Observable } from 'rxjs';
import { PaginatedResult, PaginationFilter } from '../models/pagination.model';

@Component({
  selector: 'app-base-grid',
  template: '',
})
export class SharedGridComponent<T> {
  @Input() fetchItems$!: Signal<Observable<PaginatedResult<T>>>;
  public pagination = signal<PaginationFilter>({
    skip: 0,
    take: 10,
    searchTerm: '',
  });
  public lastLoadedPagination!: PaginatedResult<T>;

  @Debounce(200)
  public valueChanged(event: any) {
    this.pagination.set({
      ...this.pagination(),
      searchTerm: event.srcElement.value,
    });
  }

  onPageChange(event: PaginatorState) {
    const page = event.page ?? 0;
    const rows = event.rows ?? 10;
    this.pagination.set({
      ...this.pagination(),
      skip: page * rows,
      take: rows,
    });
  }

  public refresh() {
    this.pagination.set({
      ...this.pagination(),
    });
  }
}
