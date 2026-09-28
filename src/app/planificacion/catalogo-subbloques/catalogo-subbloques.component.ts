import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { CatalogoSubbloquesListComponent } from './catalogo-subbloques-list.component';
import { EditarSubBloqueDialogComponent } from '../editar-sub-bloque-dialog/editar-sub-bloque-dialog.component';
import { ExcelFilePickerComponent } from '../../shared/excel-file-picker/excel-file-picker.component';
import {
  CatalogoContenidoCompleto,
  CatalogoFilaEditable,
  CatalogoLista,
  CatalogoPreview,
} from '../models/catalogo-contenido.model';

@Component({
  selector: 'app-catalogo-subbloques',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    InputTextModule,
    TagModule,
    ExcelFilePickerComponent,
    CatalogoSubbloquesListComponent,
    EditarSubBloqueDialogComponent,
  ],
  templateUrl: './catalogo-subbloques.component.html',
  styleUrl: './catalogo-subbloques.component.scss',
})
export class CatalogoSubbloquesComponent implements OnInit {
  private readonly servicio = inject(PlanificacionesService);
  private readonly toast = inject(ToastrService);
  readonly catalogo = signal<CatalogoLista>({ filas: [], trabajos: [] });
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  dialogoEdicion = false;
  dialogoImportacion = false;
  esNuevo = false;
  fila: CatalogoFilaEditable = this.filaVacia();
  archivo: File | null = null;
  preview: CatalogoPreview | null = null;
  confirmado = false;

  ngOnInit(): void {
    void this.cargar();
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.catalogo.set(
        await firstValueFrom(this.servicio.listarCatalogoContenido()),
      );
    } catch {
      this.toast.error('No se pudo cargar el catálogo de subbloques.');
    } finally {
      this.cargando.set(false);
    }
  }

  private filaVacia(): CatalogoFilaEditable {
    return {
      codigo: '',
      nombreCorto: '',
      nombreDescriptivo: '',
      puntosImportantes: '',
      color: '#ffffff',
    };
  }

  abrirNuevo() {
    this.esNuevo = true;
    this.fila = this.filaVacia();
    this.resetPreview();
    this.dialogoEdicion = true;
  }

  abrirEdicion(fila: CatalogoContenidoCompleto) {
    this.esNuevo = false;
    this.fila = {
      codigo: fila.codigo,
      nombreCorto: fila.nombreCorto,
      nombreDescriptivo: fila.nombreDescriptivo ?? '',
      puntosImportantes: fila.puntosImportantes ?? '',
      color: fila.color,
    };
    this.resetPreview();
    this.dialogoEdicion = true;
  }

  abrirImportacion() {
    this.archivo = null;
    this.resetPreview();
    this.dialogoImportacion = true;
  }

  seleccionarArchivo(archivo: File | null) {
    this.archivo = archivo;
    this.resetPreview();
  }

  resetPreview() {
    this.preview = null;
    this.confirmado = false;
  }

  async revisarExcel() {
    if (!this.archivo) return;
    this.cargando.set(true);
    try {
      this.preview = await firstValueFrom(
        this.servicio.previsualizarCatalogo(this.archivo),
      );
      this.confirmado = false;
    } catch {
      this.resetPreview();
      this.toast.error(
        'No se pudo revisar el Excel. Comprueba el archivo e inténtalo de nuevo.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  async revisarEdicion() {
    this.cargando.set(true);
    try {
      this.preview = await firstValueFrom(
        this.servicio.previsualizarCambioCatalogo(this.fila, undefined),
      );
      this.confirmado = false;
    } catch {
      this.resetPreview();
      this.toast.error(
        'No se pudieron revisar los cambios. Comprueba los campos.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  get puedeAplicar(): boolean {
    return (
      !!this.preview?.previewHash &&
      !this.preview.errores?.length &&
      this.cantidadConCambios(this.preview) > 0 &&
      (this.dialogoEdicion ||
        !this.preview.requiereConfirmacion ||
        this.confirmado)
    );
  }

  cantidadSinCambios(resultado: CatalogoPreview): number {
    return (
      resultado.cambios?.filter((cambio) => cambio.estado === 'sinCambios')
        .length ?? 0
    );
  }

  cantidadConCambios(resultado: CatalogoPreview): number {
    return (
      (resultado.cambios?.filter((cambio) => cambio.estado !== 'sinCambios')
        .length ?? 0) + (resultado.cambiosTrabajo?.length ?? 0)
    );
  }

  valorCambio(fila: CatalogoFilaEditable | null, campo: string): string {
    if (!fila) return '—';
    const valor =
      campo === 'nombre'
        ? fila.nombreCorto
        : campo === 'explicación'
          ? fila.nombreDescriptivo
          : campo === 'puntos importantes'
            ? fila.puntosImportantes
            : campo === 'color'
              ? fila.color
              : campo === 'activación'
                ? (fila as CatalogoFilaEditable & { activa?: boolean })
                    .activa === false
                  ? 'No'
                  : 'Sí'
                : undefined;
    return valor?.trim() || '—';
  }

  async aplicar() {
    if (!this.preview?.previewHash || !this.puedeAplicar) return;
    this.guardando.set(true);
    try {
      if (this.dialogoImportacion && this.archivo)
        await firstValueFrom(
          this.servicio.aplicarCatalogo(
            this.archivo,
            this.preview.previewHash,
            this.confirmado,
          ),
        );
      else
        await firstValueFrom(
          this.servicio.guardarCambioCatalogo(
            this.preview.previewHash,
            true,
            this.fila,
            undefined,
          ),
        );
      this.toast.success('Catálogo guardado');
      this.dialogoEdicion = false;
      this.dialogoImportacion = false;
      this.resetPreview();
      await this.cargar();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.resetPreview();
        this.toast.warning(
          'El catálogo ha cambiado. Revisa de nuevo antes de guardar.',
        );
        await this.cargar();
      } else {
        this.toast.error('No se pudieron guardar los cambios del catálogo.');
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
