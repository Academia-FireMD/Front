import { OposicionIdentidadComponent } from './oposicion-identidad.component';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { oposiciones } from '../../utils/consts';
import { GestionAlumno } from '../models/alumno-admin.model';
import { esSuscripcionVigente } from '../utils/membresia-externa.util';
import {
  getPlanLabel,
  getSubscriptionStatusLabel,
  OPOSICION_LABELS,
  Suscripcion,
} from '../models/subscription.model';
@Component({
  selector: 'app-alumno-suscripciones',
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    MenuModule,
    OposicionIdentidadComponent,
  ],
  styleUrls: ['./alumno-cards.scss'],
  template: ` <article class="alumno-card" data-testid="alumno-suscripciones">
    <div class="alumno-card-head">
      <div>
        <h2>{{ perfil ? 'Mis suscripciones' : 'Suscripciones del alumno' }}</h2>
      </div>
      <div class="alumno-card-tools">
        <ng-content select="[suscripciones-cabecera]"></ng-content
        ><span class="alumno-badge"
          >{{ suscripciones.length }}
          {{ suscripciones.length === 1 ? 'plan' : 'planes' }}</span
        >
      </div>
    </div>
    <p class="alumno-card-intro">
      {{
        perfil
          ? 'Tus planes y su estado de acceso.'
          : 'Cada plan se gestiona desde su origen.'
      }}
    </p>
    <div *ngIf="!suscripciones.length" class="alumno-card-body alumno-empty">
      <i class="pi pi-credit-card" aria-hidden="true"></i>
      <h3>Sin suscripción activa</h3>
      <p>No hay planes disponibles en este momento.</p>
    </div>
    <div
      *ngFor="let s of suscripciones; trackBy: trackId"
      class="alumno-plan-row"
      [attr.data-testid]="perfil ? 'profile-subscription' : null"
    >
      <div class="alumno-plan-main">
        <app-oposicion-identidad [oposiciones]="[s.oposicion]">
          <div class="alumno-plan-name">
            {{ oposicionLabel(s.oposicion) }}
            <span
              class="plan-badge"
              [ngClass]="'plan-' + s.tipo.toLowerCase()"
              >{{ planLabel(s.tipo) }}</span
            >
          </div>
        </app-oposicion-identidad>
        <div class="alumno-plan-meta">
          <span
            *ngIf="!perfil || s.fuenteGestion"
            class="alumno-badge"
            [class.brand]="
              perfil ? s.fuenteGestion === 'EXTERNA' : esExterna(s)
            "
            [class.blue]="
              perfil ? s.fuenteGestion === 'WOOCOMMERCE' : !esExterna(s)
            "
            >{{
              (perfil ? s.fuenteGestion === 'EXTERNA' : esExterna(s))
                ? 'Externa'
                : 'WooCommerce'
            }}</span
          ><span *ngIf="s.cancelacionProgramada"
            >Baja el {{ s.cancelacionProgramada | date: 'd MMM yyyy' }}</span
          ><span *ngIf="!s.cancelacionProgramada && s.fechaFin"
            >Acceso hasta {{ s.fechaFin | date: 'd MMM yyyy' }}</span
          ><span *ngIf="!s.cancelacionProgramada && !s.fechaFin"
            >Sin fecha de fin</span
          ><span *ngIf="s.monthlyPrice"
            >{{ s.monthlyPrice | currency: 'EUR' : 'symbol' : '1.2-2' }} /
            mes</span
          >
          <span *ngIf="s.fechaInicio"
            >Desde {{ s.fechaInicio | date: 'd MMM yyyy' }}</span
          >
        </div>
      </div>
      <div class="alumno-plan-side">
        <span
          class="alumno-badge"
          [class.green]="vigente(s) && !s.cancelacionProgramada && !s.fechaFin"
          [class.amber]="!vigente(s) || s.cancelacionProgramada || s.fechaFin"
          >{{
            s.cancelacionProgramada
              ? 'Baja programada'
              : vigente(s) && s.fechaFin
                ? 'Baja pendiente'
                : estadoLabel(s.status)
          }}</span
        >
        <ng-container *ngIf="!perfil || acciones(s).length">
          <p-menu
            #menu
            [popup]="true"
            [model]="perfil ? acciones(s) : accionesAdmin(s)"
            appendTo="body"
          ></p-menu>
          <button
            pButton
            type="button"
            class="p-button-text p-button-rounded p-button-icon-only"
            icon="pi pi-ellipsis-v"
            (click)="menu.toggle($event)"
            [disabled]="ocupado"
            [attr.aria-label]="
              'Acciones del plan ' +
              oposicionLabel(s.oposicion) +
              ' · ' +
              planLabel(s.tipo)
            "
            aria-haspopup="menu"
            [attr.aria-expanded]="menu.visible || false"
            [attr.aria-controls]="menu.id"
          ></button>
        </ng-container>
      </div>
    </div>
    <div class="alumno-card-foot" *ngIf="perfil">
      <ng-content select="[suscripciones-acciones]"></ng-content>
    </div>
  </article>`,
})
export class AlumnoSuscripcionesComponent {
  @Input() suscripciones: Suscripcion[] = [];
  @Input() perfil = false;
  @Input() ocupado = false;
  @Input() gestion: GestionAlumno | null = null;
  @Input() acciones: (s: Suscripcion) => MenuItem[] = () => [];
  @Output() editarPlan = new EventEmitter<Suscripcion>();
  @Output() cancelar = new EventEmitter<Suscripcion>();
  @Output() gestionarWoo = new EventEmitter<Suscripcion>();
  @Output() eliminarPlan = new EventEmitter<Suscripcion>();
  @Output() reactivarPlan = new EventEmitter<Suscripcion>();
  readonly catalogo = oposiciones;
  readonly planLabel = getPlanLabel;
  readonly estadoLabel = getSubscriptionStatusLabel;
  oposicionLabel(value: string) {
    return (OPOSICION_LABELS as Record<string, string>)[value] || value;
  }
  esExterna(s: Suscripcion) {
    return (
      this.gestion?.capacidades.suscripcionesExternas.includes(s.id) ?? false
    );
  }
  vigente(s: Suscripcion) {
    return esSuscripcionVigente(s);
  }
  accionesAdmin(s: Suscripcion): MenuItem[] {
    if (!this.esExterna(s)) {
      return [
        {
          label: 'Ver WooCommerce',
          icon: 'pi pi-external-link',
          disabled: this.ocupado,
          command: () => {
            if (!this.ocupado) this.gestionarWoo.emit(s);
          },
        },
      ];
    }
    const items: MenuItem[] = [];
    if (this.gestion?.tipo === 'EXTERNA') {
      items.push({
        label: this.vigente(s) ? 'Editar plan' : 'Reactivar plan',
        icon: 'pi pi-pencil',
        disabled: this.ocupado || s.status === 'PENDING_PAYMENT',
        command: () => {
          if (!this.ocupado && s.status !== 'PENDING_PAYMENT') {
            if (this.vigente(s)) this.editarPlan.emit(s);
            else this.reactivarPlan.emit(s);
          }
        },
      });
    }
    items.push(
      {
        label: 'Cancelar este plan',
        icon: 'pi pi-ban',
        disabled: this.ocupado || !this.vigente(s),
        command: () => {
          if (!this.ocupado && this.vigente(s)) this.cancelar.emit(s);
        },
      },
      { separator: true },
      {
        label: 'Eliminar registro',
        icon: 'pi pi-trash',
        disabled: this.ocupado || s.status !== 'CANCELLED',
        command: () => {
          if (!this.ocupado && s.status === 'CANCELLED')
            this.eliminarPlan.emit(s);
        },
      },
    );
    return items;
  }
  trackId(_: number, s: Suscripcion) {
    return s.id;
  }
}
