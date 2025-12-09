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
import { PreguntasService } from '../../../services/preguntas.service';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import {
  Dificultad,
  Pregunta
} from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
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
  public Rol = Rol;
  preguntasService = inject(PreguntasService);
  confirmationService = inject(ConfirmationService);
  activatedRoute = inject(ActivatedRoute);
  public getAlumnoDificultad = getAlumnoDificultad;
  @ViewChild('fileInput') fileInput!: ElementRef;
  public uploadingFile = false;
  private fb = inject(FormBuilder);
  public mostrarFicherosDialog = false;
  public modoFicheros: 'importar' | 'exportar' = 'importar';
  public importForm = this.fb.group({
    temaId: [null as number | null, [Validators.required]],
    dificultad: [null as Dificultad | null, [Validators.required]],
  });
  public exportForm = this.fb.group({
    temaId: [null as number | null],
    dificultad: [null as Dificultad | null],
    formato: ['excel' as 'excel' | 'word', [Validators.required]],
  });
  public selectedFile: File | null = null;
  public expectedRole: Rol = Rol.ALUMNO;
  public exportando = false;

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
      filterInterpolation: (value) => ({
        dificultad: { equals: value },
      }),
    },
    {
      key: 'relevancia',
      label: 'Oposición',
      type: 'oposicion-picker',
      placeholder: 'Seleccionar oposición',
      filterInterpolation: (value) => ({
        relevancia: value,
      }),
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
    // Actualizar la paginación con los nuevos filtros usando el método seguro
    this.updatePaginationSafe({
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

  public descargarPlantillaPreguntas() {
    firstValueFrom(
      this.preguntasService.descargarPlantillaImportacion().pipe(
        tap((blob: Blob) => {
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.href = url;
          link.download = `plantilla_preguntas.xlsx`;
          link.click();
          URL.revokeObjectURL(url);
        })
      )
    );
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

  async importarPreguntas() {
    if (!this.selectedFile) {
      this.toast.error('Selecciona un archivo');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile, this.selectedFile.name);
    formData.append('temaId', String(this.importForm.value.temaId));
    formData.append(
      'dificultad',
      String(this.importForm.value.dificultad ?? 'PUBLICAS')
    );

    this.uploadingFile = true;
    try {
      const response: any = await firstValueFrom(
        this.preguntasService.importarPreguntasExcel(formData)
      );
      this.toast.success(
        `Archivo importado: ${response.count ?? 0} insertadas, ${
          response.ignoradas ?? 0
        } ignoradas.`
      );
      this.mostrarFicherosDialog = false;
      this.selectedFile = null;
      this.importForm.reset({ temaId: null, dificultad: null });
    } catch (error) {
      this.toast.error('Error al importar');
    } finally {
      this.uploadingFile = false;
      this.refresh();
    }
  }

  abrirDialogoFicheros() {
    this.modoFicheros = 'importar';
    this.importForm.reset({ temaId: null, dificultad: null });
    this.exportForm.reset({ temaId: null, dificultad: null, formato: 'excel' });
    this.selectedFile = null;
    this.mostrarFicherosDialog = true;
  }

  cambiarModoFicheros(modo: 'importar' | 'exportar') {
    this.modoFicheros = modo;
    if (modo === 'importar') {
      this.importForm.reset({ temaId: null, dificultad: null });
      this.selectedFile = null;
    } else {
      this.exportForm.reset({ temaId: null, dificultad: null, formato: 'excel' });
    }
  }

  async exportarPreguntas() {
    const { temaId, dificultad, formato } = this.exportForm.value;
    const temaIdsArray = temaId ? [temaId] : undefined;
    // Para exportar, usamos los mismos filtros que importar: tema y dificultad
    // El backend filtrará por temaId y dificultad directamente
    // Pasamos undefined para soloAlumnos para exportar todas las preguntas que coincidan con los filtros
    const soloAlumnosValue = undefined;

    this.exportando = true;
    try {
      const blob = await firstValueFrom(
        formato === 'excel'
          ? this.preguntasService.exportarPreguntasExcel(temaIdsArray, soloAlumnosValue)
          : this.preguntasService.exportarPreguntasWord(temaIdsArray, soloAlumnosValue)
      );

      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;

      const fecha = new Date().toISOString().split('T')[0];
      const tipo = soloAlumnosValue === undefined
        ? 'todas'
        : soloAlumnosValue
          ? 'alumnos'
          : 'academia';
      const extension = formato === 'excel' ? 'xlsx' : 'docx';
      link.download = `preguntas_${tipo}_${fecha}.${extension}`;

      link.click();
      URL.revokeObjectURL(url);

      this.toast.success('Archivo exportado correctamente');
      this.mostrarFicherosDialog = false;
      this.exportForm.reset({
        temaId: null,
        dificultad: null,
        formato: 'excel'
      });
    } catch (error) {
      this.toast.error('Error al exportar');
    } finally {
      this.exportando = false;
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
