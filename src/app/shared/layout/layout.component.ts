import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { MenuItem } from 'primeng/api';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { ViewportService } from '../../services/viewport.service';
import { selectCurrentUser } from '../../store/user/user.selectors';
import { EstadoModulos } from '../models/app-config.model';
import { ModuloApp } from '../models/modulo-app.enum';
import {
  Suscripcion,
  SuscripcionTipo,
  isSubscriptionAccessible,
} from '../models/subscription.model';
import { Rol, Usuario } from '../models/user.model';

/**
 * MenuItem PrimeNG extendido con metadata `modulo` (D11, §6.1).
 * Si presente, el item se oculta cuando el módulo está OFF (salvo SUPERADMIN).
 */
export interface AppMenuItem extends MenuItem {
  modulo?: ModuloApp;
  items?: AppMenuItem[];
}

/**
 * Fallback servido desde `public/` (mounted at root por angular.json).
 * El spec menciona `/assets/white_logo.png` pero el repo usa `public/`.
 */
const FALLBACK_LOGO = '/white_logo.png';

/**
 * Obtiene el nivel de suscripción más alto de un array de suscripciones
 * PREMIUM > ADVANCED > BASIC
 */
function getHighestSubscriptionTier(
  suscripciones?: Suscripcion[],
): SuscripcionTipo | null {
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
      if (!highest) return sub.tipo;
      return (tierPriority[sub.tipo] || 0) > (tierPriority[highest] || 0)
        ? sub.tipo
        : highest;
    },
    null as SuscripcionTipo | null,
  );
}

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  viewportService = inject(ViewportService);
  authService = inject(AuthService);
  appConfigService = inject(AppConfigService);
  router = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  userService = inject(UserService);
  toast = inject(ToastrService);
  store = inject(Store);

  readonly fallbackLogo = FALLBACK_LOGO;
  /** Snapshot del usuario actual para el computed `items` (D11). */
  private readonly currentUserSignal = signal<Usuario | null>(null);

  /**
   * Menu filtrado por módulos habilitados + rol (computed §6.1). Reacciona
   * a cambios en `estadoModulos` y al snapshot de usuario.
   */
  readonly items = computed<AppMenuItem[]>(() => {
    const user = this.currentUserSignal();
    if (!user) return [];
    const all =
      user.rol === Rol.ADMIN || user.rol === Rol.SUPERADMIN
        ? this.buildAdminMenu(user)
        : this.buildStudentMenu(user);
    const modulos = this.appConfigService.estadoModulos();
    const isSuper = user.rol === Rol.SUPERADMIN;
    return this.filterByModulo(all, modulos, isSuper);
  });

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
      if (!user) return;
      this.currentUserSignal.set(user);
    });
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src.endsWith(FALLBACK_LOGO)) return;
    img.src = FALLBACK_LOGO;
  }

  /**
   * Filtro recursivo D18: parent OFF → toda la rama oculta (top-down).
   * SUPERADMIN siempre ve todo (bypass). Submenús que quedan vacíos
   * se descartan para no mostrar headers huérfanos.
   */
  filterByModulo(
    items: AppMenuItem[],
    modulos: EstadoModulos,
    isSuperadmin: boolean,
  ): AppMenuItem[] {
    return items
      .filter((i) => isSuperadmin || !i.modulo || modulos[i.modulo] === true)
      .map((i) =>
        i.items
          ? {
              ...i,
              items: this.filterByModulo(
                i.items as AppMenuItem[],
                modulos,
                isSuperadmin,
              ),
            }
          : i,
      )
      .filter((i) => {
        // Descartar SOLO submenús de verdad vacíos (header sin destino). Un item con
        // routerLink/command es un ENLACE DIRECTO y se mantiene aunque tenga items:[].
        // Bug 2026-06-04: Documentos y Planificación (alumno) se definen con
        // routerLink + items:[] y el filtro anterior los borraba como "submenú vacío".
        const it = i as AppMenuItem;
        if (it.routerLink || it.command) return true;
        if (!Array.isArray(it.items)) return true;
        return (it.items?.length ?? 0) > 0;
      });
  }

  private buildAdminMenu(user: Usuario): AppMenuItem[] {
    const items: AppMenuItem[] = [
      {
        label: 'Gestión',
        collapsed: false,
        items: [
          {
            label: 'Usuarios',
            icon: 'pi pi-user',
            routerLink: '/app/test/user',
            modulo: ModuloApp.TEST,
          },
          {
            label: 'Modulos',
            icon: 'pi pi-book',
            routerLink: '/app/test/modulos',
            modulo: ModuloApp.TEST,
          },
          {
            label: 'Temas',
            icon: 'pi pi-book',
            routerLink: '/app/test/tema',
            modulo: ModuloApp.TEST,
          },
          {
            label: 'Documentos',
            icon: 'pi pi-file',
            routerLink: '/app/documentacion',
            modulo: ModuloApp.DOCUMENTACION,
          },
          {
            label: 'Publicaciones',
            icon: 'pi pi-calendar',
            routerLink: '/app/documentacion/publicaciones',
            modulo: ModuloApp.DOCUMENTACION,
          },
          {
            label: 'Tutorías',
            icon: 'pi pi-calendar',
            routerLink: '/app/horarios',
            modulo: ModuloApp.HORARIOS,
          },
          {
            label: 'Facturación',
            icon: 'pi pi-receipt',
            routerLink: '/app/facturacion',
            modulo: ModuloApp.FACTURACION,
          },
          {
            label: 'Cursos',
            icon: 'pi pi-graduation-cap',
            routerLink: '/app/cursos-admin',
            modulo: ModuloApp.CURSOS,
          },
          {
            label: 'Planificación física',
            icon: 'pi pi-bolt',
            routerLink: '/app/planificacion-fisica/admin',
            modulo: ModuloApp.PLANIFICACION_FISICA,
          },
        ],
      },
      {
        label: 'Planificación',
        modulo: ModuloApp.PLANIFICACION,
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
        modulo: ModuloApp.TEST,
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
        modulo: ModuloApp.FLASHCARDS,
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
        modulo: ModuloApp.EXAMEN,
        items: [
          {
            label: 'Gestión de exámenes',
            icon: 'pi pi-file-edit',
            routerLink: '/app/examen',
          },
        ],
      },
      // Cursos (admin) vive como subítem único dentro de "Gestión" → "Cursos"
      // (apunta al listado; "Crear curso" es un botón dentro del propio listado).
      // Antes era un grupo propio con "Lista de cursos" + "Crear curso".

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
            modulo: ModuloApp.TEST,
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

    if (user.rol === Rol.SUPERADMIN) {
      const configuracion = {
        label: 'Configuración',
        items: [
          {
            label: 'White-label',
            icon: 'pi pi-palette',
            routerLink: '/app/superadmin/config',
          },
        ],
      };
      // Insertar ANTES de "Perfil" (que contiene "Desconectarse"): la sección
      // SUPERADMIN no debe quedar por debajo del logout, sino por encima.
      const perfilIdx = items.findIndex((i) => i.label === 'Perfil');
      items.splice(perfilIdx >= 0 ? perfilIdx : items.length, 0, configuracion);
    }

    return items;
  }

  private buildStudentMenu(user: Usuario | null): AppMenuItem[] {
    const highestTier = getHighestSubscriptionTier(user?.suscripciones);
    const isBasic = highestTier === SuscripcionTipo.BASIC;
    const isAdvanced = highestTier === SuscripcionTipo.ADVANCED;
    const isPremium = highestTier === SuscripcionTipo.PREMIUM;
    const hasValidSubscription = isBasic || isAdvanced || isPremium;

    const menu: AppMenuItem[] = [];

    if (hasValidSubscription) {
      menu.push(
        {
          label: 'Documentos',
          icon: 'pi pi-file',
          routerLink: '/app/documentacion/alumno',
          modulo: ModuloApp.DOCUMENTACION,
        },
        {
          label: 'Test',
          modulo: ModuloApp.TEST,
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
          modulo: ModuloApp.FLASHCARDS,
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
              modulo: ModuloApp.TEST,
            },
            {
              label: 'Flashcards',
              icon: 'pi pi-id-card',
              routerLink: '/app/test/alumno/flashcards',
              modulo: ModuloApp.FLASHCARDS,
            },
          ],
        },
      );
    }

    // Planificación — agrupa estudio (mensual, ADVANCED/PREMIUM con candado
    // para BASIC) y pruebas físicas (el tier lo resuelve la vista con la
    // píldora de upsell). Cada hijo lleva su propio `modulo`: si el tenant
    // apaga ambos, filterByModulo poda el grupo vacío. Feedback Sergio
    // 2026-07-24.
    if (hasValidSubscription) {
      const hijoEstudio: AppMenuItem =
        isAdvanced || isPremium
          ? {
              label: 'Planificación de estudio',
              icon: 'pi pi-calendar-plus',
              routerLink: '/app/planificacion/planificacion-mensual-alumno',
              modulo: ModuloApp.PLANIFICACION,
            }
          : {
              label: 'Planificación de estudio',
              icon: 'pi pi-calendar-plus',
              modulo: ModuloApp.PLANIFICACION,
              styleClass: 'locked-menu-item',
              state: { locked: true },
              command: () => this.openUpgradePage(),
            };
      menu.push({
        label: 'Planificación',
        collapsed: true,
        items: [
          hijoEstudio,
          {
            label: 'Planificación pruebas físicas',
            icon: 'pi pi-bolt',
            routerLink: '/app/planificacion-fisica',
            modulo: ModuloApp.PLANIFICACION_FISICA,
          },
        ],
      });
    }

    // Exámenes - disponible para ADVANCED y PREMIUM
    if (hasValidSubscription && (isAdvanced || isPremium)) {
      menu.push({
        label: 'Exámenes',
        modulo: ModuloApp.EXAMEN,
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
        modulo: ModuloApp.EXAMEN,
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
        modulo: ModuloApp.HORARIOS,
      });
    }

    // Cursos — disponible para todos los alumnos con sub activa. Las
    // rutas alumno (/app/cursos = "Mis cursos", /app/cursos/catalogo)
    // existían pero no estaban en el menú; el alumno solo podía
    // llegar por URL directa. ModuloGuard se encarga del gating por
    // tenant.
    if (hasValidSubscription) {
      menu.push({
        label: 'Cursos',
        collapsed: true,
        modulo: ModuloApp.CURSOS,
        items: [
          {
            label: 'Mis cursos',
            icon: 'pi pi-book',
            routerLink: '/app/cursos',
          },
          {
            label: 'Clases grabadas',
            icon: 'pi pi-video',
            routerLink: '/app/clases-grabadas',
          },
          {
            label: 'Catálogo',
            icon: 'pi pi-th-large',
            routerLink: '/app/cursos/catalogo',
          },
        ],
      });
    }

    // Tienda de simulacros — disponible para todos los alumnos con sub activa.
    // El ModuloGuard se encarga del gating por tenant (módulo SIMULACROS).
    if (hasValidSubscription) {
      menu.push({
        label: 'Simulacros',
        icon: 'pi pi-file-edit',
        routerLink: '/app/simulacros-tienda',
        modulo: ModuloApp.SIMULACROS,
      });
    }

    // Callejero — práctica de calles de la oposición (mapa interactivo).
    // Enlace directo; ModuloGuard gatea por tenant (ModuloApp.CALLEJERO).
    if (hasValidSubscription) {
      menu.push({
        label: 'Callejero',
        icon: 'pi pi-map-marker',
        routerLink: '/app/callejero',
        modulo: ModuloApp.CALLEJERO,
      });
    }

    // Mis marcas — histórico de marcas personales del alumno (Fase 3:
    // visibilidad). Mismo gating por tenant que Planificación física; el
    // tier BASIC lo resuelve la propia vista con la píldora de upsell.
    // Mismo icono que el botón "Mis marcas" del calendario de física.
    if (hasValidSubscription) {
      menu.push({
        label: 'Mis marcas',
        icon: 'pi pi-chart-line',
        routerLink: '/app/planificacion-fisica/marcas',
        modulo: ModuloApp.PLANIFICACION_FISICA,
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

  openUpgradePage(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }

  stopImpersonation() {
    this.authService.stopImpersonation$().subscribe({
      next: () => {
        this.toast.success('Has vuelto a tu cuenta de administrador');
        // Redirigir al dashboard de admin
        this.router.navigate(['/app/test/user-dashboard']);
      },
      error: (error) => {
        console.error('Stop impersonation error:', error);
      },
    });
  }

  public isParentCollapsed(itemChild: MenuItem) {
    const all = this.items();
    const index = all.findIndex(
      (parentItem) =>
        parentItem?.items &&
        (parentItem.items as Array<MenuItem>).find((e) => e == itemChild),
    );
    if (index === -1) {
      return false;
    }
    return !!(all[index] as any)?.collapsed;
  }

  toggleMenu(): void {
    this.isMenuVisible = !this.isMenuVisible;
  }

  toggleCollapse(item: AppMenuItem): void {
    (item as any).collapsed = !(item as any).collapsed;
  }
}
