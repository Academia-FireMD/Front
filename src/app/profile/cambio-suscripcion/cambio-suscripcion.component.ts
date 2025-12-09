import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { environment } from '../../../environments/environment';

/**
 * Componente simplificado para vincular cuenta con WordPress.
 * Solo se muestra a usuarios "en negro" que no están vinculados a WP.
 * Usuarios WP son redirigidos directamente a la tienda/mi-cuenta de WordPress.
 */
@Component({
  selector: 'app-cambio-suscripcion',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ProgressSpinnerModule,
    AccordionModule,
  ],
  templateUrl: './cambio-suscripcion.component.html',
  styleUrls: ['./cambio-suscripcion.component.scss'],
})
export class CambioSuscripcionComponent implements OnInit {
  @Output() cerrar = new EventEmitter<void>();
  @Output() solicitarVinculacion = new EventEmitter<void>();

  validandoPlazo = signal(false);
  
  // URLs de WordPress para el FAQ
  wordpressUrl = environment.wordpressUrl;
  wooCommerceUrl = environment.wooCommerceUrl;

  ngOnInit(): void {
    // No necesitamos validar plazo para vincular cuenta
    this.validandoPlazo.set(false);
  }

  vincularCuenta(): void {
    this.solicitarVinculacion.emit();
  }

  cancelar(): void {
    this.cerrar.emit();
  }
}
