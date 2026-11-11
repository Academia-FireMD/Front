import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Oposicion } from '../models/subscription.model';
import { oposiciones as catalogo } from '../../utils/consts';

/** Identidad visual del contenido: nunca se deduce de la cuenta del alumno. */
@Component({
  selector: 'app-oposicion-identidad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oposicion-identidad">
      <div class="oposicion-escudos">
        <span
          *ngFor="let item of identidades; trackBy: trackCode"
          class="oposicion-escudo"
        >
          <img
            *ngIf="
              item.image && !imagenesFallidas.has(item.code);
              else fallback
            "
            [src]="item.image"
            [alt]="item.name"
            width="44"
            height="44"
            (error)="imagenesFallidas.add(item.code)"
          />
          <ng-template #fallback>
            <span role="img" [attr.aria-label]="item.name">
              <i class="pi pi-calendar" aria-hidden="true"></i>
            </span>
          </ng-template>
        </span>
      </div>
      <div class="oposicion-contenido"><ng-content></ng-content></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .oposicion-identidad {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        min-width: 0;
      }
      .oposicion-escudos {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        flex-shrink: 0;
        max-width: 104px;
      }
      .oposicion-escudo {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border: 1px solid var(--surface-border);
        border-radius: 10px;
        background: var(--surface-card);
      }
      img {
        width: 44px;
        height: 44px;
        object-fit: contain;
      }
      i {
        font-size: 20px;
        color: var(--primary-color);
      }
      .oposicion-contenido {
        min-width: 0;
        flex: 1;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class OposicionIdentidadComponent {
  @Input() oposiciones: readonly (Oposicion | string)[] | null | undefined = [];
  readonly imagenesFallidas = new Set<string>();
  trackCode(_: number, item: { code: string }) {
    return item.code;
  }
  get identidades() {
    const values = [...new Set(this.oposiciones || [])];
    return (values.length ? values : ['']).map((code) => ({
      code,
      image: catalogo[code as Oposicion]?.image || null,
      name: catalogo[code as Oposicion]?.name || code || 'Planificación',
    }));
  }
}
