import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
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
  router = inject(Router);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.planificacionesService
        .getBloques$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/planificacion/bloques/' + id]);
  };

  async onFileSelected(event: Event) {
    try {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files.length > 0) {
        const selectedFile = input.files[0];
        if (!selectedFile) {
          this.toast.error('Por favor, selecciona un archivo primero.');
          return;
        }
        const formData = new FormData();
        formData.append('file', selectedFile, selectedFile.name);
        this.uploadingFile = true;
        try {
          const response = await firstValueFrom(
            this.planificacionesService.importarExcel(formData)
          );
          this.toast.success(
            `Archivo importado exitosamente con ${
              response.count ?? 0
            } insertadas y ${response.ignoradas ?? 0} ignoradas.`
          );
          this.uploadingFile = false;
        } catch (error) {
          this.uploadingFile = false;
        }
        this.refresh();
        this.fileInput.nativeElement.value = '';
      }
    } catch (error) {
      this.fileInput.nativeElement.value = '';
    }
  }

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
}
