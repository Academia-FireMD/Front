import {
  Component,
  inject,
  Input,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { cloneDeep } from 'lodash';
import { Debounce } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { PaginatorState } from 'primeng/paginator';
import { Observable } from 'rxjs';
import { ViewportService } from '../../services/viewport.service';
import { PaginatedResult, PaginationFilter } from '../models/pagination.model';

@Component({
  selector: 'app-base-grid',
  template: '',
})
export class SharedGridComponent<T> implements OnInit {
  toast = inject(ToastrService);
  viewportService = inject(ViewportService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  @Input() fetchItems$!: Signal<Observable<PaginatedResult<T>>>;

  // Estado inicial de la paginación
  public pagination = signal<PaginationFilter>({
    skip: 0,
    take: 10,
    searchTerm: '',
  });

  public lastLoadedPagination!: PaginatedResult<T>;

  ngOnInit() {
    // Leer los parámetros de la URL si existen
    this.route.queryParams.subscribe((params) => {
      const skip = params['skip'] ? parseInt(params['skip'], 10) : 0;
      const take = params['take'] ? parseInt(params['take'], 10) : 10;
      const searchTerm = params['searchTerm'] || '';

      this.pagination.set({ skip, take, searchTerm });
    });
  }

  @Debounce(200)
  public valueChanged(event: any) {
    const newPagination = {
      ...this.pagination(),
      searchTerm: event.srcElement.value,
    };
    this.pagination.set(newPagination);
    this.updateQueryParams(newPagination);
  }

  onPageChange(event: PaginatorState) {
    const page = event.page ?? 0;
    const rows = event.rows ?? 10;
    const newPagination = {
      ...this.pagination(),
      skip: page * rows,
      take: rows,
    };
    this.pagination.set(newPagination);
    this.updateQueryParams(newPagination);
  }

  public refresh() {
    this.pagination.set(
      cloneDeep({
        ...this.pagination(),
      })
    );
    this.updateQueryParams(this.pagination());
  }

  private updateQueryParams(pagination: PaginationFilter) {
    this.router.navigate([], {
      queryParams: {
        skip: pagination.skip,
        take: pagination.take,
        searchTerm: pagination.searchTerm,
      },
      queryParamsHandling: 'merge', // Mantiene otros parámetros en la URL
    });
  }
}
