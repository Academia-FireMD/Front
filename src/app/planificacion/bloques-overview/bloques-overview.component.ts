import { Component, computed, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { FilterConfig } from '../../shared/generic-list/generic-list.component';
import { PlanificacionBloque } from '../../shared/models/planificacion.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-bloques-overview',
  templateUrl: './bloques-overview.component.html',
  styleUrl: './bloques-overview.component.scss',
})
export class BloquesOverviewComponent extends SharedGridComponent<PlanificacionBloque> {
  planificacionesService = inject(PlanificacionesService);
  confirmationService = inject(ConfirmationService);

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
  ];

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.planificacionesService
        .getBloques$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros usando el método seguro
    this.updatePaginationSafe({
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: PlanificacionBloque) {
    this.navigateToDetailview(item.id);
  }

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/planificacion/bloques/' + id]);
  };

  public eliminarBloque(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el bloque con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.planificacionesService.deleteBloque$(id));
        this.toast.info('Bloque eliminado exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }

  public async clonarBloque(id: number) {
    try {
      await firstValueFrom(this.planificacionesService.clonarBloque$(id));
      this.toast.success('Bloque clonado exitosamente');
      this.refresh();
    } catch (error) {}
  }
}
