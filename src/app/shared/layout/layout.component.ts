import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MenuItem } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ViewportService } from '../../services/viewport.service';
import { Usuario } from '../models/user.model';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  viewportService = inject(ViewportService);
  authService = inject(AuthService);
  router = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  userService = inject(UserService);
  toast = inject(ToastrService);
  items = [] as Array<any>;
  isMenuVisible: boolean = false;
  public decodedUser = this.authService.decodeToken() as Usuario;
  public selectedUser!: Usuario;
  public editDialogVisible = false;
  public async editProfile() {
    this.selectedUser = null as any;
    const foundUser = await firstValueFrom(
      this.userService.getByEmail$(this.decodedUser.email)
    );
    this.selectedUser = foundUser;
    this.editDialogVisible = true;
  }

  public confirmarCambios(usuarioActualizado: Usuario) {
    this.userService
      .updateUser(usuarioActualizado.id, {
        nombre: usuarioActualizado.nombre,
        apellidos: usuarioActualizado.apellidos,
        esTutor: usuarioActualizado.esTutor,
        tutorId: usuarioActualizado.tutorId,
      })
      .subscribe({
        next: () => {
          this.toast.success('Perfil actualizado correctamente');
          this.editDialogVisible = false;
          this.selectedUser = null as any;
        },
        error: () => {
          this.toast.error('No se pudo actualizar el perfil');
        },
      });
  }

  ngOnInit(): void {
    if (this.decodedUser.rol == 'ADMIN') {
      this.items = [
        {
          label: 'Gestión',
          collapsed: false,
          items: [
            {
              label: 'Usuarios',
              icon: 'pi pi-user',
              routerLink: '/app/test/user',
            },
            {
              label: 'Temas',
              icon: 'pi pi-book',
              routerLink: '/app/test/tema',
            },
          ],
        },
        {
          label: 'Planificación',
          items: [
            {
              label: 'Bloques',
              icon: 'pi pi-th-large',
              routerLink: '/app/planificacion/bloques',
            },
            {
              label: 'Plantillas semanales',
              icon: 'pi pi-sync',
              routerLink: '/app/planificacion/plantillas-semanales',
            },
            {
              label: 'Planificación mensual',
              icon: 'pi pi-calendar-plus',
              routerLink: '/app/planificacion/planificacion-mensual',
            },
          ],
        },
        {
          label: 'Preguntas',
          collapsed: true,
          items: [
            {
              label: 'Lista',
              icon: 'pi pi-question',
              routerLink: '/app/test/preguntas',
            },
            {
              label: 'Fallos reportados',
              icon: 'pi pi-flag-fill',
              routerLink: '/app/test/preguntas-fallos',
            },
            {
              label: 'Estadisticas',
              icon: 'pi pi-chart-pie',
              routerLink: '/app/test/test-stats',
            },
          ],
        },
        {
          label: 'Flash Cards',
          collapsed: true,
          items: [
            {
              label: 'Lista',
              icon: 'pi pi-id-card',
              routerLink: '/app/test/flashcards',
            },
            {
              label: 'Fallos reportados',
              icon: 'pi pi-flag-fill',
              routerLink: '/app/test/flashcards-fallos',
            },
            {
              label: 'Estadisticas',
              icon: 'pi pi-chart-pie',
              routerLink: '/app/test/flashcard-stats',
            },
          ],
        },
        {
          label: 'Perfil',
          items: [
            {
              label: 'Ajustes',
              icon: 'pi pi-cog',
              routerLink: '/app/test/ajustes',
            },

            {
              label: 'Desconectarse',
              icon: 'pi pi-sign-out',
              routerLink: '/auth',
            },
          ],
        },
      ];
    } else {
      this.items = [
        {
          label: 'Módulo de tests',
          items: [
            {
              label: 'Realizar tests',
              icon: 'pi pi-question',
              routerLink: '/app/test/alumno/realizar-test',
            },
            {
              label: 'Estadistica',
              icon: 'pi pi-chart-pie',
              routerLink: '/app/test/alumno/test-stats',
            },
          ],
        },
        {
          label: 'Módulo de Flashcards',
          items: [
            {
              label: 'Realizar tests',
              icon: 'pi pi-id-card',
              routerLink: '/app/test/alumno/realizar-flash-cards-test',
            },
            {
              label: 'Estadistica',
              icon: 'pi pi-chart-pie',
              routerLink: '/app/test/alumno/flashcard-stats',
            },
          ],
        },
        {
          label: 'Perfil',
          items: [
            {
              label: 'Planificación mensual',
              icon: 'pi pi-calendar-plus',
              routerLink: '/app/planificacion/planificacion-mensual-alumno',
            },
            {
              label: 'Desconectarse',
              icon: 'pi pi-sign-out',
              routerLink: '/auth',
            },
          ],
        },
      ];
    }
  }

  public isParentCollapsed(itemChild: MenuItem) {
    const index = this.items.findIndex((parentItem) =>
      (parentItem?.items as Array<MenuItem>).find((e) => e == itemChild)
    );
    return !!this.items[index].collapsed;
  }

  toggleMenu(): void {
    this.isMenuVisible = !this.isMenuVisible; // Alterna la visibilidad del menú
  }

  toggleCollapse(item: any): void {
    item.collapsed = !item.collapsed; // Alterna la visibilidad del submenú
  }
}
