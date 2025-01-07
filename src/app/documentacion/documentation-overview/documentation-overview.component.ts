import { Component, computed, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap } from 'rxjs';
import { Documento } from '../../shared/models/documentacion.model';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { DocumentosService } from '../services/documentacion.service';

interface UploadEvent {
  originalEvent: Event;
  files: File[];
}
@Component({
  selector: 'app-documentation-overview',
  templateUrl: './documentation-overview.component.html',
  styleUrl: './documentation-overview.component.scss',
})
export class DocumentationOverviewComponent extends SharedGridComponent<Documento> {
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  activatedRoute = inject(ActivatedRoute);
  service = inject(DocumentosService);
  confirmationService = inject(ConfirmationService);

  public uploadingFile = false;
  public mostrarSubirFichero = false;
  public uploadedFiles: File[] = [];
  private fb = inject(FormBuilder);
  public uploadingFileFormGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
  });

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.getDocumentacion({ ...this.pagination() });
    });
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
    } catch (error) {
      this.uploadingFile = false;
    }

    this.refresh();
  }

  confirmarEliminacion(document: Documento) {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar el documento "${document.identificador}"?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eliminarDocumento(document.id);
      },
    });
  }

  eliminarDocumento(id: number) {
    this.service.eliminarDocumento$(id).subscribe({
      next: () => {
        this.toast.success('Documento eliminado correctamente.');
        this.refresh(); // Actualiza la lista después de eliminar
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Error al eliminar el documento.');
      },
    });
  }
}
