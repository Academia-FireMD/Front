import { Component, computed, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Modulo, ModuloService } from '../../../shared/services/modulo.service';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-modulo-overview',
  templateUrl: './modulo-overview.component.html',
  styleUrls: ['./modulo-overview.component.scss']
})
export class ModuloOverviewComponent extends SharedGridComponent<Modulo> {
  service = inject(ModuloService);
  confirmationService = inject(ConfirmationService);

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.service.getModulosPaginados$({ ...this.pagination() });
    });
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
      message: `¿Estás seguro de que deseas eliminar este módulo? ${numTemas > 0 ? `\nSe eliminarán también ${numTemas} tema${numTemas === 1 ? '' : 's'} asociado${numTemas === 1 ? '' : 's'}.` : ''}`,
      rejectButtonStyleClass: 'p-button-outlined',
      accept: () => {
        this.service.deleteModulo$(modulo.id).subscribe({
          next: (response) => {
            this.toast.success(`Módulo eliminado correctamente. ${response.temasEliminados > 0 ? `Se eliminaron ${response.temasEliminados} tema${response.temasEliminados === 1 ? '' : 's'} asociado${response.temasEliminados === 1 ? '' : 's'}.` : ''}`);
            this.refresh();
          },
          error: (err) => {
            console.error(err);
            this.toast.error('Error al eliminar el módulo');
          }
        });
      }
    });
  }
}
