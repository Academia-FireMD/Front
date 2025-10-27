import { Component, computed, inject, Input } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, of, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { PaginatedResult } from '../../../shared/models/pagination.model';
import { PreguntaFallo } from '../../../shared/models/pregunta.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-preguntas-fallos-overview',
  templateUrl: './preguntas-fallos-overview.component.html',
  styleUrl: './preguntas-fallos-overview.component.scss',
})
export class PreguntasFallosOverviewComponent extends SharedGridComponent<PreguntaFallo> {
  preguntasService = inject(PreguntasService);
  reportesFalloService = inject(ReportesFalloService);
  confirmationService = inject(ConfirmationService);
  public expandedItem!: PreguntaFallo | null;
  @Input() mode: 'injected' | 'overview' = 'overview';
  @Input() data!: PaginatedResult<PreguntaFallo>;

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
      if (!!this.data) return of(this.data);
      return this.reportesFalloService
        .getReporteFallos$(this.pagination())
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

  public onItemClick(item: PreguntaFallo) {
    // Manejar click en el item si es necesario
    this.toggleRowExpansion(item);
  }

  toggleRowExpansion(item: PreguntaFallo) {
    this.expandedItem = this.expandedItem === item ? null : item;
  }

  public eliminarFeedback(id: number, event: Event) {
    const message = this.mode === 'injected'
      ? '¿Deseas marcar este fallo como solucionado? Se eliminará de la lista de fallos reportados.'
      : 'Vas a eliminar el reporte de fallo, ¿estás seguro?';

    const header = this.mode === 'injected' ? 'Marcar como solucionado' : 'Confirmación';

    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: message,
      header: header,
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.reportesFalloService.deleteReporteFallo$(id));
        const successMessage = this.mode === 'injected'
          ? 'Fallo marcado como solucionado exitosamente'
          : 'Reporte de fallo eliminado exitosamente';
        this.toast.info(successMessage);
        this.refresh();
      },
      reject: () => {},
    });
  }
}
