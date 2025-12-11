import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { MenuItem } from 'primeng/api';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ViewportService } from '../../services/viewport.service';
import { selectCurrentUser } from '../../store/user/user.selectors';
import { Suscripcion, SuscripcionStatus, SuscripcionTipo } from '../models/subscription.model';
import { Usuario } from '../models/user.model';

/**
 * Obtiene el nivel de suscripción más alto de un array de suscripciones
 * PREMIUM > ADVANCED > BASIC
 */
function getHighestSubscriptionTier(suscripciones?: Suscripcion[]): SuscripcionTipo | null {
  if (!suscripciones || suscripciones.length === 0) return null;

  const activeSubs = suscripciones.filter(s => s.status === SuscripcionStatus.ACTIVE);
  if (activeSubs.length === 0) return null;

  const tierPriority: Record<SuscripcionTipo, number> = {
    [SuscripcionTipo.PREMIUM]: 3,
    [SuscripcionTipo.ADVANCED]: 2,
    [SuscripcionTipo.BASIC]: 1,
  };

  return activeSubs.reduce((highest, sub) => {
    if (!highest) return sub.tipo;
    return (tierPriority[sub.tipo] || 0) > (tierPriority[highest] || 0) ? sub.tipo : highest;
  }, null as SuscripcionTipo | null);
}

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
  store = inject(Store);

  items = [] as Array<any>;
  isMenuVisible: boolean = false;
  isMenuExpanded: boolean = false;
  currentUser$: Observable<Usuario | null> =
    this.store.select(selectCurrentUser);

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
        item: item,
      });
    }
    // Si hay routerLink, navegar
    else if (item.routerLink) {
      this.router.navigate([item.routerLink], {
        queryParams: item.queryParams,
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
    this.currentUser$.subscribe((user) => {
      // Solo reconstruir el menú si tenemos un usuario válido
      if (!user) return;

      // Preservar el estado de colapso antes de reconstruir el menú
      const collapsedStates = this.items.reduce((acc, item, index) => {
        acc[index] = item.collapsed;
        return acc;
      }, {} as Record<number, boolean>);

      if (user?.rol == 'ADMIN') {
        this.items = this.getAdminMenu();
      } else {
        this.items = this.getStudentMenu(user);
      }

      // Restaurar el estado de colapso después de reconstruir el menú
      this.items.forEach((item, index) => {
        if (collapsedStates[index] !== undefined) {
          item.collapsed = collapsedStates[index];
        }
      });
    });
  }

  private getAdminMenu(): MenuItem[] {
    return [
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
          {
            label: 'Publicaciones',
            icon: 'pi pi-calendar',
            routerLink: '/app/documentacion/publicaciones',
          },
          {
            label: 'Tutorías',
            icon: 'pi pi-calendar',
            routerLink: '/app/horarios',
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
  }

  private getStudentMenu(user: Usuario | null): MenuItem[] {
    // Obtener el nivel más alto de todas las suscripciones activas
    const highestTier = getHighestSubscriptionTier(user?.suscripciones);
    const isBasic = highestTier === SuscripcionTipo.BASIC;
    const isAdvanced = highestTier === SuscripcionTipo.ADVANCED;
    const isPremium = highestTier === SuscripcionTipo.PREMIUM;
    const hasValidSubscription = isBasic || isAdvanced || isPremium;

    const menu: MenuItem[] = [];

    if (hasValidSubscription) {
      menu.push(
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
        }
      );
    }

    // Planificación mensual - disponible para ADVANCED y PREMIUM
    if (hasValidSubscription && (isAdvanced || isPremium)) {
      menu.push({
        label: 'Planificación mensual',
        icon: 'pi pi-calendar-plus',
        routerLink: '/app/planificacion/planificacion-mensual-alumno',
        items: [],
      });
    } else if (hasValidSubscription) {
      // Usuario BASIC - mostrar bloqueado
      menu.push({
        label: 'Planificación mensual',
        icon: 'pi pi-calendar-plus',
        items: [],
        styleClass: 'locked-menu-item',
        state: { locked: true },
        command: () => this.openUpgradePage(),
      });
    }

    // Exámenes - disponible para ADVANCED y PREMIUM
    if (hasValidSubscription && (isAdvanced || isPremium)) {
      menu.push({
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
      });
    } else if (hasValidSubscription) {
      // Usuario BASIC - mostrar bloqueado
      menu.push({
        label: 'Exámenes',
        items: [
          {
            label: 'Exámenes disponibles',
            icon: 'pi pi-file',
            styleClass: 'locked-menu-item',
            state: { locked: true },
            command: () => this.openUpgradePage(),
          },
          {
            label: 'Exámenes realizados',
            icon: 'pi pi-check-circle',
            styleClass: 'locked-menu-item',
            state: { locked: true },
            command: () => this.openUpgradePage(),
          },
        ],
      });
    }

    // Tutorías - disponible solo para alumnos con suscripción activa
    if (hasValidSubscription) {
      menu.push({
        label: 'Tutorías',
        icon: 'pi pi-calendar',
        routerLink: '/app/horarios/alumno',
        items: [],
      });
    }

    // Menú de perfil siempre disponible
    menu.push({
      label: 'Perfil',
      items: [
        {
          label: 'Mi Perfil',
          icon: 'pi pi-user',
          routerLink: '/app/profile',
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
    });

    return menu;
  }

  // Método para abrir la página de tarifas
  openUpgradePage(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }

  // Método para detener impersonación
  stopImpersonation() {
    this.authService.stopImpersonation$().subscribe({
      next: () => {
        this.toast.success('Has vuelto a tu cuenta de administrador');
        // Redirigir al dashboard de admin
        this.router.navigate(['/app/test/user-dashboard']);
      },
      error: (error) => {
        this.toast.error('Error al salir de la impersonación');
        console.error('Stop impersonation error:', error);
      },
    });
  }

  public isParentCollapsed(itemChild: MenuItem) {
    const index = this.items.findIndex((parentItem) =>
      parentItem?.items && (parentItem.items as Array<MenuItem>).find((e) => e == itemChild)
    );
    if (index === -1) {
      return false; // Si no se encuentra un padre, no está colapsado
    }
    return !!this.items[index]?.collapsed;
  }

  toggleMenu(): void {
    this.isMenuVisible = !this.isMenuVisible; // Alterna la visibilidad del menú
  }

  toggleCollapse(item: any): void {
    item.collapsed = !item.collapsed; // Alterna la visibilidad del submenú
  }
}
