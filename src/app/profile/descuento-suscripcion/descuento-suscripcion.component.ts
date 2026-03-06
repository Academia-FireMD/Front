import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { CuponActivo, SuscripcionManagementService } from '../../services/suscripcion-management.service';

@Component({
  selector: 'app-descuento-suscripcion',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ProgressSpinnerModule,
    TagModule,
  ],
  templateUrl: './descuento-suscripcion.component.html',
  styleUrls: ['./descuento-suscripcion.component.scss'],
})
export class DescuentoSuscripcionComponent implements OnInit {
  @Input() suscripcionId!: number;
  @Output() cerrar = new EventEmitter<void>();
  @Output() descuentoCambiado = new EventEmitter<void>();

  cargando = signal(true);
  aplicando = signal(false);
  removiendo = signal<string | null>(null);
  mostrarConfirmacionRemover = signal(false);

  cuponesActivos: CuponActivo[] = [];
  codigoNuevo = '';
  cuponARemover: CuponActivo | null = null;
  feedbackMensaje = '';
  feedbackTipo: 'success' | 'error' | '' = '';

  constructor(
    private suscripcionService: SuscripcionManagementService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.cargarDetalle();
  }

  private cargarDetalle(): void {
    this.cargando.set(true);
    this.suscripcionService.obtenerDetalleSuscripcion(this.suscripcionId).subscribe({
      next: (detalle) => {
        this.cuponesActivos = detalle.cuponesActivos || [];
        this.cargando.set(false);
      },
      error: () => {
        this.cuponesActivos = [];
        this.cargando.set(false);
      },
    });
  }

  aplicarCupon(): void {
    const codigo = this.codigoNuevo.trim();
    if (!codigo) return;

    this.aplicando.set(true);
    this.limpiarFeedback();

    this.suscripcionService.aplicarDescuento(this.suscripcionId, codigo).subscribe({
      next: (res) => {
        this.aplicando.set(false);
        this.cuponesActivos = res.cuponesActivos;
        this.codigoNuevo = '';
        this.setFeedback('success', res.mensaje);
        this.descuentoCambiado.emit();
      },
      error: (e) => {
        this.aplicando.set(false);
        const msg = e.error?.message || 'El cupón no es válido o no se pudo aplicar.';
        this.setFeedback('error', msg);
      },
    });
  }

  confirmarRemoverCupon(cupon: CuponActivo): void {
    this.cuponARemover = cupon;
    this.mostrarConfirmacionRemover.set(true);
  }

  removerCupon(): void {
    if (!this.cuponARemover) return;
    const codigo = this.cuponARemover.code;
    this.mostrarConfirmacionRemover.set(false);
    this.removiendo.set(codigo);
    this.limpiarFeedback();

    this.suscripcionService.removerDescuento(this.suscripcionId, codigo).subscribe({
      next: (res) => {
        this.removiendo.set(null);
        this.cuponesActivos = res.cuponesActivos;
        this.cuponARemover = null;
        this.setFeedback('success', res.mensaje);
        this.descuentoCambiado.emit();
      },
      error: (e) => {
        this.removiendo.set(null);
        const msg = e.error?.message || 'No se pudo eliminar el cupón.';
        this.setFeedback('error', msg);
      },
    });
  }

  private setFeedback(tipo: 'success' | 'error', mensaje: string): void {
    this.feedbackTipo = tipo;
    this.feedbackMensaje = mensaje;
    setTimeout(() => this.limpiarFeedback(), 6000);
  }

  private limpiarFeedback(): void {
    this.feedbackMensaje = '';
    this.feedbackTipo = '';
  }

  getDescuentoLabel(cupon: CuponActivo): string {
    if (!cupon.discount) return cupon.code;
    const tipo = cupon.discountType === 'percent' ? '%' : '€';
    return `${cupon.discount}${tipo} dto.`;
  }

  cancelar(): void {
    this.cerrar.emit();
  }
}
