import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  computed,
  inject,
  input,
  Input,
  Output,
} from '@angular/core';
import { tap } from 'rxjs';
import { UserService } from '../../../services/user.service';
import {
  FilterConfig,
  GenericListComponent,
  GenericListMode,
} from '../../../shared/generic-list/generic-list.component';
import { PaginationFilter } from '../../../shared/models/pagination.model';
import { Usuario } from '../../../shared/models/user.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { PrimengModule } from '../../../shared/primeng.module';
import { SuscripcionTipo } from '../../../shared/models/subscription.model';
import { labelDisplay } from '../../../shared/models/label.model';
import {
  getUserActivity,
  UserActivityStatus,
} from '../../../shared/utils/user-activity.utils';

/** Compact administrative list. All mutable user management lives in UserDetail. */
@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [CommonModule, PrimengModule, GenericListComponent],
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent extends SharedGridComponent<Usuario> {
  readonly userService = inject(UserService);
  readonly labelDisplay = labelDisplay;
  @Input() mode: GenericListMode = 'overview';
  @Input() singleSelection = false;
  @Input() selectedUserIds: number[] = [];
  readonly extraFilters = input<FilterConfig[]>();
  @Output() selectionChange = new EventEmitter<number[]>();
  private readonly initialListQueryParams = {
    ...this.route.snapshot.queryParams,
  };
  private initialQueryFilterSignature?: string | null;
  private initialQueryFilterMatched = false;
  private initialFilterHydrationOpen = true;

  readonly filters = computed(() => {
    const base: FilterConfig[] = [
      {
        key: 'tipoUsuario',
        label: 'Tipo de Usuario',
        type: 'dropdown',
        placeholder: 'Seleccionar tipo',
        options: [
          { label: 'Todos', value: 'todos' },
          { label: 'Admin/Tutores', value: 'admin' },
          { label: 'Usuarios Particulares', value: 'particulares' },
          { label: 'Usuarios WooCommerce', value: 'woocommerce' },
        ],
        filterInterpolation: (value) => {
          if (value === 'admin')
            return {
              OR: [{ rol: { equals: 'ADMIN' } }, { esTutor: { equals: true } }],
            };
          if (value === 'particulares')
            return {
              AND: [
                { woocommerceCustomerId: { equals: null } },
                { rol: { equals: 'ALUMNO' } },
                { esTutor: { equals: false } },
              ],
            };
          return value === 'woocommerce'
            ? { woocommerceCustomerId: { not: null } }
            : {};
        },
      },
      {
        key: 'suscripcion',
        label: 'Suscripción',
        type: 'dropdown',
        placeholder: 'Seleccionar suscripción',
        options: [
          { label: 'Todas las suscripciones', value: 'todas' },
          { label: 'Sin suscripción', value: 'sin_suscripcion' },
          { label: 'Básica', value: SuscripcionTipo.BASIC },
          { label: 'Premium', value: SuscripcionTipo.PREMIUM },
          { label: 'Avanzado', value: SuscripcionTipo.ADVANCED },
        ],
        filterInterpolation: (value) =>
          value === 'sin_suscripcion'
            ? { suscripciones: { none: {} } }
            : value === 'todas'
              ? {}
              : {
                  suscripciones: {
                    some: { tipo: { equals: value }, status: 'ACTIVE' },
                  },
                },
      },
      {
        key: 'validated',
        label: 'Estado',
        type: 'dropdown',
        placeholder: 'Seleccionar estado',
        options: [
          { label: 'Todos', value: 'todos' },
          { label: 'Verificados', value: true },
          { label: 'Sin verificar', value: false },
        ],
        filterInterpolation: (value) =>
          value === 'todos' ? {} : { validated: value },
      },
      {
        key: 'estadoActividad',
        label: 'Estado de actividad',
        type: 'dropdown',
        placeholder: 'Seleccionar estado',
        options: [
          { label: 'Todos', value: 'todos' },
          { label: 'Activos (Verde)', value: 'activo' },
          { label: 'Parciales (Amarillo)', value: 'parcial' },
          { label: 'Inactivos (Rojo)', value: 'inactivo' },
        ],
        filterInterpolation: (value) =>
          value === 'todos' ? {} : { estadoActividad: value },
      },
      {
        key: 'variasPlanificaciones',
        label: 'Varias planificaciones',
        type: 'dropdown',
        placeholder: 'Filtrar planificaciones',
        options: [
          { label: 'Todos', value: 'todos' },
          { label: 'Con varias planificaciones', value: 'varias' },
        ],
        filterInterpolation: (value) =>
          value === 'varias' ? { variasPlanificaciones: true } : {},
      },
      {
        key: 'rol',
        label: 'Rol',
        type: 'dropdown',
        placeholder: 'Seleccionar rol',
        options: [
          { label: 'Todos', value: 'todos' },
          { label: 'Admin', value: 'ADMIN' },
          { label: 'Alumno', value: 'ALUMNO' },
        ],
        filterInterpolation: (value) =>
          value === 'todos' ? {} : { rol: value },
      },
    ];
    return [...base, ...(this.extraFilters() || [])];
  });

  constructor() {
    super();
    this.fetchItems$ = computed(() =>
      this.userService
        .getAllUsers$(this.pagination())
        .pipe(tap((result) => (this.lastLoadedPagination = result))),
    );
  }
  onFiltersChanged(where: unknown): void {
    const signature = this.filterSignature(where);
    const initialSignature = this.queryFilterSignature();
    const isTransientEmptyHydration =
      initialSignature !== null &&
      !this.initialQueryFilterMatched &&
      !this.hasFilterConditions(where);
    const matchesInitial =
      initialSignature !== null && signature === initialSignature;
    const preserveInitialPagination =
      this.initialFilterHydrationOpen &&
      (isTransientEmptyHydration || matchesInitial);
    if (matchesInitial) {
      this.initialQueryFilterMatched = true;
    } else if (!isTransientEmptyHydration) {
      this.initialFilterHydrationOpen = false;
    }
    this.updatePaginationSafe(
      preserveInitialPagination
        ? { where, ...this.paginationFromQueryParams() }
        : { where, skip: 0 },
    );
  }

  private queryFilterSignature(): string | null {
    if (this.initialQueryFilterSignature !== undefined) {
      return this.initialQueryFilterSignature;
    }
    const queryParams =
      this.initialListQueryParams ?? this.route.snapshot.queryParams;
    const where: Record<string, unknown> = {};
    let hasFilter = false;
    for (const filter of this.filters()) {
      const rawValue = queryParams[filter.key];
      if (rawValue === undefined) continue;
      hasFilter = true;
      const value = this.decodeQueryFilterValue(rawValue, filter.type);
      const condition = filter.filterInterpolation
        ? filter.filterInterpolation(value)
        : { [filter.key]: value };
      Object.assign(where, condition);
    }
    this.initialQueryFilterSignature = hasFilter
      ? this.filterSignature(Object.keys(where).length ? where : undefined)
      : null;
    return this.initialQueryFilterSignature;
  }

  private decodeQueryFilterValue(
    value: unknown,
    type: FilterConfig['type'],
  ): unknown {
    if (type !== 'dropdown' || typeof value !== 'string') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  }

  private paginationFromQueryParams(): Pick<PaginationFilter, 'skip' | 'take'> {
    const queryParams =
      this.initialListQueryParams ?? this.route.snapshot.queryParams;
    return {
      skip: Number(queryParams['skip']) || 0,
      take: Number(queryParams['take']) || this.pagination().take,
    };
  }

  private filterSignature(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.filterSignature(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
        .map(
          ([key, item]) =>
            `${JSON.stringify(key)}:${this.filterSignature(item)}`,
        )
        .join(',')}}`;
    }
    return JSON.stringify(value) ?? String(value);
  }

  private hasFilterConditions(where: unknown): boolean {
    return (
      !!where && typeof where === 'object' && Object.keys(where).length > 0
    );
  }
  onItemClick(user: Usuario): void {
    if (this.mode !== 'selection') {
      // GenericList serializes each declared filter in the URL. Forwarding the
      // complete query state (rather than only skip/search) makes browser back
      // and the explicit return restore the selected filters as well.
      this.router.navigate(['/app/test/user', user.id], {
        queryParams: this.route.snapshot.queryParams,
      });
    }
  }
  getUserId = (user: Usuario): number => user.id;
  getUserActivity(user: Usuario) {
    return getUserActivity(user);
  }
  activityAriaLabel(status: UserActivityStatus): string {
    const label =
      status === 'active'
        ? 'Activo'
        : status === 'partial'
          ? 'Parcial'
          : 'Inactivo';
    return `Estado de actividad: ${label}`;
  }
  onSelectionChange(ids: (string | number)[]): void {
    this.selectionChange.emit(ids as number[]);
  }
}
