import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  OnChanges,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { Leccion, TipoLeccion } from '../models/curso.model';
import { BunnyUploadComponent, UploadedEvent } from './bunny-upload.component';

export interface LeccionFormResult {
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
  bunnyVideoId?: string;
  duracionSegundos?: number;
  testPlantillaId?: number;
  mazoFlashcardsId?: number;
  contenidoMarkdown?: string;
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
    BunnyUploadComponent,
  ],
  template: `
    <p-dialog
      [header]="leccion() ? 'Editar lección' : 'Nueva lección'"
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '500px' }"
    >
      <form [formGroup]="form" class="leccion-form">
        <div class="field">
          <label for="lf-titulo">Título</label>
          <input
            id="lf-titulo"
            pInputText
            formControlName="titulo"
            placeholder="Nombre de la lección"
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="lf-orden">Orden</label>
          <p-inputNumber
            inputId="lf-orden"
            formControlName="orden"
            [min]="0"
            class="w-full"
          />
        </div>
        <div class="field">
          <label for="lf-tipo">Tipo</label>
          <p-dropdown
            inputId="lf-tipo"
            formControlName="tipo"
            [options]="tipoOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar tipo"
            class="w-full"
          />
        </div>

        @if (tipoSeleccionado() === 'VIDEO') {
          <div class="field">
            <label>Vídeo</label>
            <app-bunny-upload
              [videoTitle]="form.get('titulo')?.value ?? ''"
              (uploaded)="onVideoUploaded($event)"
            />
            @if (form.get('bunnyVideoId')?.value) {
              <small class="text-color-secondary">
                Video ID: {{ form.get('bunnyVideoId')?.value }}
              </small>
            }
          </div>
          <div class="field">
            <label for="lf-duracion">Duración (segundos)</label>
            <p-inputNumber
              inputId="lf-duracion"
              formControlName="duracionSegundos"
              [min]="0"
              class="w-full"
            />
          </div>
        }

        @if (tipoSeleccionado() === 'TEST') {
          <div class="field">
            <label for="lf-test">ID de plantilla de test</label>
            <p-inputNumber
              inputId="lf-test"
              formControlName="testPlantillaId"
              [min]="1"
              class="w-full"
            />
          </div>
        }

        @if (tipoSeleccionado() === 'FLASHCARDS') {
          <div class="field">
            <label for="lf-mazo">ID de mazo de flashcards</label>
            <p-inputNumber
              inputId="lf-mazo"
              formControlName="mazoFlashcardsId"
              [min]="1"
              class="w-full"
            />
          </div>
        }

        @if (tipoSeleccionado() === 'TEXTO') {
          <div class="field">
            <label for="lf-contenido">Contenido (Markdown)</label>
            <textarea
              id="lf-contenido"
              pInputTextarea
              formControlName="contenidoMarkdown"
              rows="6"
              class="w-full"
              placeholder="Escribe el contenido en Markdown..."
            ></textarea>
          </div>
        }
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
      .leccion-form .field {
        margin-bottom: 1rem;
      }
      .leccion-form label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 600;
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

  readonly tipoOptions: { label: string; value: TipoLeccion }[] = [
    { label: 'Vídeo', value: 'VIDEO' },
    { label: 'Test', value: 'TEST' },
    { label: 'Flashcards', value: 'FLASHCARDS' },
    { label: 'Texto', value: 'TEXTO' },
  ];

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    orden: [0, [Validators.required, Validators.min(0)]],
    tipo: ['VIDEO' as TipoLeccion, Validators.required],
    bunnyVideoId: [''],
    duracionSegundos: [null as number | null],
    testPlantillaId: [null as number | null],
    mazoFlashcardsId: [null as number | null],
    contenidoMarkdown: [''],
  });

  tipoSeleccionado = signal<TipoLeccion>('VIDEO');

  constructor() {
    this.form.get('tipo')?.valueChanges.subscribe((val) => {
      if (val) this.tipoSeleccionado.set(val as TipoLeccion);
    });
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
        testPlantillaId: l.testPlantillaId ?? null,
        mazoFlashcardsId: l.mazoFlashcardsId ?? null,
        contenidoMarkdown: l.contenidoMarkdown ?? '',
      });
      this.tipoSeleccionado.set(l.tipo);
    } else {
      this.form.reset({
        titulo: '',
        orden: 0,
        tipo: 'VIDEO',
        bunnyVideoId: '',
        duracionSegundos: null,
        testPlantillaId: null,
        mazoFlashcardsId: null,
        contenidoMarkdown: '',
      });
      this.tipoSeleccionado.set('VIDEO');
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
      tipo: (raw.tipo ?? 'VIDEO') as TipoLeccion,
    };
    if (result.tipo === 'VIDEO') {
      result.bunnyVideoId = raw.bunnyVideoId ?? undefined;
      result.duracionSegundos = raw.duracionSegundos ?? undefined;
    } else if (result.tipo === 'TEST') {
      result.testPlantillaId = raw.testPlantillaId ?? undefined;
    } else if (result.tipo === 'FLASHCARDS') {
      result.mazoFlashcardsId = raw.mazoFlashcardsId ?? undefined;
    } else if (result.tipo === 'TEXTO') {
      result.contenidoMarkdown = raw.contenidoMarkdown ?? undefined;
    }
    this.saved.emit(result);
  }
}
