import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ViewportService } from '../../services/viewport.service';

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
  items = [] as Array<any>;
  isMenuVisible: boolean = false;
  ngOnInit(): void {
    if (this.authService.decodeToken().rol == 'ADMIN') {
      this.items = [
        {
          label: 'Gestión',
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
          label: 'Preguntas',
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
          ],
        },
        {
          label: 'Flash Cards',
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
              routerLink: '/app/test/alumno/estadistica-dashboard',
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
              routerLink: '/app/test/alumno/estadistica-flashcards-dashboard',
            },
          ],
        },
        {
          label: 'Perfil',
          items: [
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

  toggleMenu(): void {
    this.isMenuVisible = !this.isMenuVisible; // Alterna la visibilidad del menú
  }
}
