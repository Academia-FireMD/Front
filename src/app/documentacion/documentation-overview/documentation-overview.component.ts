import { Component, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { Documento } from '../../shared/models/documentacion.model';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { FilterConfig } from '../../shared/generic-list/generic-list.component';
import { DocumentosService } from '../services/documentacion.service';
import { Tema } from '../../shared/models/pregunta.model';

@Component({
  selector: 'app-documentation-overview',
  templateUrl: './documentation-overview.component.html',
  styleUrl: './documentation-overview.component.scss',
})
export class DocumentationOverviewComponent
  extends SharedGridComponent<Documento>
  implements OnInit
{
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  activatedRoute = inject(ActivatedRoute);
  service = inject(DocumentosService);
  confirmationService = inject(ConfirmationService);
  private notificationService = inject(ToastrService);

  public uploadingFile = false;
  public mostrarSubirFichero = false;
  public uploadedFiles: File[] = [];
  private fb = inject(FormBuilder);
  public uploadingFileFormGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
    temaIds: [[] as number[]],
  });

  public mostrarEditarDocumento = false;
  public documentoEditando: Documento | null = null;
  public editarDocumentoForm = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
    temaIds: [[] as number[]],
  });

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
      key: 'temaId',
      label: 'Temas',
      type: 'tema-select',
      filterInterpolation: (value: number[]) => ({ temaId: { in: value } }),
    },
  ];

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getDocumentacion({ ...this.pagination() }).pipe(
        tap((entry) => (this.lastLoadedPagination = entry))
      );
    });
  }

  override ngOnInit() {
    super.ngOnInit();
  }

  private getDocumentacion(pagination: PaginationFilter) {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      switchMap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        this.expectedRole = expectedRole;
        return this.service.getDocumentosPublicos$(pagination);
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


  onSelect(event: any) {
    this.uploadedFiles = event.currentFiles;
  }

  async subirDocumento() {
    const selectedFile = this.uploadedFiles[0];
    if (!selectedFile) {
      this.toast.error('Por favor, selecciona un archivo primero.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append(
      'identificador',
      this.uploadingFileFormGroup.value.identificador ?? ''
    );
    formData.append(
      'descripcion',
      this.uploadingFileFormGroup.value.descripcion ?? ''
    );
    formData.append('esPublico', true + '');

    const temaId = (this.uploadingFileFormGroup.value.temaIds ?? [])[0];
    if (temaId !== undefined) {
      formData.append('temaId', String(temaId));
    }

    this.uploadingFile = true;
    try {
      const response = await firstValueFrom(
        this.service.uploadDocumento$(formData)
      );
      this.toast.success(`Archivo subido exitosamente`);
      this.uploadingFile = false;
      this.uploadingFileFormGroup.reset();
      this.mostrarSubirFichero = false;
      this.uploadedFiles = [];
      this.refresh();
    } catch (error) {
      this.uploadingFile = false;
      this.toast.error('Error al subir el archivo');
    }

    this.refresh();
  }

  abrirEditarDocumento(document: Documento) {
    this.documentoEditando = document;
    this.mostrarEditarDocumento = true;
    this.editarDocumentoForm.patchValue({
      identificador: document.identificador,
      descripcion: document.descripcion ?? '',
      temaIds: document.temaId ? [document.temaId] : [],
    });
  }

  async guardarCambiosDocumento() {
    if (!this.documentoEditando) return;

    const id = this.documentoEditando.id;
    const identificador = this.editarDocumentoForm.value.identificador ?? '';
    const descripcion = this.editarDocumentoForm.value.descripcion ?? '';
    const temaIds = this.editarDocumentoForm.value.temaIds ?? [];
    const temaId = temaIds.length > 0 ? temaIds[0] : null;

    try {
      await firstValueFrom(
        this.service.updateDocumento$({ id, identificador, descripcion, temaId })
      );
      this.toast.success('Documento actualizado correctamente');
      this.mostrarEditarDocumento = false;
      this.documentoEditando = null;
      this.refresh();
    } catch (error) {
      this.toast.error('Error al actualizar el documento');
    }
  }

  confirmarEliminacion(document: Documento) {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que quieres eliminar el documento "${document.identificador}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eliminarDocumento(document.id);
      },
    });
  }

  eliminarDocumento(id: number) {
    this.service.eliminarDocumento$(id).subscribe({
      next: () => {
        this.toast.success('Documento eliminado correctamente');
        this.refresh();
      },
      error: (error) => {
        this.toast.error('Error al eliminar el documento');
      },
    });
  }

  async descargarDocumento(documentoId: number, fileName: string) {
    try {
      this.notificationService.info('Descargando documento...');

      // Usar el servicio para descargar a través del backend
      this.service.descargarDocumento$(documentoId).subscribe({
        next: (blob) => {
          const blobUrl = window.URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          window.URL.revokeObjectURL(blobUrl);

          this.notificationService.success('Documento descargado correctamente');
        },
        error: (error) => {
          console.error('Error al descargar el documento:', error);
          this.notificationService.error('Error al descargar el documento');
        },
      });
    } catch (error) {
      console.error('Error al descargar el documento:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Error al descargar el documento';
      this.notificationService.error(errorMessage);
    }
  }
}