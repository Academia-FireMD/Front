import { Component, computed, inject } from '@angular/core';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { SubBloque } from '../../shared/models/planificacion.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { FilterConfig } from '../../shared/generic-list/generic-list.component';

@Component({
  selector: 'app-planificacion-comentarios-overview',
  templateUrl: './planificacion-comentarios-overview.component.html',
  styleUrl: './planificacion-comentarios-overview.component.scss',
})
export class PlanificacionComentariosOverviewComponent extends SharedGridComponent<SubBloque> {
  planificacionesService = inject(PlanificacionesService);

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
      return this.planificacionesService.getComentariosAlumnos$(
        this.pagination()
      );
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: SubBloque) {
    // Navegar a la planificación del comentario
    this.router.navigate([
      '/app/planificacion/planificacion-mensual/' + item.planificacionId,
    ]);
  }
}
