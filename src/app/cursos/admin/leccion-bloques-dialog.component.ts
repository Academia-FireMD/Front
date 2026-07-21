import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { firstValueFrom } from 'rxjs';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  Bloque,
  BloqueCreatePayload,
  BloqueUpdatePayload,
  Leccion,
  TipoBloque,
} from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { BloqueFormComponent, BloqueFormResult } from './bloque-form.component';

interface TipoMeta {
  label: string;
  icon: string;
}

/**
 * Builder de la pila de bloques de una lección (Teachable: lección = pila de
 * widgets combinables). Dos modos:
 *  - LISTA: pila de bloques con drag-drop (CDK), editar/eliminar por bloque y
 *    "+ Añadir bloque".
 *  - FORM: formulario inline (`app-bloque-form`) para crear/editar un bloque,
 *    sin modal anidado.
 *
 * Posee las llamadas al servicio (create/update/delete/reorder) y emite la pila
 * actualizada a `(bloquesChanged)` para que el editor refresque su estado.
 */
@Component({
  selector: 'app-leccion-bloques-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DragDropModule,
    DialogModule,
    ButtonModule,
    TagModule,
    BloqueFormComponent,
  ],
  templateUrl: './leccion-bloques-dialog.component.html',
  styleUrl: './leccion-bloques-dialog.component.scss',
})
export class LeccionBloquesDialogComponent {
  readonly visible = input<boolean>(false);
  readonly leccion = input<Leccion | null>(null);
  readonly oposicion = input<Oposicion | null>(null);

  readonly closed = output<void>();
  readonly bloquesChanged = output<Bloque[]>();

  private service = inject(CursosAdminService);
  private toast = inject(ToastrService);

  readonly bloques = signal<Bloque[]>([]);
  readonly mode = signal<'list' | 'form'>('list');
  readonly editando = signal<Bloque | null>(null);
  readonly saving = signal(false);
  readonly reordering = signal(false);
  /** Tipo preseleccionado al crear desde la paleta (drag o clic). */
  readonly nuevoTipo = signal<TipoBloque | null>(null);
  /** Posición donde insertar el bloque nuevo (drop en la pila); null = al final. */
  private readonly pendingInsertIndex = signal<number | null>(null);

  private readonly tipoMeta: Record<TipoBloque, TipoMeta> = {
    VIDEO: { label: 'Vídeo', icon: 'pi pi-video' },
    TEXTO: { label: 'Texto', icon: 'pi pi-align-left' },
    TEST: { label: 'Test', icon: 'pi pi-question-circle' },
    CUESTIONARIO: { label: 'Cuestionario', icon: 'pi pi-list-check' },
    DOCUMENTO: { label: 'Documento', icon: 'pi pi-file' },
  };

  /** Orden de los chips de la paleta (drag&drop para construir la lección). */
  readonly paletaTipos: TipoBloque[] = [
    'VIDEO',
    'TEXTO',
    'TEST',
    'CUESTIONARIO',
    'DOCUMENTO',
  ];

  readonly leccionTitulo = computed(() => this.leccion()?.titulo ?? 'Lección');
  readonly vacio = computed(() => this.bloques().length === 0);

  constructor() {
    // Sincroniza la pila local cada vez que cambia la lección o se reabre.
    effect(
      () => {
        const l = this.leccion();
        // Lectura de `visible()` para re-sincronizar al reabrir el diálogo.
        this.visible();
        this.bloques.set([...(l?.bloques ?? [])]);
        this.mode.set('list');
        this.editando.set(null);
      },
      { allowSignalWrites: true },
    );
  }

  meta(tipo: TipoBloque): TipoMeta {
    return this.tipoMeta[tipo];
  }

  resumen(b: Bloque): string {
    switch (b.tipo) {
      case 'VIDEO':
        return b.duracionSegundos
          ? `${Math.round(b.duracionSegundos / 60)} min`
          : 'Vídeo';
      case 'TEXTO': {
        const len = b.contenidoMarkdown?.length ?? 0;
        return len > 0 ? `${len} caracteres` : 'Sin contenido';
      }
      case 'TEST':
        return `${b.numPreguntas ?? 0} preguntas${
          b.esDeRepaso ? ' · repaso' : ''
        }`;
      case 'CUESTIONARIO': {
        const n = b.bloquePreguntas?.length ?? 0;
        return `${n} ${n === 1 ? 'pregunta' : 'preguntas'}`;
      }
      case 'DOCUMENTO':
        return b.documentoNombre || 'Documento';
    }
  }

  onVisibleChange(v: boolean): void {
    if (!v) this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }

  /**
   * Abre el formulario para crear un bloque del `tipo` dado (chip de la paleta,
   * por clic o por drop). `insertIndex` = posición donde aterrizó el drop en la
   * pila; null = añadir al final (clic en el chip).
   */
  addTipo(tipo: TipoBloque, insertIndex: number | null = null): void {
    this.editando.set(null);
    this.nuevoTipo.set(tipo);
    this.pendingInsertIndex.set(insertIndex);
    this.mode.set('form');
  }

  openEdit(bloque: Bloque): void {
    this.editando.set(bloque);
    this.nuevoTipo.set(null);
    this.pendingInsertIndex.set(null);
    this.mode.set('form');
  }

