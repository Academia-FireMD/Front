import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { of } from 'rxjs';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import {
  FilterConfig,
  GenericListComponent,
  GenericListMode,
} from '../../shared/generic-list/generic-list.component';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';
import { CatalogoContenidoCompleto } from '../models/catalogo-contenido.model';

@Component({
  selector: 'app-catalogo-subbloques-list',
  standalone: true,
  imports: [
    CommonModule,
    GenericListComponent,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    TagModule,
  ],
  template: `
    <app-generic-list
      [fetchItems$]="fetchItems$"
      [itemTemplate]="filaTemplate"
      [filters]="filters"
      [mode]="mode"
      [selectedItemIds]="selectedIds"
      [getItemId]="getItemId"
      [getSelectionLabel]="getSelectionLabel"
      [sharedPagination]="pagination"
      [routeSyncEnabled]="routeSyncEnabled"
      [autoItemHeight]="true"
      (onItemClick)="editRequested.emit($event)"
      (selectionChange)="selectedIdsChange.emit($event)"
      (filtersChanged)="onFiltersChanged($event)"
    >
      <div left-actions>
        <label class="sr-only" for="buscar-subbloques">Buscar subbloques</label>
        <p-iconField iconPosition="left">
          <p-inputIcon styleClass="pi pi-search"></p-inputIcon>
          <input
            id="buscar-subbloques"
            pInputText
            type="search"
            [placeholder]="
              viewportService.screenWidth === 'xs'
                ? 'Buscar'
                : 'Buscar código o contenido'
            "
            [value]="pagination().searchTerm"
            (input)="onSearch($event)"
          />
        </p-iconField>
      </div>
      <div right-actions *ngIf="mode === 'overview'" class="catalogo-acciones">
        <p-button
          [label]="
            viewportService.screenWidth === 'xs'
              ? undefined
              : 'Importar catálogo'
          "
          ariaLabel="Importar catálogo"
          icon="pi pi-upload"
          [outlined]="true"
          styleClass="catalogo-accion"
          (click)="importRequested.emit()"
        ></p-button>
        <p-button
          [label]="
            viewportService.screenWidth === 'xs' ? undefined : 'Nuevo subbloque'
          "
          ariaLabel="Nuevo subbloque"
          icon="pi pi-plus"
          styleClass="catalogo-accion"
          (click)="newRequested.emit()"
        ></p-button>
      </div>
      <div empty-template class="text-center p-4">
        No hay subbloques para esta búsqueda.
      </div>
    </app-generic-list>

    <ng-template #filaTemplate let-item>
      <div class="catalogo-fila">
        <span
          class="muestra-color"
          [style.backgroundColor]="item.color"
          aria-hidden="true"
        ></span>
        <div class="catalogo-fila-texto">
          <strong>{{ item.codigo }} · {{ item.nombreCorto }}</strong>
          <small>{{ item.nombreDescriptivo || 'Sin explicación' }}</small>
        </div>
        <p-tag
          *ngIf="mode === 'overview'"
          [value]="item.activa ? 'Activo' : 'Inactivo'"
          [severity]="item.activa ? 'success' : 'secondary'"
        ></p-tag>
      </div>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        min-height: 0;
      }
      .catalogo-fila {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 0;
        padding: 0.7rem;
      }
      .catalogo-fila-texto {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 0.25rem;
        min-width: 0;
      }
      .catalogo-fila-texto strong,
      .catalogo-fila-texto small {
        overflow-wrap: anywhere;
      }
      .catalogo-fila-texto small {
        color: var(--text-color-secondary);
      }
      .muestra-color {
        flex: 0 0 1.5rem;
        width: 1.5rem;
        height: 1.5rem;
        border: 1px solid var(--surface-border);
        border-radius: 0.35rem;
      }
      p-iconField {
        display: block;
        width: 100%;
      }
      input[type='search'] {
        width: 100%;
        min-height: 44px;
      }
      .catalogo-acciones {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      @media (max-width: 640px) {
        :host ::ng-deep .catalogo-accion {
          min-width: 44px;
          min-height: 44px;
        }
        input[type='search'] {
          width: 100%;
        }
        .catalogo-fila {
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class CatalogoSubbloquesListComponent extends SharedGridComponent<CatalogoContenidoCompleto> {
  private readonly rows = signal<CatalogoContenidoCompleto[]>([]);
  private readonly seriesOptions: Array<{ label: string; value: string }> = [];

  @Input() set items(value: CatalogoContenidoCompleto[]) {
    this.rows.set(value ?? []);
    this.seriesOptions.splice(
      0,
      this.seriesOptions.length,
      ...[...new Set((value ?? []).map((item) => this.serie(item.codigo)))]
        .sort()
        .map((serie) => ({ label: serie, value: serie })),
    );
  }
  @Input() mode: GenericListMode = 'overview';
  @Input() selectedIds: (string | number)[] = [];
  @Output() selectedIdsChange = new EventEmitter<(string | number)[]>();
  @Output() editRequested = new EventEmitter<CatalogoContenidoCompleto>();
  @Output() importRequested = new EventEmitter<void>();
  @Output() newRequested = new EventEmitter<void>();

  readonly getItemId = (item: CatalogoContenidoCompleto) => item.id;
  readonly getSelectionLabel = (item: CatalogoContenidoCompleto) =>
    `Seleccionar ${item.codigo} · ${item.nombreCorto}`;
  readonly filtrosSerie: FilterConfig = {
    key: 'serie',
    label: 'Prefijo de código',
    type: 'dropdown',
    options: this.seriesOptions,
  };
  readonly filtrosEstado: FilterConfig = {
    key: 'estado',
    label: 'Estado',
    type: 'dropdown',
    options: [
      { label: 'Activos', value: 'activa' },
      { label: 'Inactivos', value: 'inactiva' },
    ],
  };
  readonly filtrosExplicacion: FilterConfig = {
    key: 'explicacion',
    label: 'Explicación',
    type: 'dropdown',
    options: [
      { label: 'Con explicación', value: 'con' },
      { label: 'Sin explicación', value: 'sin' },
    ],
  };
  readonly filtrosPuntos: FilterConfig = {
    key: 'puntos',
    label: 'Puntos importantes',
    type: 'dropdown',
    options: [
      { label: 'Con puntos', value: 'con' },
      { label: 'Sin puntos', value: 'sin' },
    ],
  };
  readonly filtrosVista = [
    this.filtrosSerie,
    this.filtrosEstado,
    this.filtrosExplicacion,
    this.filtrosPuntos,
  ];
  readonly filtrosSeleccion = [this.filtrosSerie];

  get filters(): FilterConfig[] {
    return this.mode === 'overview' ? this.filtrosVista : this.filtrosSeleccion;
  }

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      const page = this.pagination();
      const search = page.searchTerm.trim().toLocaleLowerCase('es');
      const where = page.where as
        | {
            serie?: string;
            estado?: string;
            explicacion?: string;
            puntos?: string;
          }
        | undefined;
      const matching = this.rows().filter((item) => {
        if (this.mode === 'selection' && !item.activa) return false;
        if (where?.estado === 'activa' && !item.activa) return false;
        if (where?.estado === 'inactiva' && item.activa) return false;
        if (where?.serie && this.serie(item.codigo) !== where.serie)
          return false;
        if (where?.explicacion === 'con' && !item.nombreDescriptivo?.trim())
          return false;
        if (where?.explicacion === 'sin' && !!item.nombreDescriptivo?.trim())
          return false;
        if (where?.puntos === 'con' && !item.puntosImportantes?.trim())
          return false;
        if (where?.puntos === 'sin' && !!item.puntosImportantes?.trim())
          return false;
        return (
          !search ||
          `${item.codigo} ${item.nombreCorto} ${item.nombreDescriptivo ?? ''} ${item.puntosImportantes ?? ''}`
            .toLocaleLowerCase('es')
            .includes(search)
        );
      });
      return of({
        data: matching.slice(page.skip, page.skip + page.take),
        pagination: { ...page, count: matching.length },
      });
    });
  }

  private serie(codigo: string): string {
    return codigo.match(/^[A-Z]+/)?.[0] ?? codigo;
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updatePaginationSafe({ searchTerm: value, skip: 0 });
  }

  onFiltersChanged(where: Record<string, unknown> | undefined): void {
    this.updatePaginationSafe({ where, skip: 0 });
  }
}
