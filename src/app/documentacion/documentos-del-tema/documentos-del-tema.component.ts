import { Location, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  ORIGEN_BIBLIOTECA,
  RUTA_PREVIA_LIBRILLOS,
  VistaTemario,
} from '../../estudio/previa/previa-librillos';
import {
  DocumentoBiblioteca,
  pdfDisponible,
  tituloDeBiblioteca,
} from '../../estudio/previa/temario-librillo';
import { UserService } from '../../services/user.service';
import { DocumentoTemario } from '../../shared/models/documentacion.model';
import { buildDocumentDownloadFileName } from '../../shared/utils/document-download-file-name';
import { DocumentosService } from '../services/documentacion.service';

@Component({
  selector: 'app-documentos-del-tema',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, ButtonModule, TooltipModule],
  templateUrl: './documentos-del-tema.component.html',
  styleUrl: './documentos-del-tema.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentosDelTemaComponent {
  readonly documentos = input.required<readonly DocumentoTemario[]>();
  readonly temaId = input<number>();
  readonly descripcionTema = input<string>();
  readonly biblioteca = input<ReadonlyMap<number, DocumentoBiblioteca>>();
  readonly modoTemario = input(false);
  readonly librillosActivos = input(false);
  readonly librilloTemarioActivo = input(false);
  readonly vistaOrigen = input<VistaTemario>('documentos');
  readonly abrirPdf = output<number>();
  readonly abrirEdicion = output<{ id: number; url: UrlTree }>();

  readonly rutaTemario = RUTA_PREVIA_LIBRILLOS;
  readonly pdfDisponible = pdfDisponible;
  readonly tituloDeBiblioteca = tituloDeBiblioteca;
  private readonly service = inject(DocumentosService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastrService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  tieneEdicion(documento: DocumentoTemario) {
    return (
      this.librillosActivos() &&
      documento.isDownloadable &&
      !!documento.librillo
    );
  }

  enlaceEdicion(documento: DocumentoTemario) {
    const biblioteca = !!this.biblioteca();
    const temario = this.modoTemario();
    return this.router.createUrlTree(
      ['/app/documentacion/alumno/librillo', documento.id],
      {
        queryParams: {
          tema: this.temaId(),
          desde: biblioteca ? ORIGEN_BIBLIOTECA : temario ? 'librillos' : null,
          vista: temario ? this.vistaOrigen() : null,
          original: temario && pdfDisponible(documento) ? 'pdf' : null,
        },
      },
    );
  }

  hrefEdicion(url: UrlTree) {
    return this.location.prepareExternalUrl(this.router.serializeUrl(url));
  }

  async abrir(documento: DocumentoTemario) {
    if (
      !this.modoTemario() ||
      !this.documentos().includes(documento) ||
      this.tieneEdicion(documento) ||
      !pdfDisponible(documento)
    ) {
      return;
    }
    this.abrirPdf.emit(documento.id);
    await this.verDocumentoAlumno(documento);
  }

  abrirEdicionInteractiva(
    evento: MouseEvent,
    documento: DocumentoTemario,
    url: UrlTree,
  ) {
    if (
      evento.button !== 0 ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey ||
      evento.metaKey
    )
      return;
    evento.preventDefault();
    if (!this.documentos().includes(documento) || !this.tieneEdicion(documento))
      return;
    this.abrirEdicion.emit({ id: documento.id, url });
    void this.verDocumentoAlumno(documento);
  }

  async descargarDocumentoAlumno(documento: DocumentoTemario) {
    if (!this.documentos().includes(documento) || !documento.isDownloadable) {
      this.toast.warning('No tienes permiso para descargar este documento');
      return;
    }

    if (documento.requireWatermark) {
      try {
        const usuario = await firstValueFrom(
          this.userService.getCurrentUser$(),
        );
        if (!usuario.nombre || !usuario.apellidos || !usuario.dni) {
          this.toast.error(
            'Para descargar este documento debes completar tu perfil con nombre, apellidos y DNI/NIE',
            'Datos incompletos',
          );
          return;
        }
      } catch (err) {
        console.error('Error al validar usuario:', err);
        return;
      }
    }

    try {
      await firstValueFrom(this.service.markAsSeen$(documento.id));
    } catch (err) {
      console.warn('Error al marcar como visto:', err);
    }

    try {
      this.toast.info('Descargando documento...');
      const blob = await firstValueFrom(
        this.service.downloadWithWatermark$(documento.id),
      );
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = buildDocumentDownloadFileName(
        documento.identificador,
        documento.fileName,
      );
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.toast.success('Documento descargado correctamente');
      documento.isNew = false;
      this.changeDetector.markForCheck();
    } catch (error) {
      console.error('Error al descargar:', error);
    }
  }

  async verDocumentoAlumno(documento: DocumentoTemario) {
    if (!this.documentos().includes(documento)) return;
    try {
      await firstValueFrom(this.service.markAsSeen$(documento.id));
      documento.isNew = false;
      this.changeDetector.markForCheck();
    } catch (err) {
      console.warn('Error al marcar como visto:', err);
    }
  }
}
