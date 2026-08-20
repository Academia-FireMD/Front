import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  inject,
  input,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cloneDeep } from 'lodash';
import { Memoize } from 'lodash-decorators';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { firstValueFrom, tap } from 'rxjs';
import { AppConfigService } from '../../../services/app-config.service';
import { AuthService } from '../../../services/auth.service';
import { PlanificacionesService } from '../../../services/planificaciones.service';
import { UserService } from '../../../services/user.service';
import { ModuloApp } from '../../../shared/models/modulo-app.enum';
import {
  MarcaPersonal,
  PlanificacionFisicaService,
} from '../../../planificacion-fisica/services/planificacion-fisica.service';
import {
  FilterConfig,
  GenericListComponent,
  GenericListMode,
} from '../../../shared/generic-list/generic-list.component';
import { Label, UsuarioLabel } from '../../../shared/models/label.model';
import {
  isSubscriptionAccessible,
  Oposicion,
  OPOSICION_LABELS,
  Suscripcion,
  SuscripcionStatus,
  SuscripcionTipo,
} from '../../../shared/models/subscription.model';
import { Rol, Usuario } from '../../../shared/models/user.model';
import { AutoasignacionService } from '../../../planificacion/services/autoasignacion.service';
import { PlanificacionPreferenciasComponent } from '../../../shared/planificacion-preferencias/planificacion-preferencias.component';
import type {
  AlumnoPlanificacionTutor,
  OpcionPlanificacionPermitida,
  PreferenciasPrecargadas,
} from '../../../planificacion/models/autoasignacion.model';
import {
  esCombinacionPublicada,
  normalizarPreferenciasPlanificacion,
  obtenerOpcionesCascadaPlanificacion,
} from '../../../planificacion/planificacion-opciones.util';
import { PrimengModule } from '../../../shared/primeng.module';
import {
  esAdminOSuperior,
  etiquetaRol,
  etiquetaRolCorta,
} from '../../../shared/utils/rol.utils';
import { LabelsService } from '../../../shared/services/labels.service';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { SharedModule } from '../../../shared/shared.module';

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    SharedModule,
    GenericListComponent,
    PlanificacionPreferenciasComponent,
    MessageModule,
  ],
  templateUrl: './user-dashboard.component.html',
  styleUrls: [
    './user-dashboard.component.scss',
    './user-dashboard-onboarding.component.scss',
  ],
})
export class UserDashboardComponent extends SharedGridComponent<Usuario> {
  userService = inject(UserService);
  planificacionesService = inject(PlanificacionesService);
  autoasignacionService = inject(AutoasignacionService);
  confirmationService = inject(ConfirmationService);
  authService = inject(AuthService);
  labelsService = inject(LabelsService);
  planificacionFisicaService = inject(PlanificacionFisicaService);
  appConfigService = inject(AppConfigService);

  /** Bridge física: el tab de marcas personales y su carga lazy solo están
   * disponibles cuando el módulo PLANIFICACION_FISICA está habilitado. */
  planificacionFisicaHabilitada = computed(
    () =>
      this.appConfigService.estadoModulos()[ModuloApp.PLANIFICACION_FISICA] !==
      false,
  );

  @Input() mode: GenericListMode = 'overview';
  @Input() singleSelection = false;
  @Input() selectedUserIds: number[] = [];
  extraFilters = input<FilterConfig[]>();
  @Output() selectionChange = new EventEmitter<number[]>();

  availableSubscriptions: any[] = [];
  editDialogVisible = false;
  subscriptionDialogVisible = false;
  selectedUser!: Usuario;
  selectedSubscriptionType = SuscripcionTipo.BASIC;
  selectedOposicion = Oposicion.VALENCIA_AYUNTAMIENTO;
  public decodedUser = this.authService.decodeToken() as Usuario;

  /** El usuario que mira el dashboard es admin o superior (incluye SUPERADMIN). */
  get viewerEsAdminOSuperior(): boolean {
    return esAdminOSuperior(this.decodedUser?.rol);
  }

  /** Clase del chip de rol para un usuario del listado. */
  chipRolClase(rol: Rol | string | null | undefined): string {
    return esAdminOSuperior(rol) ? 'admin-chip' : 'alumno-chip';
  }

