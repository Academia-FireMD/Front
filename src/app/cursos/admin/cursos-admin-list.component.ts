import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { firstValueFrom, Observable, tap } from 'rxjs';
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
 * Listado admin de cursos. Reusa `SharedGridComponent` + `<app-generic-list>`
 * igual que `examenes-dashboard-admin` / `preguntas-dashboard-admin`: misma
 * estructura de fila (título + estado + descripción a la izquierda, fecha +
 * acciones admin a la derecha), mismos colores/severidades y mismo patrón de
 * confirmación (`p-confirmDialog`). El "Crear" vive en el botón superior.
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
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    ConfirmDialogModule,
    GenericListComponent,
  ],
  templateUrl: './cursos-admin-list.component.html',
  styleUrl: './cursos-admin-list.component.scss',
})
export class CursosAdminListComponent extends SharedGridComponent<CursoAdmin> {
  private cursosAdminService = inject(CursosAdminService);
  private confirmationService = inject(ConfirmationService);

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

  publicarCurso(curso: CursoAdmin, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a publicar el curso "${curso.titulo}", ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.cursosAdminService.publicar(curso.id));
        this.toast.info('Curso publicado exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }

  archivarCurso(curso: CursoAdmin, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a archivar el curso "${curso.titulo}", ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.cursosAdminService.archivar(curso.id));
        this.toast.info('Curso archivado exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }

  despublicarCurso(curso: CursoAdmin, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a devolver el curso "${curso.titulo}" a borrador, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.cursosAdminService.despublicar(curso.id));
        this.toast.info('Curso devuelto a borrador');
        this.refresh();
      },
      reject: () => {},
    });
  }

  /**
   * Duplica el curso (deep-clone en backend) y abre la copia en el editor para
   * renombrarla/ajustarla. No es destructivo → sin confirmación (patrón "clonar"
   * de planificación). La copia nace en BORRADOR y sin producto WooCommerce.
   */
  async duplicarCurso(curso: CursoAdmin, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      const copia = await firstValueFrom(
        this.cursosAdminService.duplicar(curso.id),
      );
      this.toast.success(`Curso duplicado como "${copia.titulo}"`);
      this.router.navigate(['/app/cursos-admin', copia.id]);
    } catch {
      // handleError del service ya muestra el toast de error
    }
  }

  eliminarCurso(curso: CursoAdmin, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el curso "${curso.titulo}". Esta acción no se puede deshacer. ¿Estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.cursosAdminService.remove(curso.id));
        this.toast.info('Curso eliminado exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }
}
