import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipsModule } from 'primeng/chips';
import { DividerModule } from 'primeng/divider';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { paises, provinciasEspanolas } from '../../utils/consts';
import {
  duracionesDisponibles,
  nivelesDisponibles,
  NivelOposicion,
} from '../models/pregunta.model';
import { Oposicion } from '../models/subscription.model';
import { TipoDePlanificacionDeseada } from '../models/user.model';
import {
  PlanificacionPreferenciasComponent,
  PreferenciasPlanificacion,
} from '../planificacion-preferencias/planificacion-preferencias.component';

export interface OnboardingData {
  // Datos personales
  dni?: string;
  fechaNacimiento?: Date;
  nombreEmpresa?: string;
  paisRegion?: string;
  direccionCalle?: string;
  codigoPostal?: string;
  poblacion?: string;
  provincia?: string;
  telefono?: string;
  municipioResidencia?: string;

  // Formación y experiencia
  estudiosPrevaios?: string;
  actualTrabajoOcupacion?: string;
  hobbies?: string;
  descripcionSemana?: string;

  // Planificación de estudio
  horasEstudioDiaSemana?: number;
  horasEntrenoDiaSemana?: number;
  organizacionEstudioEntreno?: string;

  // Preparación de oposiciones
  temaPersonal?: string;
  oposicionesHechasResultados?: string;
  pruebasFisicas?: string;
  tecnicasEstudioUtilizadas?: string;

  // Objetivos
  objetivosSeisMeses?: string;
  objetivosUnAno?: string;

  // Experiencia con academias
  experienciaAcademias?: boolean;
  queValorasAcademia?: string;
  queMenosGustaAcademias?: string;
  queEsperasAcademia?: string;

  // Situación laboral
  trabajasActualmente?: string;
  agotamientoFisicoMental?: string;
  tiempoDedicableEstudio?: string;
  diasSemanaDisponibles?: string;
  otraInformacionLaboral?: string;

  // Comentarios adicionales
  comentariosAdicionales?: string;

  // Nuevos campos faltantes
  tipoOposicion?: Oposicion[];
  nivelOposicion?: NivelOposicion;
  tipoDePlanificacionDuracionDeseada?: TipoDePlanificacionDeseada;
}

@Component({
  selector: 'app-onboarding-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    CalendarModule,
    DropdownModule,
    MultiSelectModule,
    CheckboxModule,
    FloatLabelModule,
    DividerModule,
    CardModule,
    AccordionModule,
    InputNumberModule,
    InputTextareaModule,
    ChipsModule,
    BadgeModule,
    PlanificacionPreferenciasComponent,
  ],
  templateUrl: './onboarding-form.component.html',
  styleUrls: ['./onboarding-form.component.scss'],
})
export class OnboardingFormComponent implements OnInit, OnChanges {
  @Input() initialData?: OnboardingData;
  @Input() isOptional = true;
  @Input() showTitle = true;
  @Input() showSkipButton = true;
  @Output() dataSubmitted = new EventEmitter<OnboardingData>();
  @Output() skipped = new EventEmitter<void>();
  public today = new Date();

  private fb = inject(FormBuilder);

  formGroup!: FormGroup;

  provinciasEspanolas = provinciasEspanolas;

  paises = paises;

  duraciones = duracionesDisponibles;

  niveles = nivelesDisponibles;

  ngOnInit() {
    this.initializeForm();
    this.actualizarValoresInicialesPreferencias();
  }

  ngOnChanges() {
    if (this.initialData) {
      this.initializeForm();
      this.actualizarValoresInicialesPreferencias();
    }
  }

  /** Valores iniciales para el subcomponente compartido de preferencias.
   * Campo estable (no getter): un getter devuelve un objeto nuevo en cada
   * ciclo de CD y re-dispara ngOnChanges del subcomponente en bucle. */
  valoresInicialesPreferencias: PreferenciasPlanificacion = {
    oposicion: [],
    nivel: null,
    franja: null,
  };