  /** Etiqueta corta del chip de rol (Super / Admin / Alumno). */
  chipRolLabel(rol: Rol | string | null | undefined): string {
    return etiquetaRolCorta(rol);
  }

  /** Tooltip del chip de rol ("Usuario superadministrador", etc.). */
  chipRolTooltip(rol: Rol | string | null | undefined): string {
    return `Usuario ${etiquetaRol(rol).toLowerCase()}`;
  }

  // Opciones para selects de oposición
  oposicionOptions = Object.values(Oposicion)
    .map((op) => ({
      label: OPOSICION_LABELS[op] || op,
      value: op,
    }))
    .filter((op) => op.value !== Oposicion.GENERAL);

  subscriptionTypeOptions = [
    { label: 'Básica', value: SuscripcionTipo.BASIC },
    { label: 'Avanzada', value: SuscripcionTipo.ADVANCED },
    { label: 'Premium', value: SuscripcionTipo.PREMIUM },
  ];

  // Etiquetas management
  labelsDialogVisible = false;
  availableLabels: Label[] = [];
  userLabels: UsuarioLabel[] = [];
  selectedLabelId: string = '';

  creatingNewLabel = false;
  newLabelKey = '';
  newLabelValue = '';

  // Nuevas propiedades para expansión
  expandedUserIds = new Set<number>();
  userPlanifications = new Map<number, any[]>();
  loadingPlanifications = new Set<number>();
  userMarcas = new Map<number, MarcaPersonal[]>();
  loadingMarcas = new Set<number>();

  // Configuración de filtros para el GenericListComponent
  public filters = computed(() => {
    const baseFilters = [
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
          if (value === 'todos') return {};
          if (value === 'admin') {
            return {
              OR: [{ rol: { equals: 'ADMIN' } }, { esTutor: { equals: true } }],
            };
          }
          if (value === 'particulares') {
            return {
              AND: [
                { woocommerceCustomerId: { equals: null } },
                { rol: { equals: 'ALUMNO' } },
                { esTutor: { equals: false } },
              ],
            };
          }
          if (value === 'woocommerce') {
            return {
              woocommerceCustomerId: { not: null },
            };
          }
          return {};
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
        filterInterpolation: (value: string) => {
          if (value === 'todas') return {};
          if (value === 'sin_suscripcion') {
            return { suscripciones: { none: {} } };
          }
          return {
            suscripciones: {
              some: { tipo: { equals: value }, status: 'ACTIVE' },
            },
          };
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
        filterInterpolation: (value) => {
          if (value === 'todos') return {};
          return { validated: value };
        },
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
        filterInterpolation: (value) => {
          if (value === 'todos') return {};
          return { estadoActividad: value };
        },
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
        filterInterpolation: (value) => {
          if (value === 'todos') return {};
          return { rol: value };
        },
      },
    ] as FilterConfig[];
    return [...baseFilters, ...(this.extraFilters() || [])];
  });

  constructor() {
    super();
    this.loadAvailableSubscriptions();
    this.loadAvailableLabels();

    this.fetchItems$ = computed(() => {
      return this.userService.getAllUsers$(this.pagination()).pipe(
        tap((entry) => {
          this.lastLoadedPagination = entry;
        }),
      );
    });
  }

