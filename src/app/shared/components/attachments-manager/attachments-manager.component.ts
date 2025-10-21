import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { Adjunto, EntidadTipo } from '../../models/attachment.model';
import { AttachmentsService } from '../../services/attachments.service';

@Component({
  selector: 'app-attachments-manager',
  templateUrl: './attachments-manager.component.html',
  styleUrl: './attachments-manager.component.scss',
})
export class AttachmentsManagerComponent implements OnInit {
  // Inputs
  readonly entidadTipo = input.required<EntidadTipo>();
  readonly entidadId = input.required<number>();
  readonly mode = input<'admin' | 'view'>('view');

  // Services
  private attachmentsService = inject(AttachmentsService);
  private toast = inject(ToastrService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  // State
  protected readonly adjuntos = signal<Adjunto[]>([]);
  protected readonly isDialogVisible = signal(false);
  protected readonly isUploadDialogVisible = signal(false);
  protected readonly uploadingFile = signal(false);
  protected readonly uploadedFiles = signal<File[]>([]);

  // Form
  protected uploadForm = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
  });

  ngOnInit(): void {
    this.loadAdjuntos();
  }

  protected async loadAdjuntos(): Promise<void> {
    try {
      const adjuntos = await firstValueFrom(
        this.attachmentsService.getAdjuntosByEntidad$(
          this.entidadTipo(),
          this.entidadId()
        )
      );
      this.adjuntos.set(adjuntos);
    } catch (error) {
      console.error('Error al cargar adjuntos:', error);
      this.toast.error('Error al cargar los adjuntos');
    }
  }

  protected openDialog(): void {
    this.isDialogVisible.set(true);
  }

  protected openUploadDialog(): void {
    this.uploadForm.reset();
    this.uploadedFiles.set([]);
    this.isUploadDialogVisible.set(true);
  }

  protected onFileSelect(event: any): void {
    this.uploadedFiles.set(event.currentFiles);
  }

  protected async subirAdjunto(): Promise<void> {
    const file = this.uploadedFiles()[0];
    if (!file) {
      this.toast.error('Por favor, selecciona un archivo');
      return;
    }

    if (!this.uploadForm.valid) {
      this.toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    this.uploadingFile.set(true);

    try {
      await firstValueFrom(
        this.attachmentsService.uploadAdjunto$(
          this.uploadForm.value.identificador ?? '',
          this.entidadTipo(),
          this.entidadId(),
          file,
          this.uploadForm.value.descripcion ?? undefined
        )
      );

      this.toast.success('Adjunto subido exitosamente');
      this.isUploadDialogVisible.set(false);
      this.uploadForm.reset();
      this.uploadedFiles.set([]);
      await this.loadAdjuntos();
    } catch (error) {
      console.error('Error al subir adjunto:', error);
      this.toast.error('Error al subir el adjunto');
    } finally {
      this.uploadingFile.set(false);
    }
  }

  protected async descargarAdjunto(adjunto: Adjunto): Promise<void> {
    try {
      this.toast.info('Descargando adjunto...');

      const blob = await firstValueFrom(
        this.attachmentsService.descargarAdjunto$(adjunto.id)
      );

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = adjunto.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      this.toast.success('Adjunto descargado correctamente');
    } catch (error) {
      console.error('Error al descargar adjunto:', error);
      this.toast.error('Error al descargar el adjunto');
    }
  }

  protected confirmarEliminacion(adjunto: Adjunto): void {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que quieres eliminar el adjunto "${adjunto.identificador}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.eliminarAdjunto(adjunto.id);
      },
    });
  }

  protected async eliminarAdjunto(id: number): Promise<void> {
    try {
      await firstValueFrom(this.attachmentsService.eliminarAdjunto$(id));
      this.toast.success('Adjunto eliminado correctamente');
      await this.loadAdjuntos();
    } catch (error) {
      console.error('Error al eliminar adjunto:', error);
      this.toast.error('Error al eliminar el adjunto');
    }
  }

  protected getFileIcon(tipoArchivo: string | undefined): string {
    return this.attachmentsService.getFileIcon(tipoArchivo);
  }

  protected formatFileSize(bytes: number | undefined): string {
    return this.attachmentsService.formatFileSize(bytes || 0);
  }
}
