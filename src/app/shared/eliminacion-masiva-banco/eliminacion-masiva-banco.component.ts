import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { isEqual } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, Observable } from 'rxjs';
import {
  LIMITE_ELIMINACION_MASIVA,
  RevisionEliminacionMasiva,
} from '../models/eliminacion-masiva.model';
import { PrimengModule } from '../primeng.module';
import { PaginatedResult, PaginationFilter } from '../models/pagination.model';

type FiltrosSeleccion = Pick<PaginationFilter, 'searchTerm' | 'where'>;

@Component({
  selector: 'app-eliminacion-masiva-banco',
  standalone: true,
  imports: [CommonModule, PrimengModule],
  templateUrl: './eliminacion-masiva-banco.component.html',
  styleUrl: './eliminacion-masiva-banco.component.scss',
})
export class EliminacionMasivaBancoComponent {
  @Input() habilitado = false;
  @Input({ required: true }) banco!: 'preguntas' | 'flashcards';
  @Input({ required: true }) filtro!: PaginationFilter;
  @Input() resultado?: PaginatedResult<{ id: number }>;
  @Input({ required: true }) obtenerIds!: (
    filtro: FiltrosSeleccion,
  ) => Observable<{ ids: number[] }>;
  @Input({ required: true }) revisar!: (
    ids: number[],
    primeraEntrada?: number,
  ) => Observable<RevisionEliminacionMasiva>;
  @Input({ required: true }) borrar!: (
    ids: number[],
  ) => Observable<{ eliminadas: number }>;
  @Output() actualizarListado = new EventEmitter<void>();
  @ViewChild('activador', { static: true }) activador!: TemplateRef<unknown>;
  @ViewChild('barra', { static: true }) barra!: TemplateRef<unknown>;
  @ViewChild('listaRevision') listaRevision?: ElementRef<HTMLUListElement>;

  private readonly toast = inject(ToastrService);
  private filtroCompleto?: { filtro: FiltrosSeleccion; ids: number[] };
  private idsRevisados: number[] = [];
  private seleccion = new Set<number>();

  activo = false;
  ids: number[] = [];
  cargando = false;
  eliminando = false;
  mostrandoRevision = false;
  revision?: RevisionEliminacionMasiva;
  primeraEntrada = 0;
  readonly limite = LIMITE_ELIMINACION_MASIVA;

  get ocupado() {
    return this.cargando || this.eliminando;
  }

  get paginaVigente() {
    const cargado = this.resultado?.pagination;
    return (
      !!cargado &&
      cargado.skip === this.filtro.skip &&
      cargado.take === this.filtro.take &&
      (cargado.searchTerm ?? '') === this.filtro.searchTerm &&
      isEqual(cargado.where, this.filtro.where)
    );
  }

  get enPagina() {
    return this.paginaVigente
      ? (this.resultado?.data ?? []).filter(({ id }) => this.seleccion.has(id))
          .length
      : 0;
  }

  get total() {
    return this.paginaVigente ? (this.resultado?.pagination.count ?? 0) : 0;
  }

  get mostrarSeleccionResultados() {
    const filas = this.resultado?.data.length ?? 0;
    return (
      filas > 0 &&
      this.enPagina === filas &&
      this.total > filas &&
      !(
        this.filtroCompleto &&
        isEqual(this.filtroCompleto.filtro, this.filtrosActuales()) &&
        this.filtroCompleto.ids.every((id) => this.seleccion.has(id))
      )
    );
  }

  nombre(cantidad: number) {
    if (cantidad !== 1) return this.banco;
    return this.banco === 'preguntas' ? 'pregunta' : 'flashcard';
  }

  alternarModo() {
    if (!this.habilitado || this.ocupado) return;
    this.activo = !this.activo;
    if (!this.activo) this.limpiar();
  }

  cambiarSeleccion(ids: (number | string)[]) {
    if (!this.activo || this.ocupado || !this.paginaVigente) return;
    this.registrarSeleccion(
      ids.filter((id): id is number => typeof id === 'number'),
    );
  }

  limpiar() {
    this.registrarSeleccion([]);
    this.filtroCompleto = undefined;
  }

  async seleccionarResultados() {
    if (
      this.ocupado ||
      !this.mostrarSeleccionResultados ||
      this.total > this.limite
    )
      return;
    const filtro = this.filtrosActuales();
    this.cargando = true;
    try {
      const { ids } = await firstValueFrom(this.obtenerIds(filtro));
      if (
        isEqual(filtro, this.filtrosActuales()) &&
        this.registrarSeleccion([...new Set([...this.ids, ...ids])])
      ) {
        this.filtroCompleto = { filtro, ids };
      }
    } catch {
      this.toast.error('No se pudieron seleccionar los resultados.');
    } finally {
      this.cargando = false;
    }
  }

  async abrirRevision() {
    if (!this.activo || this.ocupado || !this.ids.length) return;
    this.cargando = true;
    try {
      const ids = [...this.ids];
      this.revision = await firstValueFrom(this.revisar(ids));
      this.idsRevisados = ids;
      this.primeraEntrada = 0;
      this.mostrandoRevision = true;
    } catch (error) {
      this.notificarError(error, 'No se pudo revisar la selección.');
    } finally {
      this.cargando = false;
    }
  }

  async cambiarPaginaRevision(primeraEntrada: number) {
    if (
      !this.mostrandoRevision ||
      this.ocupado ||
      primeraEntrada === this.primeraEntrada
    )
      return;
    this.cargando = true;
    try {
      const revision = await firstValueFrom(
        this.revisar(this.idsRevisados, primeraEntrada),
      );
      if (this.mostrandoRevision) {
        this.revision = revision;
        this.primeraEntrada = primeraEntrada;
        if (this.listaRevision) this.listaRevision.nativeElement.scrollTop = 0;
      }
    } catch (error) {
      this.notificarError(
        error,
        'No se pudo cargar esta página de la selección.',
      );
    } finally {
      this.cargando = false;
    }
  }

  async confirmarEliminacion() {
    if (!this.mostrandoRevision || this.ocupado || !this.idsRevisados.length)
      return;
    this.eliminando = true;
    try {
      const { eliminadas } = await firstValueFrom(
        this.borrar(this.idsRevisados),
      );
      this.mostrandoRevision = false;
      this.limpiar();
      this.actualizarListado.emit();
      this.toast.success(
        `Se ${eliminadas === 1 ? 'eliminó' : 'eliminaron'} ${eliminadas} ${this.nombre(eliminadas)}.`,
      );
    } catch (error) {
      this.notificarError(error, 'No se pudo eliminar la selección.');
    } finally {
      this.eliminando = false;
    }
  }

  private registrarSeleccion(ids: number[]) {
    if (ids.length > this.limite) {
      this.toast.warning(
        'Puedes seleccionar hasta 5.000 entradas por operación.',
      );
      return false;
    }
    this.ids = ids;
    this.seleccion = new Set(ids);
    return true;
  }

  private filtrosActuales(): FiltrosSeleccion {
    const { searchTerm, where } = this.filtro;
    return { searchTerm, where };
  }

  private notificarError(error: unknown, mensaje: string) {
    if (
      typeof error === 'object' &&
      error &&
      'status' in error &&
      error.status === 409
    ) {
      this.mostrandoRevision = false;
      this.limpiar();
      this.actualizarListado.emit();
      this.toast.warning(
        'La selección ha cambiado. Vuelve a marcar las entradas.',
      );
      return;
    }
    this.toast.error(mensaje);
  }
}
