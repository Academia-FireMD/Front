import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { PlanificacionMensual } from '../../shared/models/planificacion.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-planificacion-mensual-overview',
  templateUrl: './planificacion-mensual-overview.component.html',
  styleUrl: './planificacion-mensual-overview.component.scss',
})
export class PlanificacionMensualOverviewComponent extends SharedGridComponent<PlanificacionMensual> {
  planificacionesService = inject(PlanificacionesService);
  confirmationService = inject(ConfirmationService);
  activatedRoute = inject(ActivatedRoute);
  router = inject(Router);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  commMap = (pagination: PaginationFilter) => {
    return {
      ADMIN: this.planificacionesService
        .getPlanificacionMensual$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
      ALUMNO: this.planificacionesService
        .getPlanificacionMensualAlumno$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
    };
  };
  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getPlanificacion(this.pagination());
    });
  }

  private getPlanificacion(pagination: PaginationFilter) {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      switchMap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        this.expectedRole = expectedRole;
        return this.commMap(pagination)[this.expectedRole];
      })
    );
  }

  public navigateToDetailview = (id: number | 'new') => {
    if (this.expectedRole == 'ADMIN') {
      this.router.navigate(['/app/planificacion/planificacion-mensual/' + id]);
    } else {
      this.router.navigate([
        '/app/planificacion/planificacion-mensual-alumno/' + id,
      ]);
    }
  };

  public eliminar(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar una planificación mensual con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(
          this.planificacionesService.deletePlanificacionMensual$(id)
        );
        this.toast.info('Planificación mensual eliminada exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }
}
