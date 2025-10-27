import { Component, computed, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { Modulo, ModuloService } from '../../../shared/services/modulo.service';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-modulo-overview',
  templateUrl: './modulo-overview.component.html',
  styleUrls: ['./modulo-overview.component.scss'],
})
export class ModuloOverviewComponent extends SharedGridComponent<Modulo> {
  service = inject(ModuloService);
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
    {
      key: 'esPublico',
      label: 'Visibilidad',
      type: 'dropdown',
      placeholder: 'Seleccionar visibilidad',
      options: [
        { label: 'Todos', value: 'todos' },
        { label: 'Públicos', value: true },
        { label: 'Privados', value: false },
      ],
      filterInterpolation: (value) => {
        if (value === 'todos') return {};
        return { esPublico: value };
      },
    },
  ];

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.service.getModulosPaginados$({ ...this.pagination() });
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros usando el método seguro
    this.updatePaginationSafe({
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: Modulo) {
    this.navigateToDetailview(item.id);
  }

  navigateToDetailview(id: string | number) {
    this.router.navigate(['/app/test/modulos', id]);
  }

  eliminarModulo(modulo: Modulo, event?: MouseEvent) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const numTemas = modulo?._count?.temas ?? 0;

    this.confirmationService.confirm({
      header: 'Eliminar módulo',
      message: `Se eliminará el módulo y TODOS sus temas, junto con TODAS las preguntas de esos temas. Esta acción es irreversible y puede afectar estadísticas e históricos. ¿Deseas continuar? ${
        numTemas > 0
          ? `\nSe eliminarán también ${numTemas} tema${
              numTemas === 1 ? '' : 's'
            } asociado${numTemas === 1 ? '' : 's'}.`
          : ''
      }`,
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Eliminar',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.service.deleteModulo$(modulo.id).subscribe({
          next: (response) => {
            this.toast.success(
              `Módulo eliminado correctamente. ${
                response.temasEliminados > 0
                  ? `Se eliminaron ${response.temasEliminados} tema${
                      response.temasEliminados === 1 ? '' : 's'
                    } asociado${response.temasEliminados === 1 ? '' : 's'}.`
                  : ''
              }`
            );
            this.refresh();
          },
          error: (err) => {
            console.error(err);
            this.toast.error('Error al eliminar el módulo');
          },
        });
      },
    });
  }
}
