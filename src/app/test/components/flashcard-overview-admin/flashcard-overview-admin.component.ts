import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { FlashcardData } from '../../../shared/models/flashcard.model';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import {
  getAlumnoDificultad,
  getStarsBasedOnDifficulty,
} from '../../../utils/utils';

@Component({
  selector: 'app-flashcard-overview-admin',
  templateUrl: './flashcard-overview-admin.component.html',
  styleUrl: './flashcard-overview-admin.component.scss',
})
export class FlashcardOverviewAdminComponent extends SharedGridComponent<FlashcardData> {
  confirmationService = inject(ConfirmationService);
  flashcardService = inject(FlashcardDataService);
  activatedRoute = inject(ActivatedRoute);
  router = inject(Router);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;
  public getAlumnoDificultad = getAlumnoDificultad;
  commMap = (pagination: PaginationFilter) => {
    return {
      ADMIN: this.flashcardService
        .getFlashcards$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
      ALUMNO: this.flashcardService
        .getFlashcardsAlumno$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
    };
  };
  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getFlashcards({ ...this.pagination() });
    });
  }

  private getFlashcards(pagination: PaginationFilter) {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      switchMap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        this.expectedRole = expectedRole;
        return this.commMap(pagination)[this.expectedRole];
      })
    );
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
    if (this.expectedRole == 'ADMIN') {
      this.router.navigate(['/app/test/flashcards/' + id]);
    } else {
      this.router.navigate(['/app/test/alumno/flashcards/' + id]);
    }
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

  public descargarFlashcardsDeAlumnos() {
    firstValueFrom(
      this.flashcardService.getAllFlashcardsCreadasPorAlumnos().pipe(
        tap((response: any) => {
          const link = document.createElement('a');
          const url = URL.createObjectURL(response);
          link.href = url;
          link.download = `flashcards_alumno_${+new Date()}.xlsx`;
          link.click();

          // Limpia el URL temporal
          URL.revokeObjectURL(url);
        })
      )
    );
  }
}