  private actualizarValoresInicialesPreferencias(): void {
    this.valoresInicialesPreferencias = {
      oposicion: this.initialData?.tipoOposicion ?? [],
      nivel: this.initialData?.nivelOposicion ?? null,
      franja: this.initialData?.tipoDePlanificacionDuracionDeseada ?? null,
    };
  }

  /** Sincroniza los cambios del subcomponente con el formGroup del onboarding
   * (payload intacto: `tipoOposicion`, `nivelOposicion`,
   * `tipoDePlanificacionDuracionDeseada`). */
  onPreferenciasChange(prefs: PreferenciasPlanificacion): void {
    this.formGroup?.patchValue({
      tipoOposicion: Array.isArray(prefs.oposicion)
        ? prefs.oposicion
        : prefs.oposicion
          ? [prefs.oposicion]
          : [],
      nivelOposicion: (prefs.nivel as NivelOposicion) ?? null,
      tipoDePlanificacionDuracionDeseada:
        (prefs.franja as TipoDePlanificacionDeseada) ?? null,
    });
  }

  private initializeForm() {
    this.formGroup = this.fb.group({
      // Datos personales
      dni: [this.initialData?.dni || ''],
      fechaNacimiento: [this.initialData?.fechaNacimiento || null],
      nombreEmpresa: [this.initialData?.nombreEmpresa || ''],
      paisRegion: [this.initialData?.paisRegion || 'ES'],
      direccionCalle: [this.initialData?.direccionCalle || ''],
      codigoPostal: [this.initialData?.codigoPostal || ''],
      poblacion: [this.initialData?.poblacion || ''],
      provincia: [this.initialData?.provincia || ''],
      telefono: [this.initialData?.telefono || ''],
      municipioResidencia: [this.initialData?.municipioResidencia || ''],

      // Formación y experiencia
      estudiosPrevaios: [this.initialData?.estudiosPrevaios || ''],
      actualTrabajoOcupacion: [this.initialData?.actualTrabajoOcupacion || ''],
      hobbies: [this.initialData?.hobbies || ''],
      descripcionSemana: [this.initialData?.descripcionSemana || ''],

      // Planificación de estudio
      horasEstudioDiaSemana: [this.initialData?.horasEstudioDiaSemana || null],
      horasEntrenoDiaSemana: [this.initialData?.horasEntrenoDiaSemana || null],
      organizacionEstudioEntreno: [
        this.initialData?.organizacionEstudioEntreno || '',
      ],

      // Preparación de oposiciones
      temaPersonal: [this.initialData?.temaPersonal || ''],
      oposicionesHechasResultados: [
        this.initialData?.oposicionesHechasResultados || '',
      ],
      pruebasFisicas: [this.initialData?.pruebasFisicas || ''],
      tecnicasEstudioUtilizadas: [
        this.initialData?.tecnicasEstudioUtilizadas || '',
      ],

      // Objetivos
      objetivosSeisMeses: [this.initialData?.objetivosSeisMeses || ''],
      objetivosUnAno: [this.initialData?.objetivosUnAno || ''],

      // Experiencia con academias
      experienciaAcademias: [this.initialData?.experienciaAcademias || false],
      queValorasAcademia: [this.initialData?.queValorasAcademia || ''],
      queMenosGustaAcademias: [this.initialData?.queMenosGustaAcademias || ''],
      queEsperasAcademia: [this.initialData?.queEsperasAcademia || ''],

      // Situación laboral
      trabajasActualmente: [this.initialData?.trabajasActualmente || ''],
      agotamientoFisicoMental: [
        this.initialData?.agotamientoFisicoMental || '',
      ],
      tiempoDedicableEstudio: [this.initialData?.tiempoDedicableEstudio || ''],
      diasSemanaDisponibles: [this.initialData?.diasSemanaDisponibles || ''],
      otraInformacionLaboral: [this.initialData?.otraInformacionLaboral || ''],

      // Comentarios adicionales
      comentariosAdicionales: [this.initialData?.comentariosAdicionales || ''],

      // Campos de oposiciones y planificación
      tipoOposicion: [this.initialData?.tipoOposicion ?? []],
      nivelOposicion: [this.initialData?.nivelOposicion || null],
      tipoDePlanificacionDuracionDeseada: [
        this.initialData?.tipoDePlanificacionDuracionDeseada || null,
      ],
    });
  }

