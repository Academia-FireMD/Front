import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnChanges,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Leccion } from '../models/curso.model';

/**
 * Consolidación 2026-06-11: la lección es un CONTENEDOR de bloques (modelo
 * Teachable). El diálogo solo pide título + orden; el contenido (vídeo, texto,
 * test, cuestionario) se añade después con el builder de bloques ("Contenido").
 * Se eliminó el selector de tipo y los campos por tipo (ahora viven en el
 * formulario de bloque). El `tipo` legacy lo aplica el backend por defecto.
 */
export interface LeccionFormResult {
  titulo: string;
  orden: number;
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
    InputTextModule,
    InputNumberModule,
  ],
  templateUrl: './leccion-form-dialog.component.html',
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

  readonly saved = output<LeccionFormResult>();
  readonly cancelled = output<void>();

  private fb = inject(FormBuilder);

  readonly esEdicion = computed(() => this.leccion() !== null);

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    orden: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnChanges(): void {
    const l = this.leccion();
    if (l) {
      this.form.patchValue({ titulo: l.titulo, orden: l.orden });
    } else {
      this.form.reset({ titulo: '', orden: 0 });
    }
  }

  onVisibleChange(v: boolean): void {
    if (!v) this.cancelled.emit();
  }

  cancel(): void {
    this.cancelled.emit();
  }

  save(): void {
    if (this.form.invalid) return;
    const raw = this.form.getRawValue();
    this.saved.emit({ titulo: raw.titulo ?? '', orden: raw.orden ?? 0 });
  }
}
