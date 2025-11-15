import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import {
  ProductoWooCommerce,
  SuscripcionManagementService,
  ValidacionPlazo,
} from '../../services/suscripcion-management.service';

@Component({
  selector: 'app-cambio-suscripcion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextareaModule,
    ProgressSpinnerModule,
    RadioButtonModule,
  ],
  providers: [MessageService],
  templateUrl: './cambio-suscripcion.component.html',
  styleUrls: ['./cambio-suscripcion.component.scss'],
})
export class CambioSuscripcionComponent implements OnInit {
  @Output() cerrar = new EventEmitter<void>();
  @Output() solicitarConfirmacion = new EventEmitter<any>();
  @Output() mostrarFueraDePlazo = new EventEmitter<any>();

  loading = signal(false);
  validandoPlazo = signal(true);
  cargandoPlanes = signal(true);
  procesandoCambio = signal(false);

  validacion: ValidacionPlazo | null = null;
  planesDisponibles: ProductoWooCommerce[] = [];
  planSeleccionado: ProductoWooCommerce | null = null;
  comentario: string = '';

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.validarPlazo();
    this.cargarPlanes();
  }

  validarPlazo(): void {
    this.validandoPlazo.set(true);
    this.suscripcionService.validarPlazo().subscribe({
      next: (result) => {
        this.validacion = result;
        this.validandoPlazo.set(false);
        if (!result.valido) {
          this.mostrarFueraDePlazo.emit(result);
        }
      },
      error: (error) => {
        this.validandoPlazo.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail:
            error.error?.message ||
            'No se pudo validar el plazo de modificación',
        });
        setTimeout(() => this.cerrar.emit(), 2000);
      },
    });
  }

  cargarPlanes(): void {
    this.cargandoPlanes.set(true);
    this.suscripcionService.obtenerPlanesDisponibles().subscribe({
      next: (planes) => {
        this.planesDisponibles = planes;
        this.cargandoPlanes.set(false);
      },
      error: (error) => {
        this.cargandoPlanes.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail:
            error.error?.message || 'No se pudieron cargar los planes disponibles',
        });
      },
    });
  }

  seleccionarPlan(plan: ProductoWooCommerce): void {
    this.planSeleccionado = plan;
  }

  abrirDialogConfirmacion(): void {
    if (!this.planSeleccionado) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Plan requerido',
        detail: 'Por favor selecciona un plan',
      });
      return;
    }
    this.solicitarConfirmacion.emit({
      planSeleccionado: this.planSeleccionado,
      comentario: this.comentario,
      validacion: this.validacion,
    });
  }

  confirmarCambio(datos: { planSeleccionado: ProductoWooCommerce; comentario: string }): void {
    if (!datos.planSeleccionado) return;

    this.procesandoCambio.set(true);
    this.suscripcionService
      .cambiarSuscripcion({
        nuevoSkuProducto: datos.planSeleccionado.sku,
        comentario: datos.comentario || undefined,
      })
      .subscribe({
        next: (response) => {
          this.procesandoCambio.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Cambio procesado',
            detail: response.mensaje,
            life: 5000,
          });
          setTimeout(() => this.cerrar.emit(), 2000);
        },
        error: (error) => {
          this.procesandoCambio.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail:
              error.error?.message ||
              'No se pudo procesar el cambio de suscripción',
          });
        },
      });
  }

  cancelar(): void {
    this.cerrar.emit();
  }

  formatPrice(price: string): string {
    return parseFloat(price).toFixed(2);
  }
}
