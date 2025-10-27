import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, inject, input, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cloneDeep } from 'lodash';
import { Memoize } from 'lodash-decorators';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { PlanificacionesService } from '../../../services/planificaciones.service';
import { UserService } from '../../../services/user.service';
import { FilterConfig, GenericListComponent, GenericListMode } from '../../../shared/generic-list/generic-list.component';
import { Label, UsuarioLabel } from '../../../shared/models/label.model';
import { SuscripcionTipo } from '../../../shared/models/subscription.model';
import { Usuario } from '../../../shared/models/user.model';
import { PrimengModule } from '../../../shared/primeng.module';
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
    GenericListComponent
  ],
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss', './user-dashboard-onboarding.component.scss'],
})
export class UserDashboardComponent extends SharedGridComponent<Usuario> {
  userService = inject(UserService);
  planificacionesService = inject(PlanificacionesService);
  confirmationService = inject(ConfirmationService);
  authService = inject(AuthService);
  labelsService = inject(LabelsService);

  @Input() mode: GenericListMode = 'overview';
  @Input() selectedUserIds: number[] = [];
  extraFilters = input<FilterConfig[]>();
  @Output() selectionChange = new EventEmitter<number[]>();

  availableSubscriptions: any[] = [];
  editDialogVisible = false;
  subscriptionDialogVisible = false;
  selectedUser!: Usuario;
  selectedSubscriptionType = SuscripcionTipo.BASIC;
  public decodedUser = this.authService.decodeToken() as Usuario;

  // Etiquetas management
  labelsDialogVisible = false;
  availableLabels: Label[] = [];
  userLabels: UsuarioLabel[] = [];
  selectedLabelId: string = '';

  // Crear nueva etiqueta
  creatingNewLabel = false;
  newLabelKey = '';
  newLabelValue = '';

  // Nuevas propiedades para expansión
  expandedUserIds = new Set<number>();
  userPlanifications = new Map<number, any[]>();
  loadingPlanifications = new Set<number>();

  // Configuración de filtros para el GenericListComponent
  public filters = computed(() => {
    const baseFilters = [
      {
        key: 'createdAt',
        specialCaseKey: 'rangeDate',
        label: 'Rango de fechas',
        type: 'calendar',
        placeholder: 'Seleccionar rango de fechas',
        dateConfig: {
          selectionMode: 'range',
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
        filterInterpolation: (value) => {
          if (value === 'todas') return {};
          if (value === 'sin_suscripcion') {
            return { suscripcion: { is: null } };
          }
          return { suscripcion: { tipo: { equals: value } } };
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
      {
        key: 'labels',
        label: 'Etiquetas',
        type: 'multi-select',
        placeholder: 'Filtrar por etiquetas',
        options: this.availableLabels.map(label => ({
          label: `${label.key}${label.value ? ': ' + label.value : ''}`,
          value: label.id
        })),
        filterInterpolation: (value: string[]) => {
          if (!value || value.length === 0) return {};
          return {
            labels: {
              some: {
                labelId: {
                  in: value
                }
              }
            }
          };
        },
      },
    ] as FilterConfig[];
    return [...baseFilters, ...this.extraFilters() || []];
  });



  constructor() {
    super();
    this.loadAvailableSubscriptions();
    this.loadAvailableLabels();

    this.fetchItems$ = computed(() => {
      return this.userService.getAllUsers$(this.pagination()).pipe(
        tap((entry) => {
          this.lastLoadedPagination = entry;
        })
      );
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros usando el método seguro
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
        this.userService.getAvailableSubscriptions()
      );
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    }
  }

  getSubscriptionBadgeClass(suscripcion: any): string {
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

  getSubscriptionLabel(suscripcion: any): string {
    if (!suscripcion) return 'Sin suscripción';

    switch (suscripcion.tipo) {
      case SuscripcionTipo.BASIC:
        return 'Básica';
      case SuscripcionTipo.PREMIUM:
        return 'Premium';
      case SuscripcionTipo.ADVANCED:
        return 'Pro';
      default:
        return 'Sin suscripción';
    }
  }

  openSubscriptionDialog(user: Usuario) {
    this.selectedUser = { ...user };
    this.selectedSubscriptionType =
      user.suscripcion?.tipo || SuscripcionTipo.BASIC;
    this.subscriptionDialogVisible = true;
  }

  updateUserSubscription() {
    this.userService
      .updateUserSubscription(
        this.selectedUser.id,
        this.selectedSubscriptionType
      )
      .subscribe({
        next: () => {
          this.toast.success('Suscripción actualizada correctamente');
          this.subscriptionDialogVisible = false;
          this.selectedUser = null as any;
          this.refresh();
        },
        error: () => {
          this.toast.error('No se pudo actualizar la suscripción');
        },
      });
  }

  editarUsuario(user: Usuario) {
    this.selectedUser = { ...user }; // Copiar los datos del usuario para editar
    this.editDialogVisible = cloneDeep(true); // Mostrar el diálogo
  }

  // Etiquetas
  async loadAvailableLabels() {
    try {
      this.availableLabels = await firstValueFrom(this.labelsService.getLabels());
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
      this.toast.error('Error al cargar las etiquetas');
    }
  }

  async loadUserLabels(userId: number) {
    try {
      this.userLabels = await firstValueFrom(this.labelsService.getUserLabels(userId));
    } catch (e) {
      console.error('Error cargando etiquetas del usuario:', e);
    }
  }

  async assignSelectedLabelToUser() {
    if (!this.selectedUser || !this.selectedLabelId) return;
    try {
      await firstValueFrom(this.labelsService.assignLabelToUser(this.selectedUser.id, this.selectedLabelId));
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
      await firstValueFrom(this.labelsService.removeLabelFromUser(this.selectedUser.id, labelId));
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
          this.newLabelValue.trim() || undefined
        )
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

  public denegar(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message:
        'Vas a quitar el permiso de acceso a la plataforma del usuario, ¿estás seguro?',
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.userService.denegarUsuario(id));
        this.toast.info('Usuario denegado exitosamente');
        this.refresh();
      },
      reject: () => { },
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
      reject: () => { },
    });
  }

  public async permitir(id: number) {
    await firstValueFrom(this.userService.permitirUsuario(id));
    this.toast.info(
      'Usuario aprobado exitosamente, ahora puede comenzar a utilizar su cuenta.'
    );
    this.refresh();
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
    }
  }

