import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  switchMap,
  tap,
} from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { UserService } from '../../services/user.service';
import { FilterConfig } from '../../shared/generic-list/generic-list.component';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { PlanificacionMensual } from '../../shared/models/planificacion.model';
import {
  duracionesDisponibles,
  matchKeyWithLabel,
} from '../../shared/models/pregunta.model';
import { Usuario } from '../../shared/models/user.model';
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
  userService = inject(UserService);
  @ViewChild('fileInput') fileInput!: ElementRef;
  duracionesDisponibles = duracionesDisponibles;
  public uploadingFile = false;
  allUsers$ = this.userService
    .getAllUsers$({
      take: 9999999,
      skip: 0,
      searchTerm: '',
    })
    .pipe(map((e) => (e.data ?? []) as Array<Usuario>)) as Observable<any>;
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';

  // Configuración de filtros para el GenericListComponent
  public filters: FilterConfig[] = [
    {
      key: 'createdAt',
      specialCaseKey: 'rangeDate',
      label: 'Rango de fechas',
      type: 'calendar',
      placeholder: 'Seleccionar rango de fechas',
      dateConfig: {
        selectionMode: 'range',
      },
    },
    {
      key: 'tipoDePlanificacion',
      label: 'Duración',
      type: 'dropdown',
      placeholder: 'Seleccionar duración',
      options: duracionesDisponibles,
    },
    {
      key: 'asignada',
      label: 'Tipo',
      type: 'dropdown',
      placeholder: 'Seleccionar tipo',
      options: [
        { label: 'Asignadas', value: true },
        { label: 'Sin asignar', value: false },
      ],
    },
  ];

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

  public matchKeyWithLabel = matchKeyWithLabel;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getPlanificacion({ ...this.pagination() }).pipe(
        tap((result) => {
          // Auto-redirect si es alumno y solo tiene una planificación
          if (this.expectedRole === 'ALUMNO' && result?.data?.length === 1) {
            const planificacion = result.data[0];
            this.router.navigate([
              '/app/planificacion/planificacion-mensual-alumno/' + planificacion.id
            ]);
          }
        })
      );
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

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
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

    if (this.expectedRole == 'ALUMNO') {
      this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: `Vas a desvincular una planificación mensual con el ID ${id} perdiendo todo tu progreso, ¿estás seguro?`,
        header: 'Confirmación',
        icon: 'pi pi-exclamation-triangle',
        acceptIcon: 'none',
        acceptLabel: 'Sí',
        rejectLabel: 'No',
        rejectIcon: 'none',
        rejectButtonStyleClass: 'p-button-text',
        accept: async () => {
          await firstValueFrom(
            this.planificacionesService.desvincularPlanificacionMensual$(id)
          );
          this.toast.info('Planificación mensual desvinculada exitosamente');
          this.refresh();
        },
        reject: () => { },
      });
    } else {

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
        reject: () => { },
      });
    }
  }

  public async clonarPlanificacion(id: number) {
    await firstValueFrom(
      this.planificacionesService.clonarPlanificacionMensual$(id)
    );
    this.toast.info('Planificación mensual clonada');
    this.refresh();
  }
}
