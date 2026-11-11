import { OposicionIdentidadComponent } from './oposicion-identidad.component';
import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { oposiciones } from '../../utils/consts';
import { GestionAlumno } from '../models/alumno-admin.model';
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
        ><ng-container *ngIf="perfil; else adminActions"
          ><p-menu
            #menu
            [popup]="true"
            [model]="acciones(s)"
            appendTo="body"
          ></p-menu
          ><button
            pButton
            type="button"
            class="alumno-link p-button-text"
            (click)="menu.toggle($event)"
            [attr.aria-label]="'Gestionar plan ' + planLabel(s.tipo)"
            aria-haspopup="menu"
          >
            Gestionar plan<i
              class="pi pi-angle-right"
              aria-hidden="true"
            ></i></button></ng-container
        ><ng-template #adminActions
          ><button
            pButton
            type="button"
            class="alumno-link p-button-text"
            *ngIf="gestion?.tipo === 'EXTERNA' && esExterna(s)"
            (click)="editarPlan.emit(s)"
            [disabled]="ocupado"
          >
            Editar plan</button
          ><button
            pButton
            *ngIf="esExterna(s); else wooAction"
            type="button"
            class="alumno-link p-button-text"
            [disabled]="ocupado || !vigente(s)"
            (click)="cancelar.emit(s)"
            [attr.data-testid]="'cancel-plan-' + s.id"
          >
            Cancelar este plan</button
          ><button
            pButton
            *ngIf="esExterna(s)"
            type="button"
            class="alumno-link alumno-plan-delete p-button-text p-button-danger"
            [disabled]="ocupado"
            (click)="eliminarPlan.emit(s)"
            [attr.data-testid]="'delete-plan-' + s.id"
          >
            Eliminar registro</button
          ><ng-template #wooAction
            ><button
              pButton
              type="button"
              class="alumno-link p-button-text"
              (click)="gestionarWoo.emit(s)"
            >
              Ver WooCommerce<i
                class="pi pi-arrow-right"
                aria-hidden="true"
              ></i></button></ng-template
        ></ng-template>
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
    return (
      ['ACTIVE', 'PENDING_CANCEL'].includes(s.status) &&
      (!s.fechaFin || new Date(s.fechaFin).getTime() > Date.now())
    );
  }
  trackId(_: number, s: Suscripcion) {
    return s.id;
  }
}
