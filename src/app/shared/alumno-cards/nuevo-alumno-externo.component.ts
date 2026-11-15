import { decodeJwtPayload } from '../utils/jwt.util';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AlumnoAdminService } from '../../services/alumno-admin.service';
import { PrimengModule } from '../primeng.module';
import {
  etiquetaAviso,
  mensajeErrorManual,
  ResultadoManual,
} from '../models/alumno-externo.model';

@Component({
  selector: 'app-nuevo-alumno-externo',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimengModule],
  styleUrls: ['./alumno-cards.scss', './gestion-externa.component.scss'],
  template: ` <button
      pButton
      type="button"
      class="alumno-btn"
      icon="pi pi-user-plus"
      (click)="abrir()"
      data-testid="nuevo-alumno-externo"
    >
      Nuevo alumno externo
    </button>
    <p-dialog
      header="Nuevo alumno externo"
      [(visible)]="visible"
      [modal]="true"
      [closable]="!ocupado"
      [closeOnEscape]="!ocupado"
      [draggable]="false"
      [style]="{ width: '32rem', maxWidth: '94vw' }"
    >
      <form (ngSubmit)="guardar()" #form="ngForm" *ngIf="!resultado">
        <p>
          La cuenta tendrá acceso local. Añade sus planes y productos desde su
          ficha.
        </p>
        <fieldset class="gestion-form" [disabled]="ocupado || incierta">
          <label
            >Nombre<input
              pInputText
              name="nombre"
              [(ngModel)]="nombre"
              required
              maxlength="150"
              autocomplete="given-name"
          /></label>
          <label
            >Apellidos<input
              pInputText
              name="apellidos"
              [(ngModel)]="apellidos"
              required
              maxlength="200"
              autocomplete="family-name"
          /></label>
          <label
            >Email<input
              pInputText
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              email
              maxlength="254"
              autocomplete="email"
          /></label>
          <label class="gestion-check"
            ><input type="checkbox" name="notificar" [(ngModel)]="notificar" />
            Enviar enlace de acceso por email</label
          >
        </fieldset>
        <p *ngIf="error" role="alert" class="gestion-error">{{ error }}</p>
        <button
          *ngIf="duplicadoId"
          pButton
          type="button"
          class="p-button-outlined"
          (click)="abrirFicha(duplicadoId)"
        >
          Abrir cuenta existente
        </button>
        <p *ngIf="incierta" role="status">
          El resultado está pendiente de comprobar. Se conserva la misma
          intención para evitar duplicar el alta.
        </p>
        <div class="gestion-actions">
          <button
            pButton
            type="button"
            class="p-button-outlined"
            (click)="visible = false"
            [disabled]="ocupado"
          >
            Cerrar
          </button>
          <button
            pButton
            *ngIf="incierta"
            type="button"
            (click)="comprobar()"
            [disabled]="ocupado"
          >
            Comprobar alta
          </button>
          <button
            pButton
            type="submit"
            [disabled]="ocupado || (!incierta && form.invalid)"
          >
            {{ incierta ? 'Reintentar la misma alta' : 'Crear alumno' }}
          </button>
        </div>
      </form>
      <div *ngIf="resultado as r" class="gestion-form">
        <p role="status">
          Cuenta local creada sin planes ni productos implícitos.
        </p>
        <p>{{ aviso(r.avisoEstado) }}</p>
        <ng-container *ngIf="r.enlaceAcceso; else enlacePerdido">
          <label
            >Enlace de un uso, válido una hora<input
              pInputText
              [value]="r.enlaceAcceso"
              readonly
              (focus)="$any($event.target).select()"
              data-testid="enlace-inicial"
          /></label>
          <p>Guárdalo antes de cerrar. Puedes generar otro desde la ficha.</p>
        </ng-container>
        <ng-template #enlacePerdido
          ><p>
            El alta se ha recuperado. Genera un nuevo enlace de acceso desde la
            ficha.
          </p></ng-template
        >
        <button pButton type="button" (click)="abrirFicha(r.usuarioId)">
          Abrir ficha del alumno
        </button>
      </div>
    </p-dialog>`,
})
export class NuevoAlumnoExternoComponent {
  private readonly api = inject(AlumnoAdminService);
  private readonly router = inject(Router);
  visible = false;
  ocupado = false;
  incierta = false;
  nombre = '';
  apellidos = '';
  email = '';
  notificar = false;
  error = '';
  duplicadoId = 0;
  resultado: ResultadoManual | null = null;
  clave = '';
  private solicitud: {
    nombre: string;
    apellidos: string;
    email: string;
    notificar: boolean;
  } | null = null;
  readonly aviso = etiquetaAviso;
  private get storageKey() {
    const actor =
      decodeJwtPayload(sessionStorage.getItem('authToken'))?.sub ||
      'sin-sesion';
    return `alta-externa-pendiente-${actor}`;
  }
  abrir() {
    if (this.resultado) {
      this.resultado = null;
      this.solicitud = null;
      this.clave = '';
      this.nombre = '';
      this.apellidos = '';
      this.email = '';
      this.notificar = false;
      this.incierta = false;
      this.error = '';
      this.duplicadoId = 0;
    }
    this.visible = true;
    const pendiente = sessionStorage.getItem(this.storageKey);
    if (pendiente && !this.clave) {
      try {
        const intento = JSON.parse(pendiente);
        this.clave = intento.clave;
        this.solicitud = intento.solicitud;
        Object.assign(this, intento.solicitud);
        this.incierta = true;
      } catch {
        this.error = 'No se ha podido recuperar la intención guardada.';
      }
    }
    if (!this.clave) this.clave = crypto.randomUUID();
  }
  async guardar() {
    if (this.ocupado) return;
    if (!this.solicitud) {
      if (this.incierta) {
        await this.comprobar();
        return;
      }
      this.solicitud = {
        nombre: this.nombre.trim(),
        apellidos: this.apellidos.trim(),
        email: this.email.trim().toLowerCase(),
        notificar: this.notificar,
      };
    }
    this.ocupado = true;
    this.error = '';
    this.duplicadoId = 0;
    sessionStorage.setItem(
      this.storageKey,
      JSON.stringify({ clave: this.clave, solicitud: this.solicitud }),
    );
    try {
      this.resultado = await firstValueFrom(
        this.api.accionManual('externos', 'POST', this.solicitud, this.clave),
      );
      this.incierta = false;
      sessionStorage.removeItem(this.storageKey);
    } catch (e: any) {
      this.error = mensajeErrorManual(e);
      this.incierta = !e.status || e.status >= 500;
      this.duplicadoId = e.status === 409 ? Number(e.error?.usuarioId) || 0 : 0;
      if (!this.incierta) {
        sessionStorage.removeItem(this.storageKey);
        this.solicitud = null;
        this.clave = crypto.randomUUID();
      }
    } finally {
      this.ocupado = false;
    }
  }
  async comprobar() {
    if (this.ocupado) return;
    this.ocupado = true;
    this.error = '';
    try {
      const op = await firstValueFrom(this.api.consultarAlta(this.clave));
      this.resultado = {
        usuarioId: op.usuarioId,
        operacionId: op.id,
        avisoEstado: op.avisoEstado || 'NO_SOLICITADO',
      };
      this.incierta = false;
      sessionStorage.removeItem(this.storageKey);
    } catch (e) {
      this.error = mensajeErrorManual(e);
    } finally {
      this.ocupado = false;
    }
  }
  abrirFicha(id: number) {
    this.visible = false;
    void this.router.navigate(['/app/test/user', id]);
  }
}
