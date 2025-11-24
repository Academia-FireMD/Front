import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { environment } from '../../../environments/environment';
import {
  ProductoWooCommerce,
  SuscripcionManagementService,
} from '../../services/suscripcion-management.service';

@Component({
  selector: 'app-contratar-plan',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    ProgressSpinnerModule,
    RadioButtonModule,
  ],
  providers: [MessageService],
  templateUrl: './contratar-plan.component.html',
  styleUrls: ['./contratar-plan.component.scss'],
})
export class ContratarPlanComponent implements OnInit {
  @Output() cerrar = new EventEmitter<void>();

  cargandoPlanes = signal(true);
  planesDisponibles: ProductoWooCommerce[] = [];
  planSeleccionado: ProductoWooCommerce | null = null;

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.cargarPlanes();
  }

  cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.suscripcionService.obtenerPlanesDisponibles().subscribe({
      next: (planes) => {
        this.planesDisponibles = planes || [];
        this.cargandoPlanes.set(false);

        if (this.planesDisponibles.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Sin planes disponibles',
            detail: 'No hay planes disponibles en este momento. Por favor, intenta más tarde o contacta con soporte.',
            life: 5000,
          });
        }
      },
      error: (error) => {
        this.cargandoPlanes.set(false);
        console.error('Error al cargar planes:', error);

        let errorMessage = 'No se pudieron cargar los planes disponibles. ';

        if (error.error?.message) {
          errorMessage += error.error.message;
        } else if (error.status === 0) {
          errorMessage += 'Parece que hay un problema de conexión. Verifica tu internet e intenta de nuevo.';
        } else if (error.status >= 500) {
          errorMessage += 'Hay un problema en el servidor. Por favor, intenta más tarde.';
        } else {
          errorMessage += 'Por favor, intenta recargar o contacta con soporte.';
        }

        this.messageService.add({
          severity: 'error',
          summary: 'Error al cargar planes',
          detail: errorMessage,
          life: 8000,
        });
      },
    });
  }

  seleccionarPlan(plan: ProductoWooCommerce): void {
    this.planSeleccionado = plan;
  }

  irACheckout(): void {
    if (!this.planSeleccionado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Plan requerido',
        detail: 'Por favor selecciona un plan',
      });
      return;
    }

    if (!this.planSeleccionado.id) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'El plan seleccionado no tiene un ID válido. Por favor, selecciona otro plan o contacta con soporte.',
      });
      return;
    }

    try {
      // Validar que la URL de WooCommerce esté configurada
      if (!environment.wooCommerceUrl) {
        throw new Error('La URL de WooCommerce no está configurada');
      }

      // Construir la URL para añadir al carrito
      // WooCommerce puede redirigir al carrito usando diferentes métodos
      const cartUrl = `${environment.wooCommerceUrl}/cart/`;
      const checkoutUrl = `${environment.wooCommerceUrl}/checkout/`;

      // Construir URL que añade al carrito
      // Intentamos usar la URL del producto si está disponible (más confiable)
      let addToCartUrl: string;

      if (this.planSeleccionado.permalink) {
        // Usar permalink del producto con parámetro para redirigir al carrito
        addToCartUrl = `${this.planSeleccionado.permalink}?add-to-cart=${this.planSeleccionado.id}`;
      } else if (this.planSeleccionado.slug) {
        // Construir URL usando el slug
        addToCartUrl = `${environment.wooCommerceUrl}/${this.planSeleccionado.slug}/?add-to-cart=${this.planSeleccionado.id}`;
      } else {
        // Fallback: usar la página principal
        addToCartUrl = `${environment.wooCommerceUrl}/?add-to-cart=${this.planSeleccionado.id}&quantity=1`;
      }

      // Añadir parámetro para redirigir al carrito (si WooCommerce lo soporta)
      // Si no funciona, el usuario puede ir manualmente al carrito
      const addToCartWithRedirect = `${addToCartUrl}&redirect-to-cart=1`;

      // Abrir la URL que añade al carrito
      // WooCommerce debería redirigir al carrito automáticamente
      const newWindow = window.open(addToCartWithRedirect, '_blank');

      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Si el popup fue bloqueado, mostrar mensaje con instrucciones
        const message = `Tu navegador bloqueó la ventana. Por favor, copia este enlace y ábrelo: ${addToCartUrl}`;

        this.messageService.add({
          severity: 'warn',
          summary: 'Popup bloqueado',
          detail: message,
          life: 15000,
        });

        // Intentar copiar la URL
        if (navigator.clipboard) {
          navigator.clipboard.writeText(addToCartUrl).catch(() => {});
        }
      } else {
        this.messageService.add({
          severity: 'info',
          summary: 'Redirigiendo al carrito',
          detail: 'El producto se añadirá a tu carrito y serás redirigido automáticamente.',
          life: 4000,
        });
      }

      // Cerrar el modal después de un breve delay
      setTimeout(() => {
        this.cerrar.emit();
      }, 1000);
    } catch (error) {
      console.error('Error al redirigir al checkout:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error al redirigir',
        detail: 'No se pudo abrir el checkout. Por favor, intenta de nuevo o contacta con soporte.',
        life: 5000,
      });
    }
  }

  cancelar(): void {
    this.cerrar.emit();
  }

  formatPrice(price: string): string {
    return parseFloat(price).toFixed(2);
  }
}

