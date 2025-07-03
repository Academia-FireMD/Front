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

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent extends SharedGridComponent<Usuario> {
  userService = inject(UserService);
  confirmationService = inject(ConfirmationService);
  authService = inject(AuthService);

  subscriptionFilterOptions = [
    { label: 'Todas las suscripciones', value: 'todas' },
    { label: 'Sin suscripción', value: 'sin_suscripcion' },
    { label: 'Básica', value: SuscripcionTipo.BASIC },
    { label: 'Premium', value: SuscripcionTipo.PREMIUM },
    { label: 'Pro', value: SuscripcionTipo.PRO },
  ];

  availableSubscriptions: any[] = [];
  selectedSubscriptionFilter = new FormControl('todas');
  public subscriptionFilter = signal<string>('todas');

  editDialogVisible = false;
  subscriptionDialogVisible = false;
  selectedUser!: Usuario;
  selectedSubscriptionType = SuscripcionTipo.BASIC;
  public decodedUser = this.authService.decodeToken() as Usuario;

  constructor() {
    super();
    this.loadAvailableSubscriptions();

    this.fetchItems$ = computed(() => {
      const whereFilter = {
        ...this.pagination(),
        where: {
          ...this.pagination().where,
        },
      };

      // Aplicar filtro de suscripción
      if (this.subscriptionFilter() !== 'todas') {
        if (this.subscriptionFilter() === 'sin_suscripcion') {
          whereFilter.where.suscripcion = {
            is: null,
          };
        } else {
          whereFilter.where.suscripcion = {
            tipo: {
              equals: this.subscriptionFilter(),
            },
          };
        }
      }

      return this.userService.getAllUsers$(whereFilter).pipe(
        tap((entry) => {
          this.lastLoadedPagination = entry;
        })
      );
    });

    this.selectedSubscriptionFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((data) => {
        this.subscriptionFilter.set(data || 'todas');
        this.refresh(); // Forzar actualización cuando cambie el filtro
      });
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
    if (!suscripcion) return 'no-subscription';

    return `plan-type-${suscripcion.tipo.toLowerCase()}`;
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
