import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TagModule } from 'primeng/tag';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { GenericListComponent } from '../../shared/generic-list/generic-list.component';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import {
  CatalogoContenidoCompleto,
  CatalogoFilaEditable,
  CatalogoLista,
  CatalogoPreview,
  TipoTrabajoCatalogo,
} from '../models/catalogo-contenido.model';

const TIPOS_TRABAJO: TipoTrabajoCatalogo[] = [
  'ESTUDIO',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
];

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
    InputTextareaModule,
    TagModule,
    GenericListComponent,
  ],
  templateUrl: './catalogo-subbloques.component.html',
  styleUrl: './catalogo-subbloques.component.scss',
})
export class CatalogoSubbloquesComponent
  extends SharedGridComponent<CatalogoContenidoCompleto>
  implements OnInit
{
  private readonly servicio = inject(PlanificacionesService);
  readonly catalogo = signal<CatalogoLista>({ filas: [], trabajos: [] });
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly tiposTrabajo = TIPOS_TRABAJO;

  dialogoEdicion = false;
  dialogoLeyendas = false;
  dialogoImportacion = false;
  esNuevo = false;
  fila: CatalogoFilaEditable = this.filaVacia();
  leyendas: Partial<Record<TipoTrabajoCatalogo, string>> = {};
  archivo: File | null = null;
  preview: CatalogoPreview | null = null;
  confirmado = false;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      const filtro = this.pagination();
      const texto = filtro.searchTerm.trim().toLocaleLowerCase('es');
      const filas = this.catalogo().filas.filter(
        (fila) =>
          !texto ||
          `${fila.codigo} ${fila.nombreCorto} ${fila.nombreDescriptivo ?? ''}`
            .toLocaleLowerCase('es')
            .includes(texto),
      );
      return of({
        data: filas.slice(filtro.skip, filtro.skip + filtro.take),
        pagination: { ...filtro, count: filas.length },
      });
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
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

  abrirLeyendas() {
    this.leyendas = Object.fromEntries(
      this.catalogo().trabajos.map((trabajo) => [
        trabajo.trabajo,
        trabajo.descripcion,
      ]),
    );
    this.resetPreview();
    this.dialogoLeyendas = true;
  }

  abrirImportacion() {
    this.archivo = null;
    this.resetPreview();
    this.dialogoImportacion = true;
  }

  seleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    this.archivo = input.files?.[0] ?? null;
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
        this.servicio.previsualizarCambioCatalogo(
          this.dialogoLeyendas ? undefined : this.fila,
          this.dialogoLeyendas ? this.leyendas : undefined,
        ),
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
      (!this.preview.requiereConfirmacion || this.confirmado)
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
            this.confirmado,
            this.dialogoLeyendas ? undefined : this.fila,
            this.dialogoLeyendas ? this.leyendas : undefined,
          ),
        );
      this.toast.success('Catálogo guardado');
      this.dialogoEdicion = false;
      this.dialogoLeyendas = false;
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
