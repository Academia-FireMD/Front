import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { ViewportService } from '../../../services/viewport.service';
import { Pregunta } from '../../../shared/models/pregunta.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { getStarsBasedOnDifficulty } from '../../../utils/utils';

@Component({
  selector: 'app-preguntas-dashboard-admin',
  templateUrl: './preguntas-dashboard-admin.component.html',
  styleUrl: './preguntas-dashboard-admin.component.scss',
})
export class PreguntasDashboardAdminComponent extends SharedGridComponent<Pregunta> {
  toast = inject(ToastrService);
  viewportService = inject(ViewportService);
  preguntasService = inject(PreguntasService);
  confirmationService = inject(ConfirmationService);
  router = inject(Router);
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.preguntasService
        .getPreguntas$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/test/preguntas/' + id]);
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

        await firstValueFrom(
          this.preguntasService.importarPreguntasExcel(formData)
        );
        this.toast.success('Archivo importado exitosamente');
        this.refresh();
        this.fileInput.nativeElement.value = '';
      }
    } catch (error) {
      this.fileInput.nativeElement.value = '';
    }
  }

  public eliminarPregunta(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar la pregunta con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.preguntasService.deletePregunta$(id));
        this.toast.info('Pregunta eliminada exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }
}
