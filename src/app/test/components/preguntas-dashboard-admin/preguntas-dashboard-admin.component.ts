import {
  Component,
  computed,
  ElementRef,
  inject,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { Pregunta, Dificultad, Comunidad } from '../../../shared/models/pregunta.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import {
  getAlumnoDificultad,
  getStarsBasedOnDifficulty,
} from '../../../utils/utils';

@Component({
  selector: 'app-preguntas-dashboard-admin',
  templateUrl: './preguntas-dashboard-admin.component.html',
  styleUrl: './preguntas-dashboard-admin.component.scss',
})
export class PreguntasDashboardAdminComponent extends SharedGridComponent<Pregunta> {
  preguntasService = inject(PreguntasService);
  confirmationService = inject(ConfirmationService);
  activatedRoute = inject(ActivatedRoute);
  public getAlumnoDificultad = getAlumnoDificultad;
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;

  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';

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
      key: 'temas',
      label: 'Temas',
      type: 'tema-select',
      filterInterpolation: (value) => ({
        temaId: { in: value }
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
      ADMIN: this.preguntasService
        .getPreguntas$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
      ALUMNO: this.preguntasService
        .getPreguntasAlumno$(pagination)
        .pipe(tap((entry) => (this.lastLoadedPagination = entry))),
    };
  };

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getPreguntas({ ...this.pagination() });
    });
  }

  private getPreguntas(pagination: PaginationFilter) {
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

  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;

  public navigateToDetailview = (id: number | 'new') => {
    if (this.expectedRole == 'ADMIN') {
      this.router.navigate(['/app/test/preguntas/' + id]);
    } else {
      this.router.navigate(['/app/test/alumno/preguntas/' + id]);
    }
  };

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public descargarPreguntasDeAlumnos() {
    firstValueFrom(
      this.preguntasService.getAllPreguntasCreadosPorAlumnos().pipe(
        tap((response: any) => {
          const link = document.createElement('a');
          const url = URL.createObjectURL(response);
          link.href = url;
          link.download = `preguntas_alumno_${+new Date()}.xlsx`;
          link.click();

          // Limpia el URL temporal
          URL.revokeObjectURL(url);
        })
      )
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
            this.preguntasService.importarPreguntasExcel(formData)
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