  public onFiltersChanged(where: any) {
    this.updatePaginationSafe({
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: Usuario) {
    this.editarUsuario(item);
  }

  public getUserId = (user: Usuario): number => user.id;

  public onSelectionChange(selectedIds: (string | number)[]) {
    this.selectionChange.emit(selectedIds as number[]);
  }

  async loadAvailableSubscriptions() {
    try {
      this.availableSubscriptions = await firstValueFrom(
        this.userService.getAvailableSubscriptions(),
      );
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  }

  getSubscriptionBadgeClass(
    suscripcion: Suscripcion | null | undefined,
  ): string {
    if (!suscripcion) return 'no-subscription-chip';

    switch (suscripcion.tipo) {
      case SuscripcionTipo.BASIC:
        return 'basic-chip';
      case SuscripcionTipo.PREMIUM:
        return 'premium-chip';
      case SuscripcionTipo.ADVANCED:
        return 'pro-chip';
      default:
        return 'no-subscription-chip';
    }
  }

  getSubscriptionLabel(suscripcion: Suscripcion | null | undefined): string {
    if (!suscripcion) return 'Sin suscripción';

    const tipoLabel =
      {
        [SuscripcionTipo.BASIC]: 'Básica',
        [SuscripcionTipo.ADVANCED]: 'Avanzada',
        [SuscripcionTipo.PREMIUM]: 'Premium',
      }[suscripcion.tipo] || suscripcion.tipo;

    const oposicionLabel =
      OPOSICION_LABELS[suscripcion.oposicion] || suscripcion.oposicion;
    return `${tipoLabel} - ${oposicionLabel}`;
  }

  getHighestSubscription(suscripciones?: Suscripcion[]): Suscripcion | null {
    if (!suscripciones || suscripciones.length === 0) return null;

    const activeSubs = suscripciones.filter((s) =>
      isSubscriptionAccessible(s.status),
    );
    if (activeSubs.length === 0) return null;

    const tierPriority: Record<SuscripcionTipo, number> = {
      [SuscripcionTipo.PREMIUM]: 3,
      [SuscripcionTipo.ADVANCED]: 2,
      [SuscripcionTipo.BASIC]: 1,
    };

    return activeSubs.reduce(
      (highest, sub) => {
        if (!highest) return sub;
        return (tierPriority[sub.tipo] || 0) > (tierPriority[highest.tipo] || 0)
          ? sub
          : highest;
      },
      null as Suscripcion | null,
    );
  }

  getActiveSuscripciones(user: Usuario): Suscripcion[] {
    return (user.suscripciones || []).filter((s) =>
      isSubscriptionAccessible(s.status),
    );
  }

  getUserStatus(user: Usuario): 'active' | 'partial' | 'inactive' {
    const hasActiveSub = user.suscripciones?.some((s) =>
      isSubscriptionAccessible(s.status),
    );
    if (hasActiveSub) return 'active';

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const hasActiveConsumible = user.consumibles?.some(
      (c) => c.estado === 'ACTIVADO',
    );
    const recentActivity =
      user.updatedAt && new Date(user.updatedAt) > thirtyDaysAgo;
    if (hasActiveConsumible || recentActivity) return 'partial';

    return 'inactive';
  }

  /**
   * Verifica si el usuario tiene al menos una suscripción ACTIVA gestionada por
   * WooCommerce (con `woocommerceSubscriptionId` real). NO basta con
   * `woocommerceCustomerId`, porque casos como Luis Moltó tienen el customerId
   * pero sus suscripciones activas son manuales (sin wooSubId) y se pueden
   * gestionar localmente.
   *
   * Refactor del antiguo `isWordPressUser` (Fase 1 plan 2026-05-11).
   */
  hasWooManagedSubscriptions(user: Usuario): boolean {
    return (
      user?.suscripciones?.some(
        (s) => s.status === 'ACTIVE' && !!s.woocommerceSubscriptionId,
      ) ?? false
    );
  }

  openSubscriptionDialog(user: Usuario) {
    if (this.hasWooManagedSubscriptions(user)) {
      this.toast.info(
        'Los usuarios de WordPress deben gestionar sus suscripciones desde su panel en la tienda.',
      );
      return;
    }
    this.selectedUser = { ...user };
    // Inicializar con la primera oposición disponible (que no tenga suscripción)
    this.selectedSubscriptionType = SuscripcionTipo.BASIC;
    this.selectedOposicion = this.getFirstAvailableOposicion();
    this.subscriptionDialogVisible = true;
  }

  /**
   * Verifica si ya existe una suscripción activa para la oposición seleccionada
   */
  hasSubscriptionForOposicion(oposicion: Oposicion): boolean {
    if (!this.selectedUser?.suscripciones) return false;
    return this.selectedUser.suscripciones.some(
      (s) => s.oposicion === oposicion && isSubscriptionAccessible(s.status),
    );
  }

  /**
   * Obtiene la primera oposición que no tiene suscripción activa
   */
  getFirstAvailableOposicion(): Oposicion {
    for (const op of Object.values(Oposicion)) {
      if (!this.hasSubscriptionForOposicion(op)) {
        return op;
      }
    }
    return Oposicion.VALENCIA_AYUNTAMIENTO;
  }

  /**
   * Verifica si se puede añadir la suscripción seleccionada
   */
  canAddSubscription(): boolean {
    return (
      this.selectedOposicion &&
      this.selectedSubscriptionType &&
      !this.hasSubscriptionForOposicion(this.selectedOposicion)
    );
  }

  updateUserSubscription() {
    if (this.hasSubscriptionForOposicion(this.selectedOposicion)) {
      this.toast.warning(
        'Ya existe una suscripción activa para esta oposición',
      );
      return;
    }

    this.userService
      .createUserSubscription(
        this.selectedUser.id,
        this.selectedSubscriptionType,
        this.selectedOposicion,
      )
      .subscribe({
        next: (response: any) => {
          this.toast.success('Suscripción añadida correctamente');
          if (response?.suscripciones) {
            this.selectedUser = {
              ...this.selectedUser,
              suscripciones: response.suscripciones,
            };
          } else if (response?.id) {
            // Si devuelve la suscripción creada, añadirla localmente
            const newSub: Suscripcion = response;
            this.selectedUser = {
              ...this.selectedUser,
              suscripciones: [
                ...(this.selectedUser.suscripciones || []),
                newSub,
              ],
            };
          }
          this.selectedOposicion = this.getFirstAvailableOposicion();
          this.refresh();
        },
        error: (err) => {
          const message =
            err?.error?.message || 'No se pudo añadir la suscripción';
          this.toast.error(message);
        },
      });
  }

  deleteSubscription(subscription: Suscripcion) {
    this.confirmationService.confirm({
      message: `¿Estás seguro de que deseas eliminar la suscripción "${this.getSubscriptionLabel(subscription)}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.userService
          .deleteUserSubscription(this.selectedUser.id, subscription.id)
          .subscribe({
            next: (updatedUser) => {
              this.toast.success('Suscripción eliminada correctamente');
              if (updatedUser?.suscripciones) {
                this.selectedUser = {
                  ...this.selectedUser,
                  suscripciones: updatedUser.suscripciones,
                };
              } else {
                // Si no devuelve las suscripciones, eliminarla localmente
                this.selectedUser = {
                  ...this.selectedUser,
                  suscripciones: (this.selectedUser.suscripciones || []).filter(
                    (s) => s.id !== subscription.id,
                  ),
                };
              }
              this.refresh();
            },
            error: (err) => {
              const message =
                err?.error?.message || 'No se pudo eliminar la suscripción';
              this.toast.error(message);
            },
          });
      },
    });
  }

  /**
   * Cancela una suscripción (status -> CANCELLED) sin borrarla. Conserva el
   * histórico. Si la suscripción tiene `woocommerceSubscriptionId`, el backend
   * cancela también en WooCommerce (D6 + 1A del plan 2026-05-11). Si WC falla,
   * el backend devuelve BadGateway y el toast muestra la instrucción del runbook.
   */
  cancelSubscription(subscription: Suscripcion) {
    this.confirmationService.confirm({
      message: `¿Cancelar la suscripción "${this.getSubscriptionLabel(subscription)}"? El usuario perderá el acceso pero el histórico se conserva.`,
      header: 'Cancelar suscripción',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cancelar',
      rejectLabel: 'No',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.userService.cancelUserSubscription(subscription.id).subscribe({
          next: (updatedSub: any) => {
            this.toast.success('Suscripción cancelada');
            // Actualizar localmente la sub para reflejar el cambio en el dialog
            if (this.selectedUser?.suscripciones) {
              this.selectedUser = {
                ...this.selectedUser,
                suscripciones: this.selectedUser.suscripciones.map((s) =>
                  s.id === subscription.id
                    ? {
                        ...s,
                        ...(updatedSub || {}),
                        status: 'CANCELLED' as SuscripcionStatus,
                      }
                    : s,
                ),
              };
            }
            this.refresh();
          },
          error: (err) => {
            const message = err?.error?.message || 'Error al cancelar';
            this.toast.error(message);
          },
        });
      },
    });
  }

  /**
   * Task C4 (feedback Raúl 2026-07-24): puente Date del `p-calendar` "Acceso a
   * clases grabadas desde" del diálogo de edición. El backend recibe string
   * ISO (o `null` para borrar el override) vía `POST /user/update/:id`.
   */
  editFechaClasesGrabadas: Date | null = null;

  editarUsuario(user: Usuario) {
    this.selectedUser = { ...user }; // Copiar los datos del usuario para editar
    this.editFechaClasesGrabadas = user.fechaAccesoClasesGrabadas
      ? new Date(user.fechaAccesoClasesGrabadas)
      : null;
    this.editDialogVisible = cloneDeep(true); // Mostrar el diálogo
  }

  // Etiquetas
  async loadAvailableLabels() {
    try {
      this.availableLabels = await firstValueFrom(
        this.labelsService.getLabels(),
      );
    } catch (e) {
      console.error('Error cargando etiquetas:', e);
    }
  }

  async openLabelsDialog(user: Usuario) {
    this.selectedUser = { ...user };
    this.creatingNewLabel = false;
    this.newLabelKey = '';
    this.newLabelValue = '';
    this.selectedLabelId = '';

    try {
      await this.loadAvailableLabels();
      await this.loadUserLabels(user.id);
      this.labelsDialogVisible = true;
    } catch (e) {
      console.error(e);
    }
  }

  async loadUserLabels(userId: number) {
    try {
      this.userLabels = await firstValueFrom(
        this.labelsService.getUserLabels(userId),
      );
    } catch (e) {
      console.error('Error cargando etiquetas del usuario:', e);
    }
  }

  async assignSelectedLabelToUser() {
    if (!this.selectedUser || !this.selectedLabelId) return;
    try {
      await firstValueFrom(
        this.labelsService.assignLabelToUser(
          this.selectedUser.id,
          this.selectedLabelId,
        ),
      );
      this.toast.success('Etiqueta asignada correctamente');
      this.selectedLabelId = '';
      await this.loadUserLabels(this.selectedUser.id);
      this.refresh(); // Refrescar la lista de usuarios para ver el chip
    } catch (e) {
      this.toast.error('No se pudo asignar la etiqueta');
    }
  }

  async removeUserLabel(labelId: string) {
    if (!this.selectedUser) return;
    try {
      await firstValueFrom(
        this.labelsService.removeLabelFromUser(this.selectedUser.id, labelId),
      );
      this.toast.success('Etiqueta eliminada correctamente');
      await this.loadUserLabels(this.selectedUser.id);
      this.refresh(); // Refrescar la lista de usuarios para ver el cambio
    } catch (e) {
      this.toast.error('No se pudo eliminar la etiqueta');
    }
  }

  async createAndAssignLabel() {
    if (!this.selectedUser || !this.newLabelKey.trim()) {
      this.toast.warning('La clave de la etiqueta es obligatoria');
      return;
    }

    try {
      await firstValueFrom(
        this.labelsService.assignLabelByKeyValue(
          this.selectedUser.id,
          this.newLabelKey.trim(),
          this.newLabelValue.trim() || undefined,
        ),
      );
      this.toast.success('Etiqueta creada y asignada correctamente');
      this.newLabelKey = '';
      this.newLabelValue = '';
      this.creatingNewLabel = false;
      await this.loadAvailableLabels();
      await this.loadUserLabels(this.selectedUser.id);
      this.refresh(); // Refrescar la lista de usuarios para ver el chip
    } catch (e) {
      this.toast.error('No se pudo crear y asignar la etiqueta');
    }
  }

  closeLabelsDialog() {
    this.labelsDialogVisible = false;
    this.creatingNewLabel = false;
    this.newLabelKey = '';
    this.newLabelValue = '';
    this.selectedLabelId = '';
  }

  confirmarCambios(modifiedUser: Usuario) {
    this.userService
      .updateUser(modifiedUser.id, {
        nombre: modifiedUser.nombre,
        apellidos: modifiedUser.apellidos,
        esTutor: modifiedUser.esTutor,
        // Task C4: override admin del corte de clases grabadas. Calendario
        // vacío → null explícito (borra el override).
        fechaAccesoClasesGrabadas: this.editFechaClasesGrabadas
          ? this.editFechaClasesGrabadas.toISOString()
          : null,
      })
      .subscribe({
        next: () => {
          this.toast.success('Usuario actualizado correctamente');
          this.editDialogVisible = false; // Cerrar el diálogo
          this.selectedUser = null as any;
          this.refresh();
        },
        error: () => {
          this.toast.error('No se pudo actualizar el usuario');
          this.refresh();
        },
      });
  }

  public deleteUser(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: 'Vas a eliminar el usuario de la plataforma, ¿estás seguro?',
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.userService.eliminarUsuario(id));
        this.toast.info('Usuario eliminado exitosamente');
        this.refresh();
      },
      reject: () => {},
    });
  }

  // Métodos para expansión de filas
  toggleUserExpansion(userId: number, event: Event) {
    event.stopPropagation();

    if (this.expandedUserIds.has(userId)) {
      this.expandedUserIds.delete(userId);
    } else {
      this.expandedUserIds.add(userId);
      if (!this.userPlanifications.has(userId)) {
        this.loadUserPlanifications(userId);
      }
      if (
        !this.userMarcas.has(userId) &&
        this.planificacionFisicaHabilitada()
      ) {
        this.loadUserMarcas(userId);
      }
    }
  }

  isUserExpanded(userId: number): boolean {
    return this.expandedUserIds.has(userId);
  }

  async loadUserPlanifications(userId: number) {
    this.loadingPlanifications.add(userId);
    try {
      const planifications = await firstValueFrom(
        this.userService.getUserPlanifications$(userId),
      );
      this.userPlanifications.set(userId, planifications);
    } catch (error) {
      console.error('Error loading user planifications:', error);
    } finally {
      this.loadingPlanifications.delete(userId);
    }
  }

  async loadUserMarcas(userId: number) {
    this.loadingMarcas.add(userId);
    try {
      const marcas = await firstValueFrom(
        this.planificacionFisicaService.marcasDeAlumno(userId),
      );
      this.userMarcas.set(userId, marcas);
    } catch (error) {
      console.error('Error loading user marcas:', error);
    } finally {
      this.loadingMarcas.delete(userId);
    }
  }

  getUserMarcas(userId: number): MarcaPersonal[] {
    return this.userMarcas.get(userId) || [];
  }

  isLoadingMarcas(userId: number): boolean {
    return this.loadingMarcas.has(userId);
  }

  getUserPlanifications(userId: number): any[] {
    return this.userPlanifications.get(userId) || [];
  }

  isLoadingPlanifications(userId: number): boolean {
    return this.loadingPlanifications.has(userId);
  }

  async desvincularPlanificacion(planificationId: number, userId: number) {
    try {
      await firstValueFrom(
        this.planificacionesService.desvincularPlanificacionMensualAdmin$(
          planificationId,
          userId,
        ),
      );
      this.toast.success('Planificación desvinculada correctamente');
      this.loadUserPlanifications(userId);
    } catch (error) {
      console.error('Error desvinculating planification:', error);
    }
  }

  verPlanificacion(planificationId: number) {
    this.router.navigate([
      '/app/planificacion/planificacion-mensual',
      planificationId,
    ]);
  }

  @Memoize()
  getActionItems(user: Usuario): MenuItem[] {
    const items: MenuItem[] = [];
    const hasWooSubs = this.hasWooManagedSubscriptions(user);

    if (esAdminOSuperior(this.decodedUser.rol)) {
      items.push({
        label: 'Acceder como usuario',
        icon: 'pi pi-user-edit',
        command: () => this.impersonateUser(user),
      });
    }

    items.push(
      {
        label: hasWooSubs ? 'Suscripción (WP)' : 'Suscripción',
        icon: hasWooSubs ? 'pi pi-lock' : 'pi pi-credit-card',
        disabled: hasWooSubs,
        command: () => this.openSubscriptionDialog(user),
        tooltipOptions: hasWooSubs
          ? {
              tooltipLabel:
                'Usuario de WordPress - gestiona sus suscripciones desde su panel',
            }
          : undefined,
      },
      {
        label: 'Gestionar etiquetas',
        icon: 'pi pi-tag',
        command: () => this.openLabelsDialog(user),
      },
    );

    // Fase 1 plan 2026-05-11: eliminados los ítems "Verificar/Dar de baja/Denegar".
    // El flujo de baja se hace ahora vía el botón "Suscripción" → Cancelar (Fase 2).
    items.push({
      label: 'Eliminar',
      icon: 'pi pi-trash',
      command: () => {
        const event = new MouseEvent('click');
        this.deleteUser(user.id, event);
      },
    });

    return items;
  }

  getOnboardingCompletionPercentage(user: Usuario): number {
    const onboardingFields = [
      user.tipoOposicion,
      user.nivelOposicion,
      user.tipoDePlanificacionDuracionDeseada,
      user.dni,
      user.fechaNacimiento,
      user.nombreEmpresa,
      user.paisRegion,
      user.direccionCalle,
      user.codigoPostal,
      user.poblacion,
      user.provincia,
      user.telefono,
      user.municipioResidencia,
      user.estudiosPrevaios,
      user.actualTrabajoOcupacion,
      user.hobbies,
      user.descripcionSemana,
      user.horasEstudioDiaSemana,
      user.horasEntrenoDiaSemana,
      user.organizacionEstudioEntreno,
      user.temaPersonal,
      user.oposicionesHechasResultados,
      user.pruebasFisicas,
      user.tecnicasEstudioUtilizadas,
      user.objetivosSeisMeses,
      user.objetivosUnAno,
      user.experienciaAcademias,
      user.queValorasAcademia,
      user.queMenosGustaAcademias,
      user.queEsperasAcademia,
      user.trabajasActualmente,
      user.agotamientoFisicoMental,
      user.tiempoDedicableEstudio,
      user.diasSemanaDisponibles,
      user.otraInformacionLaboral,
      user.comentariosAdicionales,
    ];

    const filledFields = onboardingFields.filter(
      (field) =>
        field !== null &&
        field !== '' &&
        field !== false &&
        field !== undefined &&
        !this.isEmptyArray(field),
    ).length;

    return Math.round((filledFields / onboardingFields.length) * 100);
  }

  private isEmptyArray(value: any): boolean {
    return Array.isArray(value) && value.length === 0;
  }

  formatTipoOposicion(ops?: Oposicion[]): string {
    if (!ops || ops.length === 0) {
      return 'No proporcionado';
    }
    return ops.map((o) => OPOSICION_LABELS[o] ?? o).join(', ');
  }

  impersonateUser(user: Usuario) {
    this.authService.impersonateUser$(user.id).subscribe({
      next: (response) => {
        this.toast.success(
          `Ahora estás accediendo como ${user.nombre} ${user.apellidos}`,
        );
        // Redirigir al dashboard principal para que vean la vista de alumno
        this.router.navigate(['/app/profile']);
      },
      error: (error) => {
        console.error('Impersonation error:', error);
      },
    });
  }

  // ---- Fase 1 autoasignación: acciones de tutor sobre la planificación ----

  /** Diálogo de "Cambiar planificación" (exige motivo). */
  tutorForzarDialog = false;
  tutorForzarUsuario: Usuario | null = null;
  tutorForzarConfiguracion: AlumnoPlanificacionTutor | null = null;
  tutorForzarPreferencias: PreferenciasPrecargadas = {
    oposicion: null,
    nivel: null,
    franja: null,
  };
  tutorForzarMotivo = '';
  tutorForzando = false;
  tutorForzarCargando = false;
  tutorForzarError: string | null = null;

  /** Diálogo de "Recomendar nivel". */
  tutorRecomendarDialog = false;
  tutorRecomendarUsuario: Usuario | null = null;
  tutorRecomendarNivel = 'INICIACION';
  tutorRecomendando = false;

  readonly tutorNivelOptions = [
    { label: 'Iniciación', value: 'INICIACION' },
    { label: 'Avanzado', value: 'AVANZADO' },
  ];

  get tutorForzarOpciones() {
    return obtenerOpcionesCascadaPlanificacion(
      this.tutorForzarConfiguracion?.opcionesPermitidas ?? [],
      this.tutorForzarPreferencias,
    );
  }

  get tutorForzarOposicionOptions() {
    return this.tutorForzarOpciones.oposiciones.map((oposicion) => ({
      label: OPOSICION_LABELS[oposicion] ?? oposicion,
      value: oposicion,
    }));
  }

  get tutorForzarNivelOptions() {
    return this.tutorForzarOpciones.niveles.map((nivel) => ({
      label: nivel === 'AVANZADO' ? 'Avanzado' : 'Iniciación',
      value: nivel,
    }));
  }

  get tutorForzarFranjaOptions() {
    return this.tutorForzarOpciones.franjas.map((franja) => ({
      label: franja === 'FRANJA_SEIS_A_OCHO_HORAS' ? '6-8 horas' : '4-6 horas',
      value: franja,
    }));
  }

  get tutorForzarOpcionSeleccionada(): OpcionPlanificacionPermitida | null {
    return this.tutorForzarOpciones.seleccionada;
  }

  get tutorPuedeForzarPlanificacion(): boolean {
    return Boolean(
      esCombinacionPublicada(this.tutorForzarOpcionSeleccionada) &&
      this.tutorForzarMotivo.trim(),
    );
  }

  abrirRecomendarNivel(user: Usuario): void {
    this.tutorRecomendarUsuario = { ...user };
    this.tutorRecomendarNivel = 'INICIACION';
    this.tutorRecomendarDialog = true;
  }

  async confirmarRecomendarNivel(): Promise<void> {
    if (!this.tutorRecomendarUsuario) return;
    this.tutorRecomendando = true;
    try {
      await firstValueFrom(
        this.autoasignacionService.recomendarNivelTutor$(
          this.tutorRecomendarUsuario.id,
          this.tutorRecomendarNivel as any,
        ),
      );
      this.toast.success('Nivel recomendado correctamente');
      this.tutorRecomendarDialog = false;
    } catch {
      this.toast.error('No se pudo recomendar el nivel');
    } finally {
      this.tutorRecomendando = false;
    }
  }

  async abrirForzarPlanificacion(user: Usuario): Promise<void> {
    this.tutorForzarUsuario = { ...user };
    this.tutorForzarConfiguracion = null;
    this.tutorForzarPreferencias = {
      oposicion: null,
      nivel: null,
      franja: null,
    };
    this.tutorForzarMotivo = '';
    this.tutorForzarError = null;
    this.tutorForzarDialog = true;
    this.tutorForzarCargando = true;
    try {
      const configuracion = await firstValueFrom(
        this.autoasignacionService.getAdminAlumnoConfiguracion$(user.id),
      );
      this.tutorForzarConfiguracion = configuracion;
      const activa = configuracion.configuracion?.variante;
      this.tutorForzarPreferencias = normalizarPreferenciasPlanificacion(
        configuracion.opcionesPermitidas,
        activa ?? configuracion.preferencias,
      );
    } catch {
      this.tutorForzarError =
        'No se pudo cargar la configuración de planificación del alumno.';
      this.toast.error(this.tutorForzarError);
    } finally {
      this.tutorForzarCargando = false;
    }
  }

  onTutorForzarPreferenciasChange(preferencias: {
    oposicion: Oposicion | Oposicion[] | null;
    nivel: string | null;
    franja: string | null;
  }): void {
    this.tutorForzarPreferencias = normalizarPreferenciasPlanificacion(
      this.tutorForzarConfiguracion?.opcionesPermitidas ?? [],
      {
        oposicion: Array.isArray(preferencias.oposicion)
          ? (preferencias.oposicion[0] ?? null)
          : preferencias.oposicion,
        nivel: preferencias.nivel as PreferenciasPrecargadas['nivel'],
        franja: preferencias.franja as PreferenciasPrecargadas['franja'],
      },
    );
  }

  async confirmarForzarPlanificacion(): Promise<void> {
    if (!this.tutorForzarUsuario) return;
    if (!this.tutorPuedeForzarPlanificacion) {
      this.toast.warning(
        this.tutorForzarMotivo.trim()
          ? 'La combinación seleccionada no tiene una planificación publicada.'
          : 'Selecciona una combinación publicada e indica el motivo.',
      );
      return;
    }
    this.tutorForzando = true;
    try {
      await firstValueFrom(
        this.autoasignacionService.forzarConfiguracionTutor$(
          this.tutorForzarUsuario.id,
          {
            oposicion: this.tutorForzarPreferencias.oposicion as Oposicion,
            nivel: this.tutorForzarPreferencias.nivel as any,
            franja: this.tutorForzarPreferencias.franja as string,
            motivo: this.tutorForzarMotivo.trim(),
          },
        ),
      );
      this.toast.success('Planificación cambiada correctamente');
      this.tutorForzarDialog = false;
    } catch {
      this.tutorForzarError = 'No se pudo cambiar la planificación';
      this.toast.error('No se pudo cambiar la planificación');
    } finally {
      this.tutorForzando = false;
    }
  }
}
