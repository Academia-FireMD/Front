import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-environment-badge',
  standalone: true,
  template: `
    @if (isStaging) {
      <div class="environment-badge" role="status">
        <i class="pi pi-info-circle" aria-hidden="true"></i>
        <strong>STAGING</strong>
        <span>Función en pruebas · No modifica producción</span>
      </div>
    }
  `,
  styles: [
    `
      .environment-badge {
        align-items: center;
        background: var(--orange-50, #fff7ed);
        border: 1px solid var(--orange-300, #fdba74);
        border-radius: var(--border-radius);
        color: var(--orange-900, #7c2d12);
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
        min-height: 44px;
        padding: 0.75rem 1rem;
      }

      @media (max-width: 575px) {
        .environment-badge {
          align-items: flex-start;
        }

        .environment-badge span {
          flex-basis: 100%;
        }
      }
    `,
  ],
})
export class EnvironmentBadgeComponent {
  readonly isStaging = String(environment.name) === 'staging';
}
