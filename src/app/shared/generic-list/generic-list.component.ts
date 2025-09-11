import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  computed,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
} from '@angular/core';
import { FormBuilder, FormControl, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, tap } from 'rxjs';
import { Rol } from '../models/user.model';
import { PrimengModule } from '../primeng.module';
import { SharedGridComponent } from '../shared-grid/shared-grid.component';
import { SharedModule } from '../shared.module';

export interface FilterOption {
  label: string;
  value: any;
}

export interface FilterConfig {
  key: string;
  label: string;
  specialCaseKey?: 'rangeDate';
  type:
  | 'dropdown'
  | 'calendar'
  | 'text'
  | 'tema-select'
  | 'dificultad-dropdown'
  | 'comunidad-picker'
  | 'comunidad-dropdown'
  | 'toggle';
  options?: FilterOption[];
  placeholder?: string;
  defaultValue?: any;
  dateConfig?: {
    selectionMode: 'single' | 'multiple' | 'range';
  };
  filterInterpolation?: (value: any) => any;
}

export type GenericListMode = 'overview' | 'selection';

@Component({
  selector: 'app-generic-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    SharedModule,
  ],
  template: `
    <div class="shared-grid grid">
      <!-- Top Action Bar -->
      <div class="col-12">
        <div class="top-action-bar">
          <!-- Left Actions - Siempre visible -->
          <div class="left-actions">
            <ng-content select="[left-actions]"></ng-content>
          </div>
          <div *ngIf="mode === 'selection'" class="flex align-items-center gap-2 ml-2">
              <p-checkbox
                [binary]="true"
                [ngModel]="isAllSelected()"
                (ngModelChange)="toggleSelectAll()"
                styleClass="select-all-checkbox"
              />
              <label class="text-sm" *ngIf="viewportService.screenWidth != 'xs'">Seleccionar todo</label>
            </div>
          <!-- Right Actions - Siempre visible -->
          <div class="right-actions">
            <ng-content select="[right-actions]"></ng-content>
          </div>

          <!-- Botón de filtros - Siempre visible si hay filtros -->
          <div
            *ngIf="filters && filters.length > 0"
            class="filter-button-wrapper"
          >
            <p-button
              icon="pi pi-filter"
              styleClass="p-button-outlined"
              [tooltipPosition]="'left'"
              pTooltip="Filtros"
              (click)="showFiltersDialog = true"
            ></p-button>
            <p-badge
              *ngIf="getActiveFiltersCount() > 0"
              [value]="getActiveFiltersCount()"
              severity="primary"
              class="filter-count-badge"
            ></p-badge>
          </div>
        </div>
      </div>

      <!-- List Content -->
      <div class="col-12 list-generic">
        <p-dataView #dv [value]="(internalFetch$() | async)?.data ?? []">
          <ng-template pTemplate="list" let-data>
            <div class="grid grid-nogutter">
              <div
                class="col-12 item-container"
                [ngClass]="{'pointer': mode === 'overview', 'selection-mode': mode === 'selection'}"
                *ngFor="let item of data"
                (click)="handleItemClick(item)"
              >
                <!-- Checkbox para modo selección -->
                <div *ngIf="mode === 'selection'" class="selection-checkbox-container">
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="isItemSelected(item)"
                    (ngModelChange)="toggleItemSelection(item)"
                    (click)="$event.stopPropagation()"
                    styleClass="item-selection-checkbox"
                  />
                </div>

                <div class="item-content" [ngClass]="{'with-checkbox': mode === 'selection'}">
                  <ng-container
                    [ngTemplateOutlet]="itemTemplate"
                    [ngTemplateOutletContext]="{ $implicit: item, mode: mode, isSelected: isItemSelected(item) }"
                  >
                  </ng-container>
                </div>
              </div>
            </div>
          </ng-template>
          <ng-template pTemplate="empty">
            <ng-content select="[empty-template]"></ng-content>
          </ng-template>
        </p-dataView>
      </div>

      <!-- Pagination -->
      <div class="col-12" *ngIf="showPagination">
        <div class="card flex justify-content-end">
          <p-paginator
            (onPageChange)="onPageChange($event)"
            [first]="pagination().skip"
            [rows]="pagination().take"
            [totalRecords]="lastLoadedPagination?.pagination?.count ?? 10"
            [showPageLinks]="true"
          >
          </p-paginator>
        </div>
      </div>
    </div>

    <!-- Diálogo de filtros - Siempre disponible si hay filtros -->
    <p-dialog
      *ngIf="filters && filters.length > 0"
      header="Filtros"
      [(visible)]="showFiltersDialog"
      [modal]="true"
      [breakpoints]="{ '960px': '75vw', '640px': '90vw' }"
      [style]="{ width: '90%', maxWidth: '500px' }"
      [draggable]="false"
      [resizable]="false"
    >
      <div class="flex flex-column gap-3">
        <div *ngFor="let filter of filters" class="field">
          <label class="block text-sm font-medium mb-2">{{
            filter.label
          }}</label>

          <!-- Dropdown Filter -->
          <ng-container
            *ngIf="
              filter.type === 'dropdown' &&
              getFilterControl(filter.key) as control
            "
          >
            <p-dropdown
              [options]="filter.options"
              [formControl]="control"
              optionLabel="label"
              optionValue="value"
              [placeholder]="filter.placeholder || filter.label"
              appendTo="body"
              class="w-full"
              [style]="{ width: '100%' }"
            ></p-dropdown>
          </ng-container>
          <!-- Calendar Filter -->
          <p-calendar
            *ngIf="
              filter.type === 'calendar' &&
              getFilterControl(filter.key) as control
            "
            [formControl]="control"
            dateFormat="dd/mm/yy"
            [placeholder]="filter.placeholder || filter.label"
            appendTo="body"
            class="w-full"
            [showButtonBar]="true"
            [selectionMode]="filter.dateConfig?.selectionMode ?? 'single'"
          ></p-calendar>

          <!-- Tema Select Filter -->
          <app-tema-select
            *ngIf="
              filter.type === 'tema-select' &&
              getFilterControl(filter.key) as control
            "
            [formControl]="control"
          ></app-tema-select>

          <!-- Dificultad Dropdown Filter -->
          <app-dificultad-dropdown
            *ngIf="
              filter.type === 'dificultad-dropdown' &&
              getFilterControl(filter.key) as control
            "
            [formControlDificultad]="control"
            [isDoingTest]="false"
          ></app-dificultad-dropdown>

          <!-- Comunidad Picker Filter -->
          <app-comunidad-picker
            *ngIf="
              filter.type === 'comunidad-picker' &&
              getFilterControl(filter.key) as control
            "
            [comunidades]="control.value || []"
            (updateSelection)="control.setValue($event)"
          ></app-comunidad-picker>

          <!-- Comunidad Dropdown Filter -->
          <app-comunidad-dropdown
            *ngIf="
              filter.type === 'comunidad-dropdown' &&
              getFilterControl(filter.key) as control
            "
            [formControl]="control"
            [placeholder]="filter.placeholder || filter.label"
            [multiple]="true"
          ></app-comunidad-dropdown>

          <!-- Toggle Filter -->
          <div
            *ngIf="
              filter.type === 'toggle' &&
              getFilterControl(filter.key) as control
            "
            class="flex align-items-center gap-2"
          >
            <p-inputSwitch [formControl]="control"></p-inputSwitch>
            <label class="text-sm">{{ filter.placeholder || 'Activar filtro' }}</label>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="flex gap-2 mt-3">
          <p-button
            label="Limpiar filtros"
            icon="pi pi-times"
            styleClass="p-button-outlined"
            (click)="clearFilters(); showFiltersDialog = false"
            class="flex-1"
            [style]="{ width: '100%' }"
          ></p-button>
          <p-button
            label="Aplicar"
            icon="pi pi-check"
            (click)="applyFilters()"
            class="flex-1"
            [style]="{ width: '100%' }"
          ></p-button>
        </div>
      </div>
    </p-dialog>
  `,
  styleUrls: ['./generic-list.component.scss'],
})
export class GenericListComponent<T>
  extends SharedGridComponent<T>
  implements OnInit, OnDestroy {
  @Input() itemTemplate!: TemplateRef<any>;
  @Input() showPagination: boolean = true;
  @Input() filters?: FilterConfig[];
  @Input() mode: GenericListMode = 'overview';
  @Input() selectedItemIds: (string | number)[] = [];
  @Input() getItemId: (item: T) => string | number = (item: any) => item.id;
  @Output() onItemClick = new EventEmitter<T>();
  @Output() filtersChanged = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<(string | number)[]>();

  public showFiltersDialog = false;
  private fb = new FormBuilder();
  filterControls: Map<string, FormControl> = new Map();
  private queryParamsSubscription?: Subscription;
  public Rol = Rol;

  // Envuelve el fetch entrante para actualizar el total en el paginador
  public internalFetch$ = computed(() => {
    const source$ = this.fetchItems$();
    return source$.pipe(
      tap((res) => {
        if (res) {
          this.lastLoadedPagination = res as any;
        }
      })
    );
  });

  constructor(
    override router: Router,
    override route: ActivatedRoute,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    super();
  }

  override ngOnInit() {
    super.ngOnInit();
    this.initializeFilters();

    // Suscribirse a cambios en queryParams para recargar filtros automáticamente
    this.queryParamsSubscription = this.route.queryParams.subscribe(
      (params) => {
        // Solo recargar si hay parámetros de filtros
        const hasFilterParams = Object.keys(params).some((key) =>
          this.filterControls.has(key)
        );

        if (hasFilterParams) {
          // Solo cargar los valores en los controles, sin aplicar automáticamente
          this.loadFiltersFromQueryParams();
        }
      }
    );

    // Usar setTimeout para asegurar que los controles estén inicializados
    setTimeout(() => {
      this.loadFiltersFromQueryParams();
    }, 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
  }

  ngOnDestroy() {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
  }

  private initializeFilters() {
    if (this.filters) {
      this.filters.forEach((filter) => {
        const control = this.fb.control(filter.defaultValue || null);
        this.filterControls.set(filter.key, control);
      });
    }
  }

  private loadFiltersFromQueryParams() {
    const queryParams = this.route.snapshot.queryParams;
    let hasLoadedFilters = false;

    this.filterControls.forEach((control, key) => {
      const paramValue = queryParams[key];
      if (paramValue !== undefined) {
        const filter = this.filters?.find((f) => f.key === key);
        if (filter) {
          const decodedValue = this.decodeFilterValue(filter, paramValue);
          control.setValue(decodedValue);
          hasLoadedFilters = true;
        } else {
          console.warn(`Filtro no encontrado para key: ${key}`);
        }
      }
    });

    // Si se cargaron filtros y se debe aplicar automáticamente
    if (hasLoadedFilters) {
      // Usar setTimeout para asegurar que los controles estén inicializados
      setTimeout(() => {
        // Crear el objeto where con los filtros cargados
        const where: any = {};
        this.filterControls.forEach((control, key) => {
          const value = control.value;
          if (value !== null && value !== undefined && value !== '') {
            const filter = this.filters?.find((f) => f.key === key);
            if (filter?.filterInterpolation) {
              const processedValue = filter.filterInterpolation(value);
              if (Object.keys(processedValue).length > 0) {
                Object.assign(where, processedValue);
              }
            } else if (filter?.specialCaseKey) {
              const processedValue = this.processSpecialCase(filter, value);
              if (Object.keys(processedValue).length > 0) {
                Object.assign(where, processedValue);
              }
            } else {
              where[key] = value;
            }
          }
        });

        // Emitir los filtros al componente padre
        this.filtersChanged.emit(
          Object.keys(where).length > 0 ? where : undefined
        );

        this.forceControlSync();
      }, 100);
    }
  }

  private forceControlSync() {
    // Forzar la detección de cambios en todos los controles
    this.filterControls.forEach((control) => {
      control.updateValueAndValidity();
      control.markAsTouched();
      control.markAsDirty();
    });

    // Forzar la detección de cambios en Angular
    this.changeDetectorRef.detectChanges();
  }

  private encodeFilterValue(filter: FilterConfig, value: any): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    // Casos especiales
    if (filter.specialCaseKey === 'rangeDate' && Array.isArray(value)) {
      return `${value[0]?.getTime() || ''},${value[1]?.getTime() || ''}`;
    }

    // Arrays - filtrar valores nulos y convertir a string
    if (Array.isArray(value)) {
      const validValues = value.filter(
        (v) => v !== null && v !== undefined && v !== ''
      );
      return validValues.map((v) => v.toString()).join(',');
    }

    // Fechas
    if (value instanceof Date) {
      return value.getTime().toString();
    }

    // Valores simples (incluyendo dropdowns)
    if (typeof value === 'boolean') {
      return value.toString();
    }
    return value.toString();
  }

  private decodeFilterValue(filter: FilterConfig, encodedValue: string): any {
    if (!encodedValue || encodedValue === '') {
      return null;
    }

    // Casos especiales
    if (filter.specialCaseKey === 'rangeDate') {
      const [start, end] = encodedValue.split(',');
      return [
        start ? new Date(parseInt(start)) : null,
        end ? new Date(parseInt(end)) : null,
      ];
    }

    // Arrays - manejar tanto strings como números
    if (filter.type === 'tema-select') {
      const values = encodedValue.split(',');
      return values
        .map((v) => {
          if (v === 'null' || v === '') return null;
          // Intentar convertir a número si es posible
          const numValue = parseInt(v);
          return isNaN(numValue) ? v : numValue;
        })
        .filter((v) => v !== null);
    }

    // Dropdown simple - devolver valor único
    if (filter.type === 'dropdown') {
      if (encodedValue === 'null' || encodedValue === '') return null;

      // Manejar valores booleanos
      if (encodedValue === 'true') return true;
      if (encodedValue === 'false') return false;

      // Intentar convertir a número si es posible
      const numValue = parseInt(encodedValue);
      return isNaN(numValue) ? encodedValue : numValue;
    }

    // Fechas
    if (
      filter.type === 'calendar' &&
      filter.dateConfig?.selectionMode !== 'range'
    ) {
      return new Date(parseInt(encodedValue));
    }

    // Valores simples
    return encodedValue;
  }

  private saveFiltersToQueryParams(where: any) {
    const queryParams: any = { ...this.route.snapshot.queryParams };

    // Limpiar TODOS los filtros anteriores (no solo los que están en filterControls)
    this.filterControls.forEach((_, key) => {
      delete queryParams[key];
    });

    // Guardar solo los filtros que tienen valores válidos
    Object.keys(where).forEach((key) => {
      const filter = this.filters?.find((f) => f.key === key);
      if (filter) {
        const value = where[key];
        const encodedValue = this.encodeFilterValue(filter, value);
        if (encodedValue && encodedValue !== '') {
          queryParams[key] = encodedValue;
        }
      }
    });
    this.updateQueryParamsFilters(queryParams);
  }

  updateQueryParamsFilters(queryParams: any) {
    // Obtener todos los queryParams actuales
    const currentQueryParams = { ...this.route.snapshot.queryParams };

    // Limpiar TODOS los filtros anteriores
    this.filterControls.forEach((_, key) => {
      delete currentQueryParams[key];
    });

    // Añadir solo los filtros activos
    Object.keys(queryParams).forEach((key) => {
      if (queryParams[key] !== undefined && queryParams[key] !== '') {
        currentQueryParams[key] = queryParams[key];
      }
    });

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: currentQueryParams,
      replaceUrl: true, // Usar replaceUrl para forzar la actualización
    });
  }

  getFilterControl(key: string): FormControl {
    return this.filterControls.get(key) as FormControl;
  }

  updateFilters() {
    const where: any = {};
    let hasFilters = false;

    this.filterControls.forEach((control, key) => {
      const value = control.value;
      if (value !== null && value !== undefined && value !== '') {
        const filter = this.filters?.find((f) => f.key === key);

        if (filter?.filterInterpolation) {
          const processedValue = filter.filterInterpolation(value);
          if (Object.keys(processedValue).length > 0) {
            Object.assign(where, processedValue);
            hasFilters = true;
          }
        } else {
          if (filter?.specialCaseKey) {
            const processedValue = this.processSpecialCase(filter, value);
            if (Object.keys(processedValue).length > 0) {
              Object.assign(where, processedValue);
              hasFilters = true;
            }
          } else {
            where[key] = value;
            hasFilters = true;
          }
        }
      }
    });

    // Emitir los cambios de filtros al componente padre
    this.filtersChanged.emit(hasFilters ? where : undefined);
  }

  applyFilters() {
    // Primero actualizar los filtros internos
    this.updateFilters();
    this.showFiltersDialog = false;

    // Crear el objeto where completo con todos los valores actuales
    const where: any = {};
    this.filterControls.forEach((control, key) => {
      const value = control.value;
      // Solo incluir valores que no estén vacíos
      if (value !== null && value !== undefined && value !== '') {
        // Para arrays, verificar que no estén vacíos
        if (Array.isArray(value)) {
          if (value.length > 0) {
            where[key] = value;
          }
        } else {
          where[key] = value;
        }
      }
    });

    // Guardar en queryParams (esto limpiará automáticamente los filtros vacíos)
    this.saveFiltersToQueryParams(where);
  }

  processSpecialCase(filter: FilterConfig, value: any) {
    if (filter.specialCaseKey === 'rangeDate') {
      return {
        [filter.key]: {
          gte: value[0],
          lte: value[1],
        },
      };
    }
    return {};
  }

  clearFilters() {
    // Limpiar todos los controles
    this.filterControls.forEach((control) => {
      control.setValue(null);
    });

    // Aplicar los cambios (esto emitirá filtros vacíos)
    this.updateFilters();

    // Limpiar TODOS los queryParams relacionados con filtros
    const queryParams: any = { ...this.route.snapshot.queryParams };
    this.filterControls.forEach((_, key) => {
      delete queryParams[key];
    });

    this.updateQueryParamsFilters(queryParams);

    // Cerrar el diálogo
    this.showFiltersDialog = false;
  }

  getActiveFiltersCount(): number {
    return Array.from(this.filterControls.values()).filter((control) => {
      const value = control.value;
      if (value === null || value === undefined || value === '') {
        return false;
      }
      // Si es un array, verificar que tenga elementos
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      // Para otros tipos, considerar válido si no está vacío
      return true;
    }).length;
  }

  // Método para verificar si hay filtros activos
  hasActiveFilters(): boolean {
    return this.getActiveFiltersCount() > 0;
  }

  // Métodos para modo selección
  handleItemClick(item: T) {
    if (this.mode === 'selection') {
      this.toggleItemSelection(item);
    } else {
      this.onItemClick.emit(item);
    }
  }

  toggleItemSelection(item: T) {
    const itemId = this.getItemId(item);
    const currentSelection = [...this.selectedItemIds];
    const index = currentSelection.indexOf(itemId);

    if (index > -1) {
      currentSelection.splice(index, 1);
    } else {
      currentSelection.push(itemId);
    }

    this.selectionChange.emit(currentSelection);
  }

  isItemSelected(item: T): boolean {
    const itemId = this.getItemId(item);
    return this.selectedItemIds.includes(itemId);
  }

  isAllSelected(): boolean {
    const currentData = this.lastLoadedPagination?.data || [];
    if (currentData.length === 0) return false;

    return currentData.every((item: T) => this.isItemSelected(item));
  }

  toggleSelectAll() {
    const currentData = this.lastLoadedPagination?.data || [];
    const allSelected = this.isAllSelected();

    let newSelection = [...this.selectedItemIds];

    if (allSelected) {
      // Deseleccionar todos los elementos de la página actual
      currentData.forEach((item: T) => {
        const itemId = this.getItemId(item);
        const index = newSelection.indexOf(itemId);
        if (index > -1) {
          newSelection.splice(index, 1);
        }
      });
    } else {
      // Seleccionar todos los elementos de la página actual
      currentData.forEach((item: T) => {
        const itemId = this.getItemId(item);
        if (!newSelection.includes(itemId)) {
          newSelection.push(itemId);
        }
      });
    }

    this.selectionChange.emit(newSelection);
  }
}
