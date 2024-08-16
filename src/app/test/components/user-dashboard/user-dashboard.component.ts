import { Component, computed, inject, signal } from '@angular/core';
import { cloneDeep } from 'lodash';
import { Debounce } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { PaginatorState } from 'primeng/paginator';
import { firstValueFrom, tap } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { ViewportService } from '../../../services/viewport.service';
import {
  PaginatedResult,
  PaginationFilter,
} from '../../../shared/models/pagination.model';
import { Usuario } from '../../../shared/models/user.model';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrl: './user-dashboard.component.scss',
})
export class UserDashboardComponent {
  userService = inject(UserService);
  confirmationService = inject(ConfirmationService);
  toast = inject(ToastrService);
  viewportService = inject(ViewportService);
  public pagination = signal<PaginationFilter>({
    skip: 0,
    take: 10,
    searchTerm: '',
  });
  public lastLoadedPagination!: PaginatedResult<Usuario>;
  public getPendingUsers$ = computed(() => {
    return this.userService
      .getNonVerifiedUsers$(this.pagination())
      .pipe(tap((entry) => (this.lastLoadedPagination = entry)));
  });

  @Debounce(200)
  public valueChanged(event: any) {
    this.pagination.set({
      ...this.pagination(),
      searchTerm: event.srcElement.value,
    });
  }

  onPageChange(event: PaginatorState) {
    const page = event.page ?? 0;
    const rows = event.rows ?? 10;
    this.pagination.set({
      ...this.pagination(),
      skip: page * rows,
      take: rows,
    });
  }

  public denegar(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message:
        'Vas a eliminar la solicitud del usuario de acceso a la plataforma, estas seguro?',
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Si',
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
      'Usuario aprovado exitosamente, ahora puede comenzar a utilizar su cuenta.'
    );
    this.pagination.set(cloneDeep(this.pagination()));
  }
}
