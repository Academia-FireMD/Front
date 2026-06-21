import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  OnChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { Seccion } from '../models/curso.model';

export interface SeccionFormResult {
  titulo: string;
}

@Component({
  selector: 'app-seccion-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
  ],
  template: `
    <p-dialog
      [header]="seccion() ? 'Editar sección' : 'Nueva sección'"
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '400px' }"
    >
      <form [formGroup]="form" class="seccion-form">
        <div class="field">
          <label for="sf-titulo">Título</label>
          <input
            id="sf-titulo"
            pInputText
            formControlName="titulo"
            placeholder="Nombre de la sección"
            class="w-full"
          />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" severity="secondary" (onClick)="cancel()" />
        <p-button
          label="Guardar"
          icon="pi pi-check"
          [disabled]="form.invalid"
          (onClick)="save()"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .seccion-form .field {
        margin-bottom: 1rem;
      }
      .seccion-form label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 600;
      }
    `,
  ],
})
export class SeccionFormDialogComponent implements OnChanges {
  readonly visible = input<boolean>(false);
  readonly seccion = input<Seccion | null>(null);

  readonly saved = output<SeccionFormResult>();
  readonly cancelled = output<void>();

  private fb = inject(FormBuilder);

  // Solo título: el orden lo gestiona el reorder (flechas/drag) y el backend lo
  // autocalcula al crear. Antes el form pedía "orden" y mandaba 0 → 500 por
  // colisión con el @@unique([cursoId, orden]).
  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnChanges(): void {
    const s = this.seccion();
    if (s) {
      this.form.patchValue({ titulo: s.titulo });
    } else {
      this.form.reset({ titulo: '' });
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
    this.saved.emit({ titulo: raw.titulo ?? '' });
  }
}
