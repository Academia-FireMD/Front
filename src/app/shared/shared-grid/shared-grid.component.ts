import {
  Component,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { cloneDeep } from 'lodash';
import { Debounce } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { PaginatorState } from 'primeng/paginator';
import { Observable, of } from 'rxjs';
import { ViewportService } from '../../services/viewport.service';
import { PaginatedResult, PaginationFilter } from '../models/pagination.model';

@Component({
  selector: 'app-base-grid',
  template: '',
  host: {
    class: 'shared-grid-component',
  },
})
export class SharedGridComponent<T> implements OnInit, OnDestroy {
  toast = inject(ToastrService);
  viewportService = inject(ViewportService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  @Input() fetchItems$: Signal<Observable<PaginatedResult<T> | null>> = signal(
    of(null)
  );

  // Estado inicial de la paginación
  public pagination = signal<PaginationFilter>({
    skip: 0,
    take: 10,
    searchTerm: '',
  });

  public lastLoadedPagination!: PaginatedResult<T>;

  // Timestamp del último cambio programático (para ignorar reacciones circulares)
  private lastProgrammaticChangeTimestamp = 0;
  private readonly PROGRAMMATIC_CHANGE_THRESHOLD = 100; // ms

  ngOnInit() {
    // Leer los parámetros de la URL si existen
    this.route.queryParams.subscribe((params) => {
      const now = Date.now();

      // Si este cambio ocurrió muy cerca de un cambio programático, ignorarlo
      if (now - this.lastProgrammaticChangeTimestamp < this.PROGRAMMATIC_CHANGE_THRESHOLD) {
        return;
      }

      const skip = params['skip'] ? parseInt(params['skip'], 10) : 0;
      const take = params['take'] ? parseInt(params['take'], 10) : 10;
      const searchTerm = params['searchTerm'] || '';

      const current = this.pagination();

      // Solo actualizar si los valores realmente cambiaron
      if (current.skip !== skip || current.take !== take || current.searchTerm !== searchTerm) {
        this.pagination.set({ ...current, skip, take, searchTerm });
      }
    });
  }

  ngOnDestroy() {
    // Cleanup si es necesario
  }

  @Debounce(200)
  public valueChanged(event: any) {
    const newPagination = {
      ...this.pagination(),
      searchTerm: event.srcElement.value,
    };
    this.pagination.set(newPagination);
    this.updateQueryParamsSafe(newPagination);
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
    this.updateQueryParamsSafe(newPagination);
  }

  public refresh() {
    this.pagination.set(
      cloneDeep({
        ...this.pagination(),
      })
    );
    this.updateQueryParamsSafe(this.pagination());
  }

  // Método helper para actualizar paginación y query params de forma segura
  protected updatePaginationSafe(updates: Partial<PaginationFilter>) {
    const newPagination = {
      ...this.pagination(),
      ...updates,
    };
    this.pagination.set(newPagination);
    this.updateQueryParamsSafe(newPagination);
  }

  private updateQueryParamsSafe(pagination: PaginationFilter) {
    // Marcar el timestamp de este cambio programático
    this.lastProgrammaticChangeTimestamp = Date.now();
    this.updateQueryParams(pagination);
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