  isUserExpanded(userId: number): boolean {
    return this.expandedUserIds.has(userId);
  }

  async loadUserPlanifications(userId: number) {
    this.loadingPlanifications.add(userId);
    try {
      const planifications = await firstValueFrom(this.userService.getUserPlanifications$(userId));
      this.userPlanifications.set(userId, planifications);
    } catch (error) {
      console.error('Error loading user planifications:', error);
      this.toast.error('Error al cargar planificaciones del usuario');
    } finally {
      this.loadingPlanifications.delete(userId);
    }
  }

  getUserPlanifications(userId: number): any[] {
    return this.userPlanifications.get(userId) || [];
  }

  isLoadingPlanifications(userId: number): boolean {
    return this.loadingPlanifications.has(userId);
  }

  async desvincularPlanificacion(planificationId: number, userId: number) {
    try {
      await firstValueFrom(this.planificacionesService.desvincularPlanificacionMensualAdmin$(planificationId, userId));
      this.toast.success('Planificación desvinculada correctamente');
      this.loadUserPlanifications(userId);
    } catch (error) {
      console.error('Error desvinculating planification:', error);
      this.toast.error('Error al desvincular planificación');
    }
  }

  verPlanificacion(planificationId: number) {
    this.router.navigate(['/app/planificacion/planificacion-mensual', planificationId]);
  }

  @Memoize()
  getActionItems(user: Usuario): MenuItem[] {
    const items: MenuItem[] = [];

    if (this.decodedUser.rol === 'ADMIN') {
      items.push({
        label: 'Acceder como usuario',
        icon: 'pi pi-user-edit',
        command: () => this.impersonateUser(user),
      });
    }

    items.push(
      {
        label: 'Suscripción',
        icon: 'pi pi-credit-card',
        command: () => this.openSubscriptionDialog(user),
      },
      {
        label: 'Gestionar etiquetas',
        icon: 'pi pi-tag',
        command: () => this.openLabelsDialog(user),
      },
      {
        label: user.validated ? 'Verificar' : 'Denegar',
        icon: user.validated ? 'pi pi-check' : 'pi pi-times',
        command: () => {
          const event = new MouseEvent('click');
          if (user.validated) {
            this.permitir(user.id);
          } else {
            this.denegar(user.id, event);
          }
        },
      },
      {
        label: 'Eliminar',
        icon: 'pi pi-trash',
        command: () => {
          const event = new MouseEvent('click');
          this.deleteUser(user.id, event);
        },
      }
    );

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
      user.comentariosAdicionales
    ];

    const filledFields = onboardingFields.filter(field =>
      field !== null &&
      field !== '' &&
      field !== false &&
      field !== undefined
    ).length;

    return Math.round((filledFields / onboardingFields.length) * 100);
  }

  // Método para impersonar usuario
  impersonateUser(user: Usuario) {
    this.authService.impersonateUser$(user.id).subscribe({
      next: (response) => {
        this.toast.success(`Ahora estás accediendo como ${user.nombre} ${user.apellidos}`);
        // Redirigir al dashboard principal para que vean la vista de alumno
        this.router.navigate(['/app/profile']);
      },
      error: (error) => {
        this.toast.error('Error al acceder como el usuario');
        console.error('Impersonation error:', error);
      }
    });
  }
}
