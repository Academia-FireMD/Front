import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { CatalogoSubbloquesListComponent } from './catalogo-subbloques-list.component';
import { EditarSubBloqueDialogComponent } from '../editar-sub-bloque-dialog/editar-sub-bloque-dialog.component';
import { ExcelFilePickerComponent } from '../../shared/excel-file-picker/excel-file-picker.component';
import { MarkdownContentComponent } from '../../shared/markdown-content/markdown-content.component';
import { SubBloqueMarkdownFieldComponent } from '../editar-sub-bloque-dialog/sub-bloque-markdown-field.component';
import {
  CatalogoContenidoCompleto,
  CatalogoFilaEditable,
  CatalogoLista,
  CatalogoPreview,
  CatalogoTrabajo,
  ComponerContenidoResponse,
  TipoTrabajoCatalogo,
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
    DropdownModule,
    InputTextModule,
    TagModule,
    ExcelFilePickerComponent,
    CatalogoSubbloquesListComponent,
    EditarSubBloqueDialogComponent,
    MarkdownContentComponent,
    SubBloqueMarkdownFieldComponent,
  ],
  templateUrl: './catalogo-subbloques.component.html',
  styleUrl: './catalogo-subbloques.component.scss',
})
export class CatalogoSubbloquesComponent implements OnInit {
  @ViewChild('indicacionesContenido')
  private indicacionesContenido?: ElementRef<HTMLElement>;
  private readonly tiposIndicacion: TipoTrabajoCatalogo[] = [
    'ESTUDIO',
    'R1',
    'R2',
    'R3',
    'R4',
    'R5',
  ];
  private readonly servicio = inject(PlanificacionesService);
  private readonly toast = inject(ToastrService);
  readonly catalogo = signal<CatalogoLista>({ filas: [], trabajos: [] });
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  dialogoEdicion = false;
  dialogoImportacion = false;
  dialogoIndicaciones = false;
  indicacionEditando: TipoTrabajoCatalogo | null = null;
  textoIndicacion = '';
  vistaTipo: TipoTrabajoCatalogo | null = null;
  vistaCompuesta: ComponerContenidoResponse | null = null;
  vistaCargando = false;
  vistaError = false;
  private vistaPeticion = 0;
  private revisionIndicacion = 0;
  esNuevo = false;
  fila: CatalogoFilaEditable = this.filaVacia();
  archivo: File | null = null;
  preview: CatalogoPreview | null = null;
  confirmado = false;

  ngOnInit(): void {
    void this.cargar();
  }

  get indicaciones(): CatalogoTrabajo[] {
    return this.tiposIndicacion.map(
      (trabajo) =>
        this.catalogo().trabajos.find((item) => item.trabajo === trabajo) ?? {
          trabajo,
          descripcion: '',
          version: 0,
        },
    );
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
    this.vistaCompuesta = null;
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
    this.vistaTipo = null;
    void this.cargarVistaCompuesta();
  }

  get opcionesVista() {
    return [
      { label: 'Sin indicaciones adicionales', value: null },
      ...this.catalogo().trabajos.map((item) => ({
        label: item.trabajo,
        value: item.trabajo,
      })),
    ];
  }

  async cargarVistaCompuesta(): Promise<void> {
    if (this.esNuevo || !this.dialogoEdicion) return;
    const peticion = ++this.vistaPeticion;
    this.vistaCargando = true;
    this.vistaError = false;
    this.vistaCompuesta = null;
    try {
      const vista = await firstValueFrom(
        this.servicio.componerContenidoCatalogo(
          this.fila.codigo,
          this.vistaTipo ?? undefined,
        ),
      );
      if (peticion === this.vistaPeticion && this.dialogoEdicion)
        this.vistaCompuesta = vista;
    } catch {
      if (peticion === this.vistaPeticion && this.dialogoEdicion)
        this.vistaError = true;
    } finally {
      if (peticion === this.vistaPeticion) this.vistaCargando = false;
    }
  }

  abrirIndicaciones(): void {
    this.revisionIndicacion++;
    this.indicacionEditando = null;
    this.textoIndicacion = '';
    this.resetPreview();
    this.dialogoIndicaciones = true;
  }

  editarIndicacion(indicacion: CatalogoTrabajo): void {
    this.revisionIndicacion++;
    this.indicacionEditando = indicacion.trabajo;
    this.textoIndicacion = indicacion.descripcion;
    this.resetPreview();
    this.ponerIndicacionesArriba();
  }

  cancelarEdicionIndicacion(): void {
    this.revisionIndicacion++;
    this.indicacionEditando = null;
    this.textoIndicacion = '';
    this.resetPreview();
    this.ponerIndicacionesArriba();
  }

  private ponerIndicacionesArriba(): void {
    if (!this.indicacionesContenido) return;
    requestAnimationFrame(() => {
      const contenedor =
        this.indicacionesContenido?.nativeElement.closest('.p-dialog-content');
      if (contenedor) contenedor.scrollTop = 0;
    });
  }

  cambiarTextoIndicacion(valor: string): void {
    this.revisionIndicacion++;
    this.textoIndicacion = valor;
    this.resetPreview();
  }

  async revisarIndicacion(): Promise<void> {
    if (!this.indicacionEditando || this.cargando()) return;
    const revision = ++this.revisionIndicacion;
    const tipo = this.indicacionEditando;
    const texto = this.textoIndicacion;
    this.cargando.set(true);
    try {
      const preview = await firstValueFrom(
        this.servicio.previsualizarCambioCatalogo(undefined, {
          [tipo]: texto,
        }),
      );
      if (revision === this.revisionIndicacion && this.dialogoIndicaciones)
        this.preview = preview;
    } catch {
      if (revision === this.revisionIndicacion) {
        this.resetPreview();
        this.toast.error(
          'No se pudo revisar la indicación. Comprueba el texto.',
        );
      }
    } finally {
      this.cargando.set(false);
    }
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
        this.dialogoIndicaciones ||
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
    const revisionGuardada = this.revisionIndicacion;
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
      else if (this.dialogoIndicaciones && this.indicacionEditando)
        await firstValueFrom(
          this.servicio.guardarCambioCatalogo(
            this.preview.previewHash,
            true,
            undefined,
            { [this.indicacionEditando]: this.textoIndicacion },
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
      const borradorPosterior =
        this.dialogoIndicaciones &&
        revisionGuardada !== this.revisionIndicacion;
      this.toast.success(
        borradorPosterior
          ? 'Se guardó la versión revisada. Tus cambios posteriores siguen sin guardar.'
          : 'Catálogo guardado',
      );
      this.dialogoEdicion = false;
      this.dialogoImportacion = false;
      if (!borradorPosterior) this.cancelarEdicionIndicacion();
      this.resetPreview();
      await this.cargar();
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.resetPreview();
        this.toast.warning(
          this.dialogoIndicaciones
            ? 'El catálogo ha cambiado. Conservamos tu texto: revisa las diferencias de nuevo antes de guardar.'
            : 'El catálogo ha cambiado. Revisa de nuevo antes de guardar.',
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
