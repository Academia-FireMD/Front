import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ViewportService } from '../../services/viewport.service';
import { Usuario } from '../models/user.model';
import { firstValueFrom } from 'rxjs';

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
  isMenuExpanded: boolean = false;

  public selectedUser!: Usuario;
  public editDialogVisible = false;

  onMenuHover(expanded: boolean): void {
    if (this.viewportService.screenWidth !== 'xs') {
      this.isMenuExpanded = expanded;
    }
  }

  public getResponsiveWidth(expanded: boolean): string {

    switch (this.viewportService.screenWidth) {
      case 'xs':
        return '100%';
      case 'sm':
        return expanded ? '55%' : '85%';
      case 'md':
        return expanded ? '60%' : '90%';
      case 'lg':
        return expanded ? '70%' : '90%';
      case 'xl':
        return expanded ? '75%' : '90%';
      default:
        return expanded ? '80%' : '95%';
    }
  }

  handleMenuItemClick(event: Event, item: MenuItem): void {
    event.preventDefault();
    event.stopPropagation();

    // Si estamos en mobile, cerrar el menú
    if (this.viewportService.screenWidth === 'xs') {
      this.isMenuVisible = false;
    }

    // Ejecutar el comando si existe
    if (item.command) {
      item.command({
        originalEvent: event,
        item: item
      });
    }
    // Si hay routerLink, navegar
    else if (item.routerLink) {
      this.router.navigate([item.routerLink], {
        queryParams: item.queryParams
      });
    }
  }

  public editProfile() {
    // Redirigir a la nueva página de perfil
    this.router.navigate(['/app/profile']);
    this.isMenuVisible = false;
  }

  public confirmarCambios(usuarioActualizado: Usuario) {
    this.userService
      .updateUser(usuarioActualizado.id, {
        nombre: usuarioActualizado.nombre,
        apellidos: usuarioActualizado.apellidos,
        esTutor: usuarioActualizado.esTutor,
        tutorId: usuarioActualizado.tutorId,
        tipoDePlanificacionDuracionDeseada:
          usuarioActualizado.tipoDePlanificacionDuracionDeseada,
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

  public navigateToPath(path: string) {
    this.router.navigate([path]);
    this.isMenuVisible = false;
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      if (user?.rol == 'ADMIN') {
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
                label: 'Modulos',
                icon: 'pi pi-book',
                routerLink: '/app/test/modulos',
              },
              {
                label: 'Temas',
                icon: 'pi pi-book',
                routerLink: '/app/test/tema',
              },
              {
                label: 'Documentos',
                icon: 'pi pi-file',
                routerLink: '/app/documentacion',
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
              {
                label: 'Comentarios',
                icon: 'fa fa-comment',
                routerLink: '/app/planificacion/comentarios',
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
            label: 'Exámenes',
            collapsed: false,
            items: [
              {
                label: 'Gestión de exámenes',
                icon: 'pi pi-file-edit',
                routerLink: '/app/examen',
              },
            ],
          },
          {
            label: 'Perfil',
            items: [
              {
                label: 'Mi Perfil',
                icon: 'pi pi-user',
                routerLink: '/app/profile',
              },
              {
                label: 'Ajustes',
                icon: 'pi pi-cog',
                routerLink: '/app/test/ajustes',
              },
              {
                label: 'Desconectarse',
                icon: 'pi pi-sign-out',
                  command: async () => {
                    await firstValueFrom(this.authService.logout$());
                    this.router.navigate(['/auth/login']);
                  },
              },
            ],
          },
        ];
      } else {
        this.items = [
          {
            label: 'Documentos',
            icon: 'pi pi-file',
            routerLink: '/app/documentacion/alumno',
            items: [],
          },
          {
            label: 'Test',
            items: [
              {
                label: 'Realizar tests',
                icon: 'pi pi-question',
                routerLink: '/app/test/alumno/realizar-test',
              },
              {
                label: 'Estadísticas test',
                icon: 'pi pi-chart-pie',
                routerLink: '/app/test/alumno/test-stats',
              },
            ],
          },
          {
            label: 'Flashcards',
            items: [
              {
                label: 'Realizar flashcards',
                icon: 'pi pi-id-card',
                routerLink: '/app/test/alumno/realizar-flash-cards-test',
              },
              {
                label: 'Estadísticas flashcards',
                icon: 'pi pi-chart-pie',
                routerLink: '/app/test/alumno/flashcard-stats',
              },
            ],
          },
          {
            label: 'Crea tu propio contenido',
            items: [
              {
                label: 'Test',
                icon: 'pi pi-question',
                routerLink: '/app/test/alumno/preguntas',
              },
              {
                label: 'Flashcards',
                icon: 'pi pi-id-card',
                routerLink: '/app/test/alumno/flashcards',
              },
            ],
          },
          {
            label: 'Planificación mensual',
            icon: 'pi pi-calendar-plus',
            routerLink: '/app/planificacion/planificacion-mensual-alumno',
            items: [],
          },
          {
            label: 'Exámenes',
            items: [
              {
                label: 'Exámenes disponibles',
                icon: 'pi pi-file',
                routerLink: '/app/examen/alumno',
              },
              {
                label: 'Exámenes realizados',
                icon: 'pi pi-check-circle',
                routerLink: '/app/examen/alumno/examenes-realizados',
              },
            ],
          },
          {
            label: 'Perfil',
            items: [
              {
                label: 'Mi Perfil',
                icon: 'pi pi-user',
                routerLink: '/app/profile',
              },
              {
                label: 'Ajustes',
                icon: 'pi pi-cog',
                routerLink: '/app/test/ajustes/alumno',
              },
              {
                label: 'Desconectarse',
                icon: 'pi pi-sign-out',
                command: async () => {
                  await firstValueFrom(this.authService.logout$());
                  this.router.navigate(['/auth/login']);
                },
              },
            ],
          },
        ];
      }
    });
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
