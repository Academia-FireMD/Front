import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  router = inject(Router);
  @ViewChild('fileInput') fileInput!: ElementRef;
  duracionesDisponibles = duracionesDisponibles;
  public opcionesAsignadas = [
    {
      label: 'Asignadas',
      value: true,
    },
    {
      label: 'Sin asignar',
      value: false,
    },
  ];
  public uploadingFile = false;
  allUsers$ = this.userService
    .getAllUsers$({
      take: 9999999,
      skip: 0,
      searchTerm: '',
    })
    .pipe(map((e) => (e.data ?? []) as Array<Usuario>)) as Observable<any>;
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
  public matchKeyWithLabel = matchKeyWithLabel;
  public valueDuracion = new FormControl();
  public asignadas = new FormControl(false);

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getPlanificacion({
        ...this.pagination(),
        where: this.getWhere(),
      });
    });
  }

  public updateWhere() {
    this.pagination.set({
      ...this.pagination(),
      where: this.getWhere(),
    });
  }

  private getWhere() {
    const initialWhere = {} as any;
    if (!!this.valueDuracion.value) {
      initialWhere['tipoDePlanificacion'] = this.valueDuracion.value;
    }
    if (this.asignadas.value == false || this.asignadas.value == true)
      initialWhere['asignada'] = !!this.asignadas.value;
    return initialWhere;
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
