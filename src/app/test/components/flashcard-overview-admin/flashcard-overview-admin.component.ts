import {
    Component,
    computed,
    ElementRef,
    inject,
    ViewChild,
} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { FlashcardData } from '../../../shared/models/flashcard.model';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { Dificultad } from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
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
  public Rol = Rol;
  confirmationService = inject(ConfirmationService);
  flashcardService = inject(FlashcardDataService);
  activatedRoute = inject(ActivatedRoute);
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;
  public expectedRole: Rol = Rol.ALUMNO;
  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;
  public getAlumnoDificultad = getAlumnoDificultad;
  private fb = inject(FormBuilder);
  public mostrarImportDialog = false;
  public importForm = this.fb.group({
    temaId: [null as number | null, [Validators.required]],
    dificultad: [null as Dificultad | null, [Validators.required]],
  });
  public selectedFile: File | null = null;

  // Configuración de filtros para el GenericListComponent
  public filters: FilterConfig[] = [
    {
      key: 'temas',
      label: 'Temas',
      type: 'tema-select',
      filterInterpolation: (value) => ({
        temaId: { in: value },
      }),
    },
    {
      key: 'dificultad',
      label: 'Dificultad',
      type: 'dificultad-dropdown',
      placeholder: 'Seleccionar dificultad',
      isFlashcards: true,
      filterInterpolation: (value) => ({
        dificultad: { equals: value },
      }),
    },
    {
      key: 'relevancia',
      label: 'Comunidad',
      type: 'comunidad-dropdown',
      placeholder: 'Seleccionar comunidad',
    },
  ];

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

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  onFileChosen(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile =
      input.files && input.files.length > 0 ? input.files[0] : null;
  }

  onPrimeFileSelect(event: any) {
    const files = event?.currentFiles ?? event?.files ?? [];
    this.selectedFile = files.length > 0 ? files[0] : null;
  }

  async importarFlashcards() {
    if (!this.selectedFile) {
      this.toast.error('Selecciona un archivo');
      return;
    }
    const temaId = this.importForm.value.temaId;
    if (!temaId) {
      this.toast.error('Selecciona un tema');
      return;
    }
    const formData = new FormData();
    formData.append('file', this.selectedFile, this.selectedFile.name);
    formData.append('temaId', String(temaId));
    formData.append(
      'dificultad',
      String(this.importForm.value.dificultad ?? 'PUBLICAS')
    );

    this.uploadingFile = true;
    try {
      const response: any = await firstValueFrom(
        this.flashcardService.importarExcel(formData)
      );
      this.toast.success(
        `Archivo importado: ${response.count ?? 0} insertadas, ${
          response.ignoradas ?? 0
        } ignoradas.`
      );
      this.mostrarImportDialog = false;
      this.selectedFile = null;
      this.importForm.reset({ temaId: null, dificultad: null });
    } catch (error) {
      this.toast.error('Error al importar');
    } finally {
      this.uploadingFile = false;
      this.refresh();
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

  public descargarPlantillaFlashcards() {
    firstValueFrom(
      this.flashcardService.descargarPlantillaImportacion().pipe(
        tap((blob: Blob) => {
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.href = url;
          link.download = `plantilla_flashcards.xlsx`;
          link.click();
          URL.revokeObjectURL(url);
        })
      )
    );
  }
}
