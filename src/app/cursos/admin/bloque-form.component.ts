import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnChanges,
  output,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { Dificultad } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { SharedModule } from '../../shared/shared.module';
import { Bloque, TipoBloque } from '../models/curso.model';
import { BunnyUploadComponent, UploadedEvent } from './bunny-upload.component';

/**
 * Formulario inline de UN bloque (widget de la lección). No es un diálogo: se
 * embebe dentro de `leccion-bloques-dialog`, que gestiona la pila. A diferencia
 * de la lección, un bloque NO tiene título ni orden propio (el orden lo da su
 * posición en la pila / drag-drop). Config por tipo:
 *  - VIDEO  → bunny-upload + duración.
 *  - TEXTO  → markdown.
 *  - TEST   → tema-select + nº preguntas + dificultad + modo repaso.
 * CUESTIONARIO (quiz inline propio) llega en Fase 2 → no creable aún.
 */
export interface BloqueFormResult {
  tipo: TipoBloque;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  contenidoMarkdown?: string;
  temaId?: number;
  numPreguntas?: number;
  dificultad?: Dificultad;
  esDeRepaso?: boolean;
}

interface DificultadOption {
  label: string;
  value: Dificultad | null;
}

@Component({
  selector: 'app-bloque-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    InputTextareaModule,
    CheckboxModule,
    BunnyUploadComponent,
    SharedModule,
  ],
  templateUrl: './bloque-form.component.html',
  styleUrl: './bloque-form.component.scss',
})
export class BloqueFormComponent implements OnChanges {
  /** Bloque a editar; null = creación. */
  readonly bloque = input<Bloque | null>(null);
  /** Oposición del curso, propagada al `<app-tema-select>` para filtrar temas. */
  readonly oposicion = input<Oposicion | null>(null);
  readonly saving = input<boolean>(false);

  readonly saved = output<BloqueFormResult>();
  readonly cancelled = output<void>();

  private fb = inject(FormBuilder);
  private toast = inject(ToastrService);

  // CUESTIONARIO se excluye: Fase 2. Solo VIDEO/TEXTO/TEST son creables ahora.
  readonly tipoOptions: { label: string; value: TipoBloque }[] = [
    { label: 'Vídeo', value: 'VIDEO' },
    { label: 'Texto', value: 'TEXTO' },
    { label: 'Test', value: 'TEST' },
  ];

  readonly dificultadOptions: DificultadOption[] = [
    { label: 'Todas las dificultades', value: null },
    { label: 'Básico', value: Dificultad.BASICO },
    { label: 'Intermedio', value: Dificultad.INTERMEDIO },
    { label: 'Difícil', value: Dificultad.DIFICIL },
  ];

  form = this.fb.group({
    tipo: this.fb.control<TipoBloque>('VIDEO', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    bunnyVideoId: [''],
    duracionSegundos: [null as number | null],
    contenidoMarkdown: [''],
    temaId: [null as number | null],
    numPreguntas: [10 as number | null],
    dificultad: [null as Dificultad | null],
    esDeRepaso: [false],
  });

  /** `app-tema-select` consume un FormControl directo (lee .value/.setValue). */
  get temaIdControl(): FormControl<number | null> {
    return this.form.controls.temaId as FormControl<number | null>;
  }

  tipoSeleccionado = signal<TipoBloque>('VIDEO');
  // El tipo es inmutable tras crear (el update DTO no lo transporta).
  readonly esEdicion = computed(() => this.bloque() !== null);

  constructor() {
    this.form.controls.tipo.valueChanges.subscribe((val) => {
      if (!val) return;
      this.tipoSeleccionado.set(val);
      this.applyValidatorsForTipo(val);
      this.resetFieldsForTipo(val);
    });

    effect(() => {
      this.applyValidatorsForTipo(this.tipoSeleccionado());
    });
  }

  private applyValidatorsForTipo(tipo: TipoBloque): void {
    const temaCtrl = this.form.controls.temaId;
    const numCtrl = this.form.controls.numPreguntas;

    if (tipo === 'TEST') {
      temaCtrl.setValidators([Validators.required]);
      numCtrl.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(50),
      ]);
    } else {
      temaCtrl.clearValidators();
      numCtrl.clearValidators();
    }
    temaCtrl.updateValueAndValidity({ emitEvent: false });
    numCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private resetFieldsForTipo(tipo: TipoBloque): void {
    if (tipo !== 'VIDEO') {
      this.form.patchValue(
        { bunnyVideoId: '', duracionSegundos: null },
        { emitEvent: false },
      );
    }
    if (tipo !== 'TEXTO') {
      this.form.patchValue({ contenidoMarkdown: '' }, { emitEvent: false });
    }
    if (tipo !== 'TEST') {
      this.form.patchValue(
        {
          temaId: null,
          numPreguntas: null,
          dificultad: null,
          esDeRepaso: false,
        },
        { emitEvent: false },
      );
    }
  }

  ngOnChanges(): void {
    const b = this.bloque();
    if (b) {
      this.form.patchValue({
        tipo: b.tipo,
        bunnyVideoId: b.bunnyVideoId ?? '',
        duracionSegundos: b.duracionSegundos ?? null,
        contenidoMarkdown: b.contenidoMarkdown ?? '',
        temaId: b.temaId ?? null,
        numPreguntas: b.numPreguntas ?? 10,
        dificultad: b.dificultad ?? null,
        esDeRepaso: b.esDeRepaso ?? false,
      });
      this.tipoSeleccionado.set(b.tipo);
      this.applyValidatorsForTipo(b.tipo);
    } else {
      this.form.reset({
        tipo: 'VIDEO',
        bunnyVideoId: '',
        duracionSegundos: null,
        contenidoMarkdown: '',
        temaId: null,
        numPreguntas: 10,
        dificultad: null,
        esDeRepaso: false,
      });
      this.tipoSeleccionado.set('VIDEO');
      this.applyValidatorsForTipo('VIDEO');
    }
  }

  onVideoUploaded(event: UploadedEvent): void {
    this.form.patchValue({ bunnyVideoId: event.guid });
    if (event.duracionSegundos != null) {
      this.form.patchValue({ duracionSegundos: event.duracionSegundos });
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }

  save(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    const result: BloqueFormResult = { tipo: raw.tipo };
    switch (result.tipo) {
      case 'VIDEO':
        if (!raw.bunnyVideoId) {
          this.toast.warning('Sube o indica un vídeo para el bloque.');
          return;
        }
        result.bunnyVideoId = raw.bunnyVideoId;
        result.duracionSegundos = raw.duracionSegundos ?? undefined;
        break;
      case 'TEXTO':
        if (!raw.contenidoMarkdown || raw.contenidoMarkdown.trim() === '') {
          this.toast.warning('Escribe el contenido del bloque de texto.');
          return;
        }
        result.contenidoMarkdown = raw.contenidoMarkdown;
        break;
      case 'TEST':
        if (raw.temaId == null) {
          this.toast.warning('Selecciona un tema para el bloque de test.');
          return;
        }
        if (
          raw.numPreguntas == null ||
          raw.numPreguntas < 1 ||
          raw.numPreguntas > 50
        ) {
          this.toast.warning('Indica número de preguntas entre 1 y 50.');
          return;
        }
        result.temaId = raw.temaId;
        result.numPreguntas = raw.numPreguntas;
        // null en dificultad = "todas" → el backend lo trata como ausente.
        if (raw.dificultad != null) result.dificultad = raw.dificultad;
        result.esDeRepaso = !!raw.esDeRepaso;
        break;
    }
    this.saved.emit(result);
  }
}
