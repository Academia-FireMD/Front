import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

/**
 * Pantalla de módulo de planificación bloqueado. Reemplaza la antigua
 * expulsión a Perfil del `SubscriptionGuard`: el alumno sin Plan Avanzado o
 * Premium ve por qué no tiene acceso y un CTA para mejorar su tarifa
 * (reutiliza la vista de perfil/suscripción existente).
 */
@Component({
  selector: 'app-planificacion-bloqueada',
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-column align-items-center text-center py-6 px-4">
      <i class="pi pi-lock" style="font-size: 3rem" aria-hidden="true"></i>
      <h2 class="mt-3 mb-2">Planificación no disponible</h2>
      <p class="text-600 mb-1" style="max-width: 34rem">
        La planificación de estudio requiere disponer del
        <strong>Plan Avanzado</strong> o <strong>Premium</strong>.
      </p>
      <p class="text-600 mb-4" style="max-width: 34rem">
        Mejora tu tarifa para acceder a tu planificación personalizada de
        estudio.
      </p>
      <p-button
        label="Mejorar mi tarifa"
        icon="pi pi-arrow-up-right"
        (click)="irAMejorarTarifa()"
      ></p-button>
    </div>
  `,
})
export class PlanificacionBloqueadaComponent {
  constructor(private readonly router: Router) {}

  irAMejorarTarifa(): void {
    this.router.navigate(['/app/profile']);
  }
}
