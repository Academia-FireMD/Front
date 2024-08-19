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
              label: 'Preguntas',
              icon: 'pi pi-question',
              routerLink: '/app/test/preguntas',
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
          label: 'Gestión',
          items: [
            {
              label: 'Realizar tests',
              icon: 'pi pi-question',
            },
          ],
        },
        {
          label: 'Perfil',
          items: [
            {
              label: 'Ajustes',
              icon: 'pi pi-cog',
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

  toggleMenu(): void {
    this.isMenuVisible = !this.isMenuVisible; // Alterna la visibilidad del menú
  }
}
