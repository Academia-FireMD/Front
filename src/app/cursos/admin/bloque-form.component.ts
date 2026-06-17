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
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
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
import { RadioButtonModule } from 'primeng/radiobutton';
import { firstValueFrom } from 'rxjs';
import { Dificultad } from '../../shared/models/pregunta.model';
import { MarkdownEditorComponent } from '../../shared/markdown-editor/markdown-editor.component';
import { Oposicion } from '../../shared/models/subscription.model';
import { SharedModule } from '../../shared/shared.module';
import {
  Bloque,
  BloquePreguntaPayload,
  TipoBloque,
} from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { BunnyUploadComponent, UploadedEvent } from './bunny-upload.component';

/**
 * Formulario inline de UN bloque (widget de la lección). No es un diálogo: se
 * embebe dentro de `leccion-bloques-dialog`, que gestiona la pila. A diferencia
 * de la lección, un bloque NO tiene título ni orden propio (el orden lo da su
 * posición en la pila / drag-drop). Config por tipo:
 *  - VIDEO  → bunny-upload + duración.
 *  - TEXTO  → markdown.
 *  - TEST   → tema-select + nº preguntas + dificultad + modo repaso.
 *  - CUESTIONARIO → preguntas propias (enunciado + opciones + correcta + explic.).
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
  preguntas?: BloquePreguntaPayload[];
  // Bloque DOCUMENTO (2026-06-16): metadatos del archivo subido.
  documentoPath?: string;
  documentoNombre?: string;
  documentoMime?: string;
  documentoTamanoBytes?: number;
}

// Tipos del FormArray de preguntas del CUESTIONARIO.
type OpcionControl = FormControl<string>;
type PreguntaGroup = FormGroup<{
  enunciado: FormControl<string>;
  opciones: FormArray<OpcionControl>;
  respuestaCorrecta: FormControl<number>;
  explicacion: FormControl<string>;
}>;

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
    RadioButtonModule,
    BunnyUploadComponent,
    MarkdownEditorComponent,
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
  /**
   * Tipo preseleccionado al CREAR (cuando el bloque llega desde la paleta
   * drag&drop). El admin puede cambiarlo en el dropdown si arrastró el chip
   * equivocado. Ignorado en edición (el tipo es inmutable tras crear).
   */
  readonly initialTipo = input<TipoBloque | null>(null);

  readonly saved = output<BloqueFormResult>();
  readonly cancelled = output<void>();

  private fb = inject(FormBuilder);
  private toast = inject(ToastrService);
  private service = inject(CursosAdminService);

  readonly tipoOptions: { label: string; value: TipoBloque }[] = [
    { label: 'Vídeo', value: 'VIDEO' },
    { label: 'Texto', value: 'TEXTO' },
    { label: 'Test', value: 'TEST' },
    { label: 'Cuestionario', value: 'CUESTIONARIO' },
    { label: 'Documento', value: 'DOCUMENTO' },
  ];

  /** Estado de subida del documento (bloque DOCUMENTO). */
  readonly subiendoDoc = signal(false);

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
    // CUESTIONARIO: preguntas propias (FormArray de FormGroup).
    preguntas: this.fb.array<PreguntaGroup>([]),
    // DOCUMENTO: metadatos del archivo subido a Supabase vía el backend.
    documentoPath: [null as string | null],
    documentoNombre: [null as string | null],
    documentoMime: [null as string | null],
    documentoTamanoBytes: [null as number | null],
  });

  /** `app-tema-select` consume un FormControl directo (lee .value/.setValue). */
  get temaIdControl(): FormControl<number | null> {
    return this.form.controls.temaId as FormControl<number | null>;
  }

  // ---- Helpers del FormArray de preguntas (CUESTIONARIO) ----

  get preguntas(): FormArray<PreguntaGroup> {
    return this.form.controls.preguntas;
  }

  opcionesDe(pregunta: PreguntaGroup): FormArray<OpcionControl> {
    return pregunta.controls.opciones;
  }

  // Sin validators required en enunciado/opciones: la validación de negocio
  // (≥2 opciones no vacías, enunciado presente, correcta válida) la hace
  // buildPreguntasResult() con toasts, igual que el patrón de TEXTO/TEST. Así
  // el form no queda bloqueado por una opción recién añadida aún vacía.
  private nuevaPregunta(): PreguntaGroup {
    return this.fb.group({
      enunciado: this.fb.control('', { nonNullable: true }),
      opciones: this.fb.array<OpcionControl>([
        this.nuevaOpcion(),
        this.nuevaOpcion(),
      ]),
      respuestaCorrecta: this.fb.control(0, { nonNullable: true }),
      explicacion: this.fb.control('', { nonNullable: true }),
    });
  }

  private nuevaOpcion(valor = ''): OpcionControl {
    return this.fb.control(valor, { nonNullable: true });
  }

  addPregunta(): void {
    this.preguntas.push(this.nuevaPregunta());
  }

  removePregunta(index: number): void {
    this.preguntas.removeAt(index);
  }

  addOpcion(pregunta: PreguntaGroup): void {
    this.opcionesDe(pregunta).push(this.nuevaOpcion());
  }

  removeOpcion(pregunta: PreguntaGroup, opcionIndex: number): void {
    const opciones = this.opcionesDe(pregunta);
    if (opciones.length <= 2) return; // mínimo 2 opciones
    opciones.removeAt(opcionIndex);
    // Si la correcta apuntaba a una opción posterior, reajusta el índice.
    const correcta = pregunta.controls.respuestaCorrecta.value;
    if (correcta >= opciones.length) {
      pregunta.controls.respuestaCorrecta.setValue(opciones.length - 1);
    }
  }

  marcarCorrecta(pregunta: PreguntaGroup, opcionIndex: number): void {
    pregunta.controls.respuestaCorrecta.setValue(opcionIndex);
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

    // CUESTIONARIO: el array de preguntas es obligatorio (≥1). Sembramos una
    // pregunta inicial al entrar para que el admin tenga algo que rellenar.
    if (tipo === 'CUESTIONARIO') {
      this.preguntas.setValidators([Validators.required]);
      if (this.preguntas.length === 0) this.addPregunta();
    } else {
      this.preguntas.clearValidators();
    }
    this.preguntas.updateValueAndValidity({ emitEvent: false });
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
    if (tipo !== 'CUESTIONARIO') {
      this.preguntas.clear({ emitEvent: false });
    }
    if (tipo !== 'DOCUMENTO') {
      this.form.patchValue(
        {
          documentoPath: null,
          documentoNombre: null,
          documentoMime: null,
          documentoTamanoBytes: null,
        },
        { emitEvent: false },
      );
    }
  }

  /** Reconstruye el FormArray de preguntas desde un bloque CUESTIONARIO. */
  private setPreguntasFromBloque(b: Bloque): void {
    this.preguntas.clear({ emitEvent: false });
    for (const p of b.bloquePreguntas ?? []) {
      const grupo = this.nuevaPregunta();
      grupo.controls.opciones.clear({ emitEvent: false });
      for (const op of p.opciones) {
        grupo.controls.opciones.push(this.nuevaOpcion(op), {
          emitEvent: false,
        });
      }
      grupo.patchValue(
        {
          enunciado: p.enunciado,
          respuestaCorrecta: p.respuestaCorrecta ?? 0,
          explicacion: p.explicacion ?? '',
        },
        { emitEvent: false },
      );
      this.preguntas.push(grupo, { emitEvent: false });
    }
  }

  ngOnChanges(): void {
    const b = this.bloque();
    if (b) {
      if (b.tipo === 'CUESTIONARIO') this.setPreguntasFromBloque(b);
      this.form.patchValue({
        tipo: b.tipo,
        bunnyVideoId: b.bunnyVideoId ?? '',
        duracionSegundos: b.duracionSegundos ?? null,
        contenidoMarkdown: b.contenidoMarkdown ?? '',
        temaId: b.temaId ?? null,
        numPreguntas: b.numPreguntas ?? 10,
        dificultad: b.dificultad ?? null,
        esDeRepaso: b.esDeRepaso ?? false,
        documentoPath: b.documentoPath ?? null,
        documentoNombre: b.documentoNombre ?? null,
        documentoMime: b.documentoMime ?? null,
        documentoTamanoBytes: b.documentoTamanoBytes ?? null,
      });
      this.tipoSeleccionado.set(b.tipo);
      this.applyValidatorsForTipo(b.tipo);
    } else {
      // Creación: el tipo arranca en el preseleccionado por la paleta (o VIDEO).
      const tipoInicial = this.initialTipo() ?? 'VIDEO';
      this.preguntas.clear({ emitEvent: false });
      this.form.reset({
        tipo: tipoInicial,
        bunnyVideoId: '',
        duracionSegundos: null,
        contenidoMarkdown: '',
        temaId: null,
        numPreguntas: 10,
        dificultad: null,
        esDeRepaso: false,
        documentoPath: null,
        documentoNombre: null,
        documentoMime: null,
        documentoTamanoBytes: null,
      });
      this.tipoSeleccionado.set(tipoInicial);
      this.applyValidatorsForTipo(tipoInicial);
    }
  }

  onVideoUploaded(event: UploadedEvent): void {
    this.form.patchValue({ bunnyVideoId: event.guid });
    if (event.duracionSegundos != null) {
      this.form.patchValue({ duracionSegundos: event.duracionSegundos });
    }
  }

  // ---- DOCUMENTO: subida / metadatos ----

  /** Tamaño máximo cliente (espeja el límite del backend: 25 MB). */
  private readonly MAX_DOC_BYTES = 25 * 1024 * 1024;

  async onDocumentoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    if (file.size > this.MAX_DOC_BYTES) {
      this.toast.warning('El documento supera el máximo de 25 MB.');
      input.value = '';
      return;
    }
    this.subiendoDoc.set(true);
    try {
      const meta = await firstValueFrom(this.service.uploadDocumento(file));
      this.form.patchValue({
        documentoPath: meta.documentoPath,
        documentoNombre: meta.documentoNombre,
        documentoMime: meta.documentoMime,
        documentoTamanoBytes: meta.documentoTamanoBytes,
      });
      this.toast.success('Documento subido.');
    } catch {
      this.toast.error('No se pudo subir el documento.');
    } finally {
      this.subiendoDoc.set(false);
      input.value = ''; // permite re-subir el mismo archivo
    }
  }

  quitarDocumento(): void {
    this.form.patchValue({
      documentoPath: null,
      documentoNombre: null,
      documentoMime: null,
      documentoTamanoBytes: null,
    });
  }

  /** Tamaño legible para mostrar el documento ya subido. */
  formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
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
      case 'CUESTIONARIO': {
        const preguntas = this.buildPreguntasResult();
        if (!preguntas) return; // ya avisó con un toast
        result.preguntas = preguntas;
        break;
      }
      case 'DOCUMENTO':
        if (!raw.documentoPath) {
          this.toast.warning('Sube un documento para el bloque.');
          return;
        }
        result.documentoPath = raw.documentoPath;
        result.documentoNombre = raw.documentoNombre ?? undefined;
        result.documentoMime = raw.documentoMime ?? undefined;
        result.documentoTamanoBytes = raw.documentoTamanoBytes ?? undefined;
        break;
    }
    this.saved.emit(result);
  }

  /**
   * Valida y construye el array de preguntas del cuestionario. Devuelve null y
   * muestra un toast si algo falta (≥1 pregunta, cada una con enunciado, ≥2
   * opciones no vacías y una opción correcta válida).
   */
  private buildPreguntasResult(): BloquePreguntaPayload[] | null {
    if (this.preguntas.length === 0) {
      this.toast.warning('Añade al menos una pregunta al cuestionario.');
      return null;
    }
    const out: BloquePreguntaPayload[] = [];
    for (let i = 0; i < this.preguntas.length; i++) {
      const g = this.preguntas.at(i);
      const enunciado = g.controls.enunciado.value.trim();
      if (!enunciado) {
        this.toast.warning(`La pregunta ${i + 1} necesita un enunciado.`);
        return null;
      }
      const opciones = g.controls.opciones.controls
        .map((c) => c.value.trim())
        .filter((v) => v !== '');
      if (opciones.length < 2) {
        this.toast.warning(
          `La pregunta ${i + 1} necesita al menos 2 opciones.`,
        );
        return null;
      }
      const correcta = g.controls.respuestaCorrecta.value;
      if (correcta < 0 || correcta >= opciones.length) {
        this.toast.warning(`Marca la opción correcta de la pregunta ${i + 1}.`);
        return null;
      }
      const explicacion = g.controls.explicacion.value.trim();
      out.push({
        enunciado,
        opciones,
        respuestaCorrecta: correcta,
        ...(explicacion ? { explicacion } : {}),
      });
    }
    return out;
  }
}
