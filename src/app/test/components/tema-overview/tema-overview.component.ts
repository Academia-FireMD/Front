import { Component, computed, inject, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { TemaService } from '../../../services/tema.service';
import { PaginationFilter } from '../../../shared/models/pagination.model';
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

  selectedModuloId = signal<number | null>(null);
  modulos$ = this.moduloService.getModulos$();

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      const filter: PaginationFilter = {
        ...this.pagination(),
        where: this.selectedModuloId() ? {
          moduloId: this.selectedModuloId()
        } : undefined
      };
      return this.temaService
        .getPaginatedTemas$(filter)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  onModuloChange(event: any) {
    this.selectedModuloId.set(event.value);
    this.refresh();
  }

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/test/tema/' + id]);
  };

  public eliminarTema(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el tema con el id ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
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
