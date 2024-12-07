import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { cloneDeep } from 'lodash';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { UserService } from '../../../services/user.service';
import { Usuario } from '../../../shared/models/user.model';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent extends SharedGridComponent<Usuario> {
  userService = inject(UserService);
  confirmationService = inject(ConfirmationService);
  authService = inject(AuthService);
  filterOptions: any[] = [
    { label: 'Pendientes', value: 'pendientes' },
    { label: 'Activos', value: 'activos' },
    { label: 'Todos', value: 'todos' },
  ];
  formControlFilterOptions = new FormControl(this.filterOptions[0].value);
  public filterType = signal<'pendientes' | 'activos' | 'todos'>('pendientes');
  editDialogVisible = false;
  selectedUser!: Usuario;
  public decodedUser = this.authService.decodeToken() as Usuario;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      const map = {
        pendientes: this.userService.getNonVerifiedUsers$(this.pagination()),
        activos: this.userService.getVerifiedUsers$(this.pagination()),
        todos: this.userService.getAllUsers$(this.pagination()),
      };
      return map[this.filterType()].pipe(
        tap((entry) => (this.lastLoadedPagination = entry))
      );
    });
    this.formControlFilterOptions.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((data) => this.filterType.set(data));
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
}
