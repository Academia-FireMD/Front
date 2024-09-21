import { Component, computed, inject } from '@angular/core';
import { cloneDeep } from 'lodash';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, tap } from 'rxjs';
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

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.userService
        .getNonVerifiedUsers$(this.pagination())
        .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
    });
  }

  public denegar(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message:
        'Vas a eliminar la solicitud del usuario de acceso a la plataforma, ¿estás seguro?',
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
        this.pagination.set(cloneDeep(this.pagination()));
      },
      reject: () => {},
    });
  }

  public async permitir(id: number) {
    await firstValueFrom(this.userService.permitirUsuario(id));
    this.toast.info(
      'Usuario aprobado exitosamente, ahora puede comenzar a utilizar su cuenta.'
    );
    this.pagination.set(cloneDeep(this.pagination()));
  }
}
