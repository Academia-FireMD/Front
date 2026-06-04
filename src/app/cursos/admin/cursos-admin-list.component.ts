import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { Observable, tap } from 'rxjs';
import {
  PaginatedResult,
  PaginationFilter,
} from '../../shared/models/pagination.model';
import { GenericListComponent } from '../../shared/generic-list/generic-list.component';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { CursoAdmin, EstadoCurso } from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';

type TagSeverity =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'secondary'
  | 'contrast'
  | undefined;

/**
 * Refactor 2026-05-25 (T9): extends `SharedGridComponent<CursoAdmin>` para
 * reusar paginación, search debounced y query-param sync. Antes era un
 * `p-table` ad-hoc. Renderiza via `<app-generic-list>` igual que
 * preguntas-dashboard-admin.
 */
@Component({
  selector: 'app-cursos-admin-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    GenericListComponent,
  ],
  templateUrl: './cursos-admin-list.component.html',
  styleUrl: './cursos-admin-list.component.scss',
})
export class CursosAdminListComponent extends SharedGridComponent<CursoAdmin> {
  private cursosAdminService = inject(CursosAdminService);

  constructor() {
    super();
    this.fetchItems$ = computed(() => this.fetchCursos(this.pagination()));
  }

  private fetchCursos(
    pagination: PaginationFilter,
  ): Observable<PaginatedResult<CursoAdmin>> {
    return this.cursosAdminService
      .list(pagination)
      .pipe(tap((res) => (this.lastLoadedPagination = res)));
  }

  navigateToNew(): void {
    this.router.navigate(['/app/cursos-admin/nuevo']);
  }

  onRowClick(curso: CursoAdmin): void {
    this.router.navigate(['/app/cursos-admin', curso.id]);
  }

  estadoSeverity(estado: EstadoCurso): TagSeverity {
    const map: Record<EstadoCurso, TagSeverity> = {
      BORRADOR: 'warning',
      PUBLICADO: 'success',
      ARCHIVADO: 'secondary',
    };
    return map[estado];
  }
}
