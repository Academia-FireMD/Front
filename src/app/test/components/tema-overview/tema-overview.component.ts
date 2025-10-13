import { Component, computed, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { TemaService } from '../../../services/tema.service';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { Tema } from '../../../shared/models/pregunta.model';
import { ModuloService } from '../../../shared/services/modulo.service';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-tema-overview',
  templateUrl: './tema-overview.component.html',
  styleUrl: './tema-overview.component.scss',
})
export class TemaOverviewComponent extends SharedGridComponent<Tema> {
  private temaService = inject(TemaService);
  private moduloService = inject(ModuloService);
  confirmationService = inject(ConfirmationService);

  modulos$ = this.moduloService.getModulos$();

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
      key: 'moduloId',
      label: 'Módulo',
      type: 'dropdown',
      placeholder: 'Seleccionar módulo',
      options: [
        { label: 'Todos los módulos', value: 'todos' },
        // Los módulos se cargarán dinámicamente
      ],
      filterInterpolation: (value) => {
        if (value === 'todos') return {};
        return { moduloId: value };
      },
    },
    {
      key: 'temas',
      label: 'Temas',
      type: 'tema-select',
      filterInterpolation: (value) => {
        if (!value || value.length === 0) return {};
        return { id: { in: value } };
      },
    },
  ];

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.temaService
        .getPaginatedTemas$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });

    // Cargar módulos para el filtro
    this.loadModulosForFilter();
  }

  private async loadModulosForFilter() {
    try {
      const modulos = await firstValueFrom(this.modulos$);
      const moduloFilter = this.filters.find(f => f.key === 'moduloId');
      if (moduloFilter) {
        moduloFilter.options = [
          { label: 'Todos los módulos', value: 'todos' },
          ...modulos.map(modulo => ({
            label: modulo.nombre,
            value: modulo.id
          }))
        ];
      }
    } catch (error) {
      console.error('Error loading modules for filter:', error);
    }
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: Tema) {
    this.navigateToDetailview(item.id);
  }

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/test/tema/' + id]);
  };

  public eliminarTema(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Se eliminará el tema (id: ${id}) y TODAS sus preguntas asociadas. Esta acción es irreversible y puede afectar estadísticas e históricos. ¿Deseas continuar?`,
      header: 'Eliminar tema',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Eliminar',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.temaService.deleteTema$(id));
        this.toast.info('Tema eliminado exitosamente');
        this.refresh();
      },
      reject: () => { },
    });
  }
}