  onSubmit() {
    if (this.formGroup.valid) {
      const formData = this.formGroup.value;
      this.dataSubmitted.emit(formData);
    }
  }

  onSkip() {
    this.skipped.emit();
  }

  getCompletionPercentage(): number {
    const values = Object.values(this.formGroup.value);
    const filledFields = values.filter(
      (value) =>
        value !== null &&
        value !== '' &&
        value !== false &&
        !this.isEmptyArray(value),
    ).length;
    return Math.round((filledFields / values.length) * 100);
  }

  private isEmptyArray(value: any): boolean {
    return Array.isArray(value) && value.length === 0;
  }

  isFormPartiallyFilled(): boolean {
    return this.getCompletionPercentage() > 0;
  }

  private obtainSectionFields(section: string): string[] {
    const sectionFields: { [key: string]: string[] } = {
      'datos-principales': [
        'tipoOposicion',
        'nivelOposicion',
        'tipoDePlanificacionDuracionDeseada',
      ],
      'datos-personales': [
        'dni',
        'fechaNacimiento',
        'nombreEmpresa',
        'paisRegion',
        'direccionCalle',
        'codigoPostal',
        'poblacion',
        'provincia',
        'telefono',
        'municipioResidencia',
      ],
      'formacion-experiencia': [
        'estudiosPrevaios',
        'actualTrabajoOcupacion',
        'hobbies',
        'descripcionSemana',
      ],
      'planificacion-estudio': [
        'horasEstudioDiaSemana',
        'horasEntrenoDiaSemana',
        'organizacionEstudioEntreno',
      ],
      experiencia: [
        'temaPersonal',
        'oposicionesHechasResultados',
        'pruebasFisicas',
        'tecnicasEstudioUtilizadas',
      ],
      objetivos: ['objetivosSeisMeses', 'objetivosUnAno'],
      academia: [
        'experienciaAcademias',
        'queValorasAcademia',
        'queMenosGustaAcademias',
        'queEsperasAcademia',
      ],
      planificacion: [
        'trabajasActualmente',
        'agotamientoFisicoMental',
        'tiempoDedicableEstudio',
        'diasSemanaDisponibles',
        'otraInformacionLaboral',
      ],
      comentarios: ['comentariosAdicionales'],
    };
    return sectionFields[section] || [];
  }

  getEmptyFieldsCount(section: string): number {
    const sectionFields = this.obtainSectionFields(section);
    const fields = sectionFields || [];
    return fields.filter((field) => {
      const value = this.formGroup.get(field)?.value;
      return (
        value === null ||
        value === '' ||
        value === false ||
        value === undefined ||
        this.isEmptyArray(value)
      );
    }).length;
  }

  getSectionBadgeConfig(section: string): { severity: any; value: string } {
    const emptyCount = this.getEmptyFieldsCount(section);
    const sectionFields = this.obtainSectionFields(section);
    const totalFields = sectionFields?.length || 0;
    const completionPercentage =
      totalFields > 0 ? ((totalFields - emptyCount) / totalFields) * 100 : 0;

    if (emptyCount === 0) {
      return { severity: 'success', value: 'Completo' };
    } else if (completionPercentage >= 75) {
      return { severity: 'info', value: `${emptyCount} pendientes` };
    } else if (completionPercentage >= 50) {
      return { severity: 'warning', value: `${emptyCount} pendientes` };
    } else {
      return { severity: 'danger', value: `${emptyCount} pendientes` };
    }
  }
}
