import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { cloneDeep } from 'lodash';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { Usuario } from '../../../shared/models/user.model';
import { SuscripcionTipo } from '../../../shared/models/subscription.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { Memoize } from 'lodash-decorators';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent extends SharedGridComponent<Usuario> {
  userService = inject(UserService);
  confirmationService = inject(ConfirmationService);
  authService = inject(AuthService);

  availableSubscriptions: any[] = [];
  editDialogVisible = false;
  subscriptionDialogVisible = false;
  selectedUser!: Usuario;
  selectedSubscriptionType = SuscripcionTipo.BASIC;
  public decodedUser = this.authService.decodeToken() as Usuario;

  // Configuración de filtros para el GenericListComponent
  public filters: FilterConfig[] = [
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
        { label: 'Pro', value: SuscripcionTipo.PRO },
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
  ];

  constructor() {
    super();
    this.loadAvailableSubscriptions();

    this.fetchItems$ = computed(() => {
      return this.userService.getAllUsers$(this.pagination()).pipe(
        tap((entry) => {
          this.lastLoadedPagination = entry;
        })
      );
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: Usuario) {
    this.editarUsuario(item);
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
      case SuscripcionTipo.PRO:
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
      case SuscripcionTipo.PRO:
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
      reject: () => {},
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

  public async permitir(id: number) {
    await firstValueFrom(this.userService.permitirUsuario(id));
    this.toast.info(
      'Usuario aprobado exitosamente, ahora puede comenzar a utilizar su cuenta.'
    );
    this.refresh();
  }
  @Memoize()
  getActionItems(user: Usuario): MenuItem[] {
    return [
      {
        label: 'Suscripción',
        icon: 'pi pi-credit-card',
        command: () => this.openSubscriptionDialog(user),
      },
      {
        label: 'Denegar',
        icon: 'pi pi-times',
        command: () => {
          const event = new MouseEvent('click');
          this.denegar(user.id, event);
        },
      },
      {
        label: 'Eliminar',
        icon: 'pi pi-trash',
        command: () => {
          const event = new MouseEvent('click');
          this.deleteUser(user.id, event);
        },
      },
    ];
  }
}
