import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UsuarioVistaAlumno } from '../models/alumno-admin.model';
import { etiquetaRol } from '../utils/rol.utils';
@Component({
  selector: 'app-alumno-datos',
  standalone: true,
  imports: [ButtonModule, CommonModule],
  styleUrls: ['./alumno-cards.scss'],
  template: ` <article class="alumno-card" data-testid="alumno-datos">
    <div class="alumno-card-head">
      <div>
        <h2>{{ perfil ? 'Mis datos' : 'Información principal' }}</h2>
        <p>
          {{
            perfil
              ? 'Mantén tu información al día.'
              : 'Identidad y configuración de la cuenta.'
          }}
        </p>
      </div>
      <button
        pButton
        type="button"
        class="alumno-link p-button-text"
        (click)="editar.emit()"
        data-testid="edit-alumno-datos"
      >
        <i class="pi pi-pencil" aria-hidden="true"></i>Editar
      </button>
    </div>
    <div class="alumno-card-body">
      <dl class="alumno-info-fields">
        <div>
          <dt>Nombre</dt>
          <dd>{{ usuario.nombre }} {{ usuario.apellidos }}</dd>
        </div>
        <div>
          <dt>{{ perfil ? 'DNI / NIE' : 'Email' }}</dt>
          <dd>
            {{ (perfil ? usuario.dni : usuario.email) || 'No proporcionado' }}
          </dd>
        </div>
        <div *ngIf="!perfil">
          <dt>Rol</dt>
          <dd>{{ rolLabel(usuario.rol) }}</dd>
        </div>
        <div>
          <dt>Tutor</dt>
          <dd>
            {{
              usuario.tutor
                ? usuario.tutor.nombre + ' ' + usuario.tutor.apellidos
                : usuario.tutorId
                  ? 'Tutor #' + usuario.tutorId
                  : 'Sin tutor asignado'
            }}
          </dd>
        </div>
        <div>
          <dt>Método de calificación</dt>
          <dd>{{ metodoLabel }}</dd>
        </div>
        <div *ngIf="!perfil">
          <dt>Acceso a clases grabadas desde</dt>
          <dd>
            {{
              usuario.fechaAccesoClasesGrabadas
                ? (usuario.fechaAccesoClasesGrabadas | date: 'd MMM yyyy')
                : 'Según su suscripción'
            }}
          </dd>
        </div>
      </dl>
    </div>
  </article>`,
})
export class AlumnoDatosComponent {
  @Input({ required: true }) usuario!: UsuarioVistaAlumno;
  @Input() perfil = false;
  @Output() editar = new EventEmitter<void>();
  readonly rolLabel = etiquetaRol;
  get metodoLabel() {
    return (
      (
        {
          A1_E1_3_B0: 'Un error resta un tercio',
          A1_E1_4_B0: 'Un error resta un cuarto',
          BASICO: 'Sin penalización',
        } as Record<string, string>
      )[this.usuario.metodoCalificacion] || 'Sin configurar'
    );
  }
}
