import { Component, computed, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, switchMap, tap } from 'rxjs';
import { UserService } from '../../services/user.service';
import { FilterConfig, GenericListMode } from '../../shared/generic-list/generic-list.component';
import { Documento } from '../../shared/models/documentacion.model';
import { PaginationFilter } from '../../shared/models/pagination.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { DocumentosService } from '../services/documentacion.service';

@Component({
  selector: 'app-documentation-overview',
  templateUrl: './documentation-overview.component.html',
  styleUrl: './documentation-overview.component.scss',
})
export class DocumentationOverviewComponent
  extends SharedGridComponent<Documento>
  implements OnInit
{
  @Input() mode: GenericListMode = 'overview';
  @Input() selectedDocumentIds: number[] = [];
  @Output() selectionChange = new EventEmitter<number[]>();

  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  activatedRoute = inject(ActivatedRoute);
  service = inject(DocumentosService);
  userService = inject(UserService);
  confirmationService = inject(ConfirmationService);
  private notificationService = inject(ToastrService);

  // Para vista de alumno (acordeón)
  public documentTree: any[] = [];
  public loadingTree = false;

  public uploadingFile = false;
  public mostrarSubirFichero = false;
  public uploadedFiles: File[] = [];
  private fb = inject(FormBuilder);
  public uploadingFileFormGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
    temaIds: [[] as number[]],
    isLocked: [false],
    requireWatermark: [false],
  });

  public mostrarEditarDocumento = false;
  public documentoEditando: Documento | null = null;
  public editarDocumentoForm = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
    temaIds: [[] as number[]],
    isLocked: [false],
    requireWatermark: [false],
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
    {
      key: 'isLocked',
      label: 'Solo documentos premium (isLocked)',
      type: 'toggle',
      filterInterpolation: (value: boolean) => value ? { isLocked: true } : {},
    },
    {
      key: 'requireWatermark',
      label: 'Solo documentos con marca de agua',
      type: 'toggle',
      filterInterpolation: (value: boolean) => value ? { requireWatermark: true } : {},
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

    // Si mode es 'overview' y viene de la ruta, detectar rol
    if (this.mode === 'overview') {
      this.activatedRoute.data.subscribe(data => {
        const { expectedRole } = data;
        this.expectedRole = expectedRole;

        if (this.expectedRole === 'ALUMNO') {
          this.loadDocumentTree();
        }
      });
    }
  }

  // Métodos para modo selección
  isItemSelected(documento: Documento): boolean {
    return this.selectedDocumentIds.includes(documento.id);
  }

  toggleItemSelection(documento: Documento): void {
    const index = this.selectedDocumentIds.indexOf(documento.id);
    if (index > -1) {
      this.selectedDocumentIds = this.selectedDocumentIds.filter(id => id !== documento.id);
    } else {
      this.selectedDocumentIds = [...this.selectedDocumentIds, documento.id];
    }
    this.selectionChange.emit(this.selectedDocumentIds);
  }

  isAllSelected(): boolean {
    const currentPageDocs = this.lastLoadedPagination?.data || [];
    return currentPageDocs.length > 0 && currentPageDocs.every((doc: Documento) => this.selectedDocumentIds.includes(doc.id));
  }

  toggleSelectAll(): void {
    const currentPageDocs = this.lastLoadedPagination?.data || [];
    if (this.isAllSelected()) {
      // Deseleccionar todos los de la página actual
      this.selectedDocumentIds = this.selectedDocumentIds.filter(
        id => !currentPageDocs.some((doc: Documento) => doc.id === id)
      );
    } else {
      // Seleccionar todos los de la página actual
      const newIds = currentPageDocs.map((doc: Documento) => doc.id);
      this.selectedDocumentIds = [...new Set([...this.selectedDocumentIds, ...newIds])];
    }
    this.selectionChange.emit(this.selectedDocumentIds);
  }

  handleItemClick(documento: Documento): void {
    if (this.mode === 'selection') {
      this.toggleItemSelection(documento);
    } else {
      // Modo overview: abrir editar documento
      this.abrirEditarDocumento(documento);
    }
  }

  getDocumentId = (documento: Documento): number => documento.id;

  onSelectionChange(selectedIds: (string | number)[]): void {
    this.selectedDocumentIds = selectedIds as number[];
    this.selectionChange.emit(this.selectedDocumentIds);
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
    // Actualizar la paginación con los nuevos filtros usando el método seguro
    this.updatePaginationSafe({
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
    formData.append('isLocked', String(this.uploadingFileFormGroup.value.isLocked ?? false));
    formData.append('requireWatermark', String(this.uploadingFileFormGroup.value.requireWatermark ?? false));

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
    this.documentoEditando = document;
    this.editarDocumentoForm.patchValue({
      identificador: document.identificador,
      descripcion: document.descripcion ?? '',
      temaIds: document.temaId ? [document.temaId] : [],
      isLocked: (document as any).isLocked ?? false,
      requireWatermark: (document as any).requireWatermark ?? false,
    });
  }

  async guardarCambiosDocumento() {
    if (!this.documentoEditando) return;

    const id = this.documentoEditando.id;
    const identificador = this.editarDocumentoForm.value.identificador ?? '';
    const descripcion = this.editarDocumentoForm.value.descripcion ?? '';
    const temaIds = this.editarDocumentoForm.value.temaIds ?? [];
    const temaId = temaIds.length > 0 ? temaIds[0] : null;
    const isLocked = this.editarDocumentoForm.value.isLocked ?? false;
    const requireWatermark = this.editarDocumentoForm.value.requireWatermark ?? false;

    try {
      await firstValueFrom(
        this.service.updateDocumento$({
          id,
          identificador,
          descripcion,
          temaId,
          isLocked,
          requireWatermark
        })
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

  // Métodos para vista de alumno
  loadDocumentTree() {
    this.loadingTree = true;
    this.service.getDocumentTree$().subscribe({
      next: (tree) => {
        this.documentTree = tree;
        this.loadingTree = false;
      },
      error: (err) => {
        console.error('Error al cargar árbol de documentos:', err);
        this.toast.error('Error al cargar documentos');
        this.loadingTree = false;
      }
    });
  }

  async descargarDocumentoAlumno(documento: any) {
    if (!documento.isDownloadable) {
      this.toast.warning('No tienes permiso para descargar este documento');
      return;
    }

    // Si el documento requiere watermark, validar datos del usuario
    if (documento.requireWatermark) {
      try {
        const usuario = await firstValueFrom(this.userService.getCurrentUser$());

        if (!usuario.nombre || !usuario.apellidos || !usuario.dni) {
          this.toast.error(
            'Para descargar este documento debes completar tu perfil con nombre, apellidos y DNI/NIE',
            'Datos incompletos'
          );
          return;
        }
      } catch (err) {
        console.error('Error al validar usuario:', err);
        this.toast.error('Error al validar tu perfil');
        return;
      }
    }

    // Marcar como visto
    try {
      await firstValueFrom(this.service.markAsSeen$(documento.id));
    } catch (err) {
      console.warn('Error al marcar como visto:', err);
    }

    // Descargar con watermark si aplica
    try {
      this.toast.info('Descargando documento...');
      const blob = await firstValueFrom(
        this.service.downloadWithWatermark$(documento.id)
      );
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = documento.fileName || documento.identificador;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.toast.success('Documento descargado correctamente');

      // Recargar árbol para actualizar badge NEW
      this.loadDocumentTree();
    } catch (error) {
      console.error('Error al descargar:', error);
      this.toast.error('Error al descargar el documento');
    }
  }

  async verDocumentoAlumno(documento: any) {
    // Marcar como visto al hacer clic
    try {
      await firstValueFrom(this.service.markAsSeen$(documento.id));
      documento.isNew = false; // Actualizar localmente
    } catch (err) {
      console.warn('Error al marcar como visto:', err);
    }
  }
}