  backToList(): void {
    this.mode.set('list');
    this.editando.set(null);
    this.nuevoTipo.set(null);
    this.pendingInsertIndex.set(null);
  }

  async onFormSaved(result: BloqueFormResult): Promise<void> {
    const leccionId = this.leccion()?.id;
    if (leccionId == null) return;
    this.saving.set(true);
    try {
      const editando = this.editando();
      if (editando) {
        const payload: BloqueUpdatePayload = {
          bunnyVideoId: result.bunnyVideoId,
          duracionSegundos: result.duracionSegundos,
          contenidoMarkdown: result.contenidoMarkdown,
          temaId: result.temaId,
          numPreguntas: result.numPreguntas,
          dificultad: result.dificultad,
          esDeRepaso: result.esDeRepaso,
          preguntas: result.preguntas,
          documentoPath: result.documentoPath,
          documentoNombre: result.documentoNombre,
          documentoMime: result.documentoMime,
          documentoTamanoBytes: result.documentoTamanoBytes,
        };
        const updated = await firstValueFrom(
          this.service.updateBloque(editando.id, payload),
        );
        this.bloques.update((prev) =>
          prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
        );
        this.toast.success('Bloque actualizado');
      } else {
        const payload: BloqueCreatePayload = {
          tipo: result.tipo,
          bunnyVideoId: result.bunnyVideoId,
          duracionSegundos: result.duracionSegundos,
          contenidoMarkdown: result.contenidoMarkdown,
          temaId: result.temaId,
          numPreguntas: result.numPreguntas,
          dificultad: result.dificultad,
          esDeRepaso: result.esDeRepaso,
          preguntas: result.preguntas,
          documentoPath: result.documentoPath,
          documentoNombre: result.documentoNombre,
          documentoMime: result.documentoMime,
          documentoTamanoBytes: result.documentoTamanoBytes,
        };
        const created = await firstValueFrom(
          this.service.createBloque(leccionId, payload),
        );
        this.bloques.update((prev) => [...prev, created]);
        // Si vino de un drop en una posición concreta, lo movemos ahí (el
        // backend lo creó al final). Reutiliza el reorder ya existente.
        await this.aplicarPosicionDrop(created.id);
        this.toast.success('Bloque añadido');
      }
      this.emitChanged();
      this.backToList();
    } catch {
      // handleError ya muestra toast
    } finally {
      this.saving.set(false);
    }
  }

  async deleteBloque(bloque: Bloque): Promise<void> {
    // Borrado directo: el bloque es un widget barato, sin sub-confirmación
    // anidada dentro del diálogo (evita modales apilados). El undo es recrear.
    try {
      await firstValueFrom(this.service.deleteBloque(bloque.id));
      this.bloques.update((prev) => prev.filter((b) => b.id !== bloque.id));
      this.emitChanged();
      this.toast.success('Bloque eliminado');
    } catch {
      // handleError ya muestra toast
    }
  }

  async drop(event: CdkDragDrop<Bloque[]>): Promise<void> {
    // Drop de un chip de la PALETA (otra lista) → crear bloque de ese tipo en la
    // posición soltada. No se transfiere nada de array: abrimos el formulario.
    if (event.previousContainer !== event.container) {
      const tipo = event.item.data as TipoBloque;
      if (tipo) this.addTipo(tipo, event.currentIndex);
      return;
    }
    // Reordenar dentro de la pila.
    if (event.previousIndex === event.currentIndex) return;
    const prev = this.bloques();
    const next = [...prev];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    const reordered = next.map((b, idx) => ({ ...b, orden: idx }));
    this.bloques.set(reordered);
    this.reordering.set(true);
    try {
      await firstValueFrom(
        this.service.reorderBloques(
          reordered.map((b) => ({ id: b.id, orden: b.orden })),
        ),
      );
      this.emitChanged();
    } catch {
      this.bloques.set(prev); // rollback optimista
    } finally {
      this.reordering.set(false);
    }
  }

  /**
   * Tras crear un bloque (el backend lo añade al final), lo recoloca en la
   * posición del drop si se soltó en un punto concreto de la pila. Persiste el
   * nuevo orden con el mismo endpoint de reorder.
   */
  private async aplicarPosicionDrop(nuevoId: number): Promise<void> {
    const index = this.pendingInsertIndex();
    const lista = this.bloques();
    // null = clic (al final) o drop al final → no hay que mover nada.
    if (index === null || index >= lista.length - 1) return;
    const next = [...lista];
    const movedIdx = next.findIndex((b) => b.id === nuevoId);
    if (movedIdx === -1) return;
    const [moved] = next.splice(movedIdx, 1);
    next.splice(index, 0, moved);
    const reordered = next.map((b, idx) => ({ ...b, orden: idx }));
    this.bloques.set(reordered);
    try {
      await firstValueFrom(
        this.service.reorderBloques(
          reordered.map((b) => ({ id: b.id, orden: b.orden })),
        ),
      );
    } catch {
      // Si el reorder falla, el bloque queda al final (ya creado); no rompemos.
    }
  }

  private emitChanged(): void {
    this.bloquesChanged.emit(this.bloques());
  }
}
