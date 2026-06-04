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
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { Dificultad } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { SharedModule } from '../../shared/shared.module';
import { Leccion, TipoLeccion } from '../models/curso.model';
import { BunnyUploadComponent, UploadedEvent } from './bunny-upload.component';

/**
 * Refactor 2026-05-25 (T11 / T15 / D10):
 *  - Tipos enum (`TipoLeccion`, `Dificultad`) tipados sin `as never`.
 *  - Form reactivo por tipo: TEST/FLASHCARDS exigen `temaId` + `numPreguntas`
 *    + opcional `dificultad` (null = "Todas las dificultades") + `esDeRepaso`.
 *  - `testPlantillaId` y `mazoFlashcardsId` ELIMINADOS (entidades inexistentes
 *    en backend; refactor previo Server staging).
 */
export interface LeccionFormResult {
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
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
  selector: 'app-leccion-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    InputTextareaModule,
    CheckboxModule,
    BunnyUploadComponent,
    SharedModule,
  ],
  templateUrl: './leccion-form-dialog.component.html',
  // Cuando se monte en cursos-admin, los estilos viven inline para no añadir
  // un archivo más. El componente es pequeño y único en su feature.
  styles: [
    `
      .leccion-form .field {
        margin-bottom: 1rem;
      }
      .leccion-form label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 600;
      }
      .leccion-form__hint {
        display: block;
        color: var(--text-color-secondary);
        font-size: 0.8rem;
        margin-top: 0.25rem;
      }
    `,
  ],
})
export class LeccionFormDialogComponent implements OnChanges {
  readonly visible = input<boolean>(false);
  readonly leccion = input<Leccion | null>(null);
  /**
   * Oposición del curso, se propaga al `<app-tema-select>` para filtrar los
   * temas a los del módulo cuya relevancia incluye esta oposición.
   */
  readonly oposicion = input<Oposicion | null>(null);

  readonly saved = output<LeccionFormResult>();
  readonly cancelled = output<void>();

  private fb = inject(FormBuilder);
  private toast = inject(ToastrService);

  readonly tipoOptions: { label: string; value: TipoLeccion }[] = [
    { label: 'Vídeo', value: 'VIDEO' },
    { label: 'Test', value: 'TEST' },
    { label: 'Flashcards', value: 'FLASHCARDS' },
    { label: 'Texto', value: 'TEXTO' },
  ];

  readonly dificultadOptions: DificultadOption[] = [
    { label: 'Todas las dificultades', value: null },
    { label: 'Básico', value: Dificultad.BASICO },
    { label: 'Intermedio', value: Dificultad.INTERMEDIO },
    { label: 'Difícil', value: Dificultad.DIFICIL },
  ];

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    orden: [0, [Validators.required, Validators.min(0)]],
    tipo: this.fb.control<TipoLeccion>('VIDEO', {
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

  /**
   * `app-tema-select` consume un FormControl directo, no funciona con
   * formControlName porque accede a `.value` y `.setValue` directos.
   */
  get temaIdControl(): FormControl<number | null> {
    return this.form.controls.temaId as FormControl<number | null>;
  }

  tipoSeleccionado = signal<TipoLeccion>('VIDEO');
  // Tipo is immutable after creation: the update DTO doesn't carry it.
  readonly esEdicion = computed(() => this.leccion() !== null);

  constructor() {
    this.form.controls.tipo.valueChanges.subscribe((val) => {
      if (!val) return;
      this.tipoSeleccionado.set(val);
      this.applyValidatorsForTipo(val);
      this.resetFieldsForTipo(val);
    });

    // Set validators on initial load
    effect(() => {
      this.applyValidatorsForTipo(this.tipoSeleccionado());
    });
  }

  private applyValidatorsForTipo(tipo: TipoLeccion): void {
    const temaCtrl = this.form.controls.temaId;
    const numCtrl = this.form.controls.numPreguntas;

    if (tipo === 'TEST' || tipo === 'FLASHCARDS') {
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

  private resetFieldsForTipo(tipo: TipoLeccion): void {
    // Limpia los campos del tipo previo para evitar payloads contaminados.
    if (tipo !== 'VIDEO') {
      this.form.patchValue(
        { bunnyVideoId: '', duracionSegundos: null },
        { emitEvent: false },
      );
    }
    if (tipo !== 'TEXTO') {
      this.form.patchValue({ contenidoMarkdown: '' }, { emitEvent: false });
    }
    if (tipo !== 'TEST' && tipo !== 'FLASHCARDS') {
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
    const l = this.leccion();
    if (l) {
      this.form.patchValue({
        titulo: l.titulo,
        orden: l.orden,
        tipo: l.tipo,
        bunnyVideoId: l.bunnyVideoId ?? '',
        duracionSegundos: l.duracionSegundos ?? null,
        contenidoMarkdown: l.contenidoMarkdown ?? '',
        temaId: l.temaId ?? null,
        numPreguntas: l.numPreguntas ?? 10,
        dificultad: l.dificultad ?? null,
        esDeRepaso: l.esDeRepaso ?? false,
      });
      this.tipoSeleccionado.set(l.tipo);
      this.applyValidatorsForTipo(l.tipo);
    } else {
      this.form.reset({
        titulo: '',
        orden: 0,
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

  onVisibleChange(v: boolean): void {
    if (!v) this.cancelled.emit();
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
    const result: LeccionFormResult = {
      titulo: raw.titulo ?? '',
      orden: raw.orden ?? 0,
      tipo: raw.tipo,
    };
    switch (result.tipo) {
      case 'VIDEO':
        result.bunnyVideoId = raw.bunnyVideoId ?? undefined;
        result.duracionSegundos = raw.duracionSegundos ?? undefined;
        break;
      case 'TEXTO':
        result.contenidoMarkdown = raw.contenidoMarkdown ?? undefined;
        break;
      case 'TEST':
      case 'FLASHCARDS':
        // BLOCKING-2 (codex review): validar explícitamente antes de emitir.
        // Los reactive validators ya marcan el form invalid, pero un cambio
        // futuro en la lógica de validators podría hacer que el form pase
        // como valid y el backend devuelva 400. Esta guard cliente-side
        // garantiza UX clara y bloquea el emit incluso si los validators
        // se relajan accidentalmente.
        if (raw.temaId == null) {
          this.toast.warning(
            'Selecciona un tema para lecciones TEST/FLASHCARDS',
          );
          return;
        }
        if (
          raw.numPreguntas == null ||
          raw.numPreguntas < 1 ||
          raw.numPreguntas > 50
        ) {
          this.toast.warning('Indica número de preguntas entre 1 y 50');
          return;
        }
        result.temaId = raw.temaId;
        result.numPreguntas = raw.numPreguntas;
        // null en dificultad significa "todas" — el backend lo interpreta
        // como ausente. NO mandar el campo cuando es null.
        if (raw.dificultad != null) {
          result.dificultad = raw.dificultad;
        }
        result.esDeRepaso = !!raw.esDeRepaso;
        break;
    }
    this.saved.emit(result);
  }
}
