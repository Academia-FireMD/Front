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
import { FlashcardDataService } from '../../../services/flashcards.service';
import { ViewportService } from '../../../services/viewport.service';
import { FlashcardData } from '../../../shared/models/flashcard.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { getStarsBasedOnDifficulty } from '../../../utils/utils';

@Component({
  selector: 'app-flashcard-overview-admin',
  templateUrl: './flashcard-overview-admin.component.html',
  styleUrl: './flashcard-overview-admin.component.scss',
})
export class FlashcardOverviewAdminComponent extends SharedGridComponent<FlashcardData> {
  toast = inject(ToastrService);
  viewportService = inject(ViewportService);
  confirmationService = inject(ConfirmationService);
  flashcardService = inject(FlashcardDataService);
  router = inject(Router);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;
  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;
  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.flashcardService
        .getFlashcards$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

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
            this.flashcardService.importarExcel(formData)
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

  public navigateToDetailview = (id: number | 'new') => {
    this.router.navigate(['/app/test/flashcards/' + id]);
  };

  public eliminarFlashcard(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar la flashcard con el ID ${id}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.flashcardService.deleteFlashcard$(id));
        this.toast.info('Flashcard eliminada exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }
}
