import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { FilterConfig } from '../../shared/generic-list/generic-list.component';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { PlanificacionMensual } from '../../shared/models/planificacion.model';
import {
  duracionesDisponibles,
  matchKeyWithLabel,
} from '../../shared/models/pregunta.model';
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
  @ViewChild('fileInput') fileInput!: ElementRef;
  duracionesDisponibles = duracionesDisponibles;
  public uploadingFile = false;
  public searchReadOnly = true;
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  public readonly opcionesAvanzadas: MenuItem[] = [
    {
      label: 'Configuración avanzada de planes automáticos',
      icon: 'pi pi-cog',
      command: () => this.abrirPerfiles(),
    },
  ];

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
      key: 'modoGestion',
      label: 'Gestión',
      type: 'dropdown',
      placeholder: 'Automáticas o manuales',
      options: [
        { label: 'Automáticas', value: 'AUTOMATICA' },
        { label: 'Manuales', value: 'MANUAL' },
      ],
    },
    {
      key: 'estado',
      label: 'Estado',
      type: 'dropdown',
      placeholder: 'Seleccionar estado',
      options: [
        { label: 'Borradores', value: 'BORRADOR' },
        { label: 'Publicadas', value: 'PUBLICADA' },
        { label: 'Archivadas', value: 'ARCHIVADA' },
      ],
    },
    {
      key: 'relevancia',
      label: 'Oposición',
      type: 'oposicion-picker',
      placeholder: 'Seleccionar oposición',
      filterInterpolation: (value) => ({
        relevancia: value,
      }),
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

  public activarBusqueda(event: FocusEvent): void {
    // El navegador puede autocompletar aquí el email de login sin emitir input.
    // Se habilita al recibir foco y se conserva solo el filtro real de la URL.
    const input = event.target as HTMLInputElement;
    this.searchReadOnly = false;
    input.readOnly = false;
    input.value = this.pagination().searchTerm ?? '';
  }

  public esAutomatica(plan: PlanificacionMensual): boolean {
    return Boolean(
      plan.varianteOrigenId ||
      plan.varianteBorradorId ||
      plan.variantesAutoasignacion?.length,
    );
  }

  public abrirImportacion(): void {
    void this.router.navigate(['/app/planificacion/admin-planificacion'], {
      queryParams: { importar: '1' },
    });
  }

  public abrirPerfiles(): void {
    void this.router.navigate(['/app/planificacion/admin-planificacion']);
  }

  public async crearCopiaManual(id: number): Promise<void> {
    const resultado = await firstValueFrom(
      this.planificacionesService.clonarParaAlumno$(id),
    );
    this.toast.info('Copia personal en borrador. Revísala antes de asignarla.');
    this.navigateToDetailview(resultado.nuevaPlanificacion.id);
  }

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getPlanificacion({ ...this.pagination() }).pipe(
        tap((result) => {
          // Auto-redirect si es alumno y solo tiene una planificación
          if (this.expectedRole === 'ALUMNO' && result?.data?.length === 1) {
            const planificacion = result.data[0];
            this.router.navigate([
              '/app/planificacion/planificacion-mensual-alumno/' +
                planificacion.id,
            ]);
          }
        }),
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
      }),
    );
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros usando el método seguro
    this.updatePaginationSafe({
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
    if (this.expectedRole !== 'ADMIN') return;
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
          this.planificacionesService.deletePlanificacionMensual$(id),
        );
        this.toast.info('Planificación mensual eliminada exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }

  public async clonarPlanificacion(id: number) {
    await firstValueFrom(
      this.planificacionesService.clonarPlanificacionMensual$(id),
    );
    this.toast.info('Planificación mensual clonada');
    this.refresh();
  }
}
