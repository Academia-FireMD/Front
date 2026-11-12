import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UsuarioVistaAlumno } from '../models/alumno-admin.model';
import { AlumnoDatosComponent } from './alumno-datos.component';
type CampoAlumno = {
  key: keyof UsuarioVistaAlumno;
  label: string;
  fecha?: boolean;
};
@Component({
  selector: 'app-alumno-informacion',
  standalone: true,
  imports: [ButtonModule, CommonModule, AlumnoDatosComponent],
  styleUrls: ['./alumno-cards.scss'],
  template: ` <article *ngIf="resumen; else completa" class="alumno-card">
      <div class="alumno-card-head">
        <div>
          <h2>Información personal</h2>
        </div>
      </div>
      <p class="alumno-card-intro">Ayúdanos a adaptar tu preparación.</p>
      <div class="alumno-card-body">
        <div class="alumno-completion">
          <strong>{{ porcentaje }} % completado</strong
          ><span
            class="alumno-badge"
            [class.green]="porcentaje === 100"
            [class.brand]="porcentaje < 100"
            >{{
              porcentaje === 100 ? 'Información completa' : 'Por completar'
            }}</span
          >
        </div>
        <div
          class="alumno-progress"
          role="progressbar"
          aria-label="Información personal completada"
          [attr.aria-valuenow]="porcentaje"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span [style.width.%]="porcentaje"></span>
        </div>
        <p class="alumno-copy">
          Tu formación, disponibilidad y objetivos ayudan al tutor a organizar
          el seguimiento.
        </p>
        <button
          pButton
          type="button"
          class="alumno-btn full p-button-outlined"
          (click)="completar.emit()"
        >
          <i class="pi pi-pencil" aria-hidden="true"></i>Completar información
        </button>
      </div>
    </article>
    <ng-template #completa
      ><div class="alumno-info-grid">
        <app-alumno-datos
          [usuario]="usuario"
          (editar)="editarDatos.emit()"
        ></app-alumno-datos>
        <article class="alumno-card" *ngFor="let grupo of grupos">
          <div class="alumno-card-head">
            <div>
              <h2>{{ grupo.titulo }}</h2>
            </div>
          </div>
          <p class="alumno-card-intro">{{ grupo.descripcion }}</p>
          <div class="alumno-card-body">
            <dl class="alumno-info-fields">
              <div *ngFor="let campo of grupo.campos">
                <dt>{{ campo.label }}</dt>
                <dd>{{ valor(campo) }}</dd>
              </div>
            </dl>
          </div>
        </article>
      </div></ng-template
    >`,
})
export class AlumnoInformacionComponent {
  @Input({ required: true }) usuario!: UsuarioVistaAlumno;
  @Input() resumen = false;
  @Input() completitud = 0;
  @Output() completar = new EventEmitter<void>();
  @Output() editarDatos = new EventEmitter<void>();
  get porcentaje() {
    return Math.max(0, Math.min(100, Number(this.completitud) || 0));
  }
  readonly grupos: {
    titulo: string;
    descripcion: string;
    campos: CampoAlumno[];
  }[] = [
    {
      titulo: 'Datos personales y contacto',
      descripcion: 'Información facilitada por el alumno.',
      campos: [
        { key: 'dni', label: 'DNI / NIE' },
        { key: 'fechaNacimiento', label: 'Fecha de nacimiento', fecha: true },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'direccionCalle', label: 'Domicilio' },
        { key: 'poblacion', label: 'Población' },
        { key: 'municipioResidencia', label: 'Municipio de residencia' },
        { key: 'provincia', label: 'Provincia' },
        { key: 'codigoPostal', label: 'Código postal' },
        { key: 'paisRegion', label: 'País' },
      ],
    },
    {
      titulo: 'Formación y experiencia',
      descripcion: 'Punto de partida de su preparación.',
      campos: [
        { key: 'estudiosPrevaios', label: 'Estudios previos' },
        { key: 'actualTrabajoOcupacion', label: 'Ocupación actual' },
        { key: 'nombreEmpresa', label: 'Empresa' },
        {
          key: 'oposicionesHechasResultados',
          label: 'Oposiciones y resultados',
        },
        { key: 'tecnicasEstudioUtilizadas', label: 'Técnicas de estudio' },
        { key: 'pruebasFisicas', label: 'Pruebas físicas' },
      ],
    },
    {
      titulo: 'Disponibilidad y organización',
      descripcion: 'Contexto para el seguimiento del tutor.',
      campos: [
        { key: 'diasSemanaDisponibles', label: 'Días disponibles' },
        { key: 'tiempoDedicableEstudio', label: 'Tiempo para estudiar' },
        { key: 'horasEstudioDiaSemana', label: 'Horas de estudio' },
        { key: 'horasEntrenoDiaSemana', label: 'Horas de entrenamiento' },
        { key: 'organizacionEstudioEntreno', label: 'Organización' },
        { key: 'descripcionSemana', label: 'Semana habitual' },
        { key: 'hobbies', label: 'Aficiones' },
      ],
    },
    {
      titulo: 'Preferencias de preparación',
      descripcion: 'Configuración facilitada por el alumno.',
      campos: [
        { key: 'tipoOposicion', label: 'Oposición' },
        { key: 'nivelOposicion', label: 'Nivel' },
        {
          key: 'tipoDePlanificacionDuracionDeseada',
          label: 'Duración de la planificación',
        },
      ],
    },
    {
      titulo: 'Objetivos',
      descripcion: 'Metas comunicadas por el alumno.',
      campos: [
        { key: 'objetivosSeisMeses', label: 'A seis meses' },
        { key: 'objetivosUnAno', label: 'A un año' },
      ],
    },
    {
      titulo: 'Academia y acompañamiento',
      descripcion: 'Preferencias y experiencia previa.',
      campos: [
        { key: 'experienciaAcademias', label: 'Experiencia en academias' },
        { key: 'queValorasAcademia', label: 'Qué valora' },
        { key: 'queMenosGustaAcademias', label: 'Qué le gusta menos' },
        { key: 'queEsperasAcademia', label: 'Qué espera de la academia' },
      ],
    },
    {
      titulo: 'Situación y comentarios',
      descripcion: 'Información adicional para el seguimiento.',
      campos: [
        { key: 'trabajasActualmente', label: 'Situación laboral' },
        {
          key: 'agotamientoFisicoMental',
          label: 'Agotamiento físico o mental',
        },
        {
          key: 'otraInformacionLaboral',
          label: 'Información laboral adicional',
        },
        { key: 'temaPersonal', label: 'Contexto personal' },
        { key: 'comentariosAdicionales', label: 'Comentarios adicionales' },
      ],
    },
  ];
  valor(campo: CampoAlumno): string {
    const value = this.usuario[campo.key];
    if (value === null || value === undefined || value === '')
      return 'No proporcionado';
    if (campo.fecha) {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime())
        ? 'No proporcionado'
        : date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });
    }
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value))
      return value.length ? value.join(', ') : 'No proporcionado';
    return String(value);
  }
}
