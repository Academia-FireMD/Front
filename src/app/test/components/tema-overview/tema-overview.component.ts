import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { TemaService } from '../../../services/tema.service';
import { Tema } from '../../../shared/models/pregunta.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-tema-overview',
  templateUrl: './tema-overview.component.html',
  styleUrl: './tema-overview.component.scss',
})
export class TemaOverviewComponent extends SharedGridComponent<Tema> {
  private temaService = inject(TemaService);
  private router = inject(Router);
  confirmationService = inject(ConfirmationService);

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.temaService
        .getPaginatedTemas$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
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
      reject: () => {},
    });
  }
}
