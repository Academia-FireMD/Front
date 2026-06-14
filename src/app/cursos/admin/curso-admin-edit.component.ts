import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { FloatLabelModule } from 'primeng/floatlabel';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { firstValueFrom } from 'rxjs';
import { AsyncButtonComponent } from '../../shared/components/async-button/async-button.component';
import { WooCommerceProductPickerComponent } from '../../shared/components/woocommerce-product-picker/woocommerce-product-picker.component';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  Bloque,
  CursoCreatePayload,
  CursoDetail,
  CursoUpdatePayload,
  EstadoCurso,
  Leccion,
  LeccionCreatePayload,
  LeccionUpdatePayload,
  Seccion,
  WooCommerceProductSummary,
} from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { ImageUploadComponent } from './image-upload.component';
import { LeccionBloquesDialogComponent } from './leccion-bloques-dialog.component';
import {
  LeccionFormDialogComponent,
  LeccionFormResult,
} from './leccion-form-dialog.component';
import {
  SeccionFormDialogComponent,
  SeccionFormResult,
} from './seccion-form-dialog.component';

type TagSeverity =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'secondary'
  | 'contrast'
  | undefined;

/**
 * Refactor 2026-05-25 (T10 / T16 / D7 / D15):
 *  - Input `precio` eliminado del form; el precio se deriva del producto WC
 *    vinculado (`<app-woocommerce-product-picker endpoint="cursos">`).
 *  - Auto-llenado opcional al seleccionar producto (titulo/descripcion/thumb).
 *  - Acciones de toolbar (publicar/archivar/despublicar/saveMetadata) usan
 *    `<app-async-button>` para tener loading state consistente.
 *  - Toggle "Ver como alumno" renderiza `<app-curso-detail-page [previewData]>`.
 *  - Optimistic locking (D15): cliente envía `updatedAt`, backend devuelve 409
 *    si está stale → toast warning + auto-reload.
 *  - confirm() browser migrado a `<p-confirmDialog>` (T16).
 */
@Component({
  selector: 'app-curso-admin-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DragDropModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    FloatLabelModule,
    CardModule,
    TabViewModule,
    TagModule,
    TooltipModule,
    DividerModule,
    ConfirmDialogModule,
    AsyncButtonComponent,
    WooCommerceProductPickerComponent,
    SeccionFormDialogComponent,
    LeccionFormDialogComponent,
    LeccionBloquesDialogComponent,
    ImageUploadComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './curso-admin-edit.component.html',
  styleUrl: './curso-admin-edit.component.scss',
})
export class CursoAdminEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private cursosAdminService = inject(CursosAdminService);
  private toast = inject(ToastrService);
  private confirmation = inject(ConfirmationService);

  cursoId = signal<number | null>(null);
  curso = signal<CursoDetail | null>(null);
  loading = signal(true);
  saving = signal(false);

  // Estado computado para el toolbar
  esNuevo = computed(() => this.cursoId() === null);
  estadoCurso = computed(() => this.curso()?.estado ?? null);

  // Sección dialogs
  seccionDialogVisible = signal(false);
  seccionEditando = signal<Seccion | null>(null);

  // Lección dialogs
  leccionDialogVisible = signal(false);
  leccionEditando = signal<Leccion | null>(null);
  leccionSeccionId = signal<number | null>(null);

  // Bloques (builder de contenido de la lección)
  bloquesDialogVisible = signal(false);
  bloquesLeccion = signal<Leccion | null>(null);

  /**
   * Puente entre el `app-image-upload` (model bidireccional) y el FormControl
   * `thumbnailUrl` del metadataForm: al subir/quitar una imagen, escribe la URL
   * en el form y lo marca dirty para que "Guardar" la persista.
   */
  get thumbnailUrlModel(): string | null {
    return this.metadataForm.controls.thumbnailUrl.value ?? null;
  }
  set thumbnailUrlModel(value: string | null) {
    this.metadataForm.controls.thumbnailUrl.setValue(value ?? '');
    this.metadataForm.controls.thumbnailUrl.markAsDirty();
  }

  /**
   * Oposición actual del curso. Pasada al picker de tema dentro del leccion
   * dialog (T11.1 / D6).
   *
   * HIGH-3 (codex review): validamos membresía del enum antes de devolverla.
   * El backend devuelve el campo como string; si por algún drift de DTO
   * llega un valor desconocido, preferimos devolver null que pasarle al
   * picker un valor que rompería `OPOSICION_LABELS[...]` undefined.
   */
  oposicionCurso = computed<Oposicion | null>(() => {
    const raw = this.curso()?.oposicion;
    if (!raw) return null;
    const validValues = Object.values(Oposicion) as string[];
    return validValues.includes(raw as string) ? (raw as Oposicion) : null;
  });

  metadataForm = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', Validators.required],
    descripcion: [''],
    wooProductId: [null as number | null],
    thumbnailUrl: [''],
    duracionEstimadaMinutos: [null as number | null],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'nuevo') {
      this.cursoId.set(Number(id));
      this.loadCurso(Number(id));
    } else {
      this.loading.set(false);
    }
  }

  async loadCurso(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(this.cursosAdminService.getCurso(id));
      this.curso.set(data);
      this.metadataForm.patchValue({
        titulo: data.titulo,
        slug: data.slug,
        descripcion: data.descripcion ?? '',
        wooProductId: data.wooProductId ?? null,
        thumbnailUrl: data.thumbnailUrl ?? '',
        duracionEstimadaMinutos: data.duracionEstimadaMinutos ?? null,
      });
    } catch {
      // handleError shows toast
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/app/cursos-admin']);
  }

  /**
   * D7 — auto-llenado al vincular WC product. Pregunta confirmación si el
   * admin ya escribió campos manualmente (titulo/descripcion/thumbnail).
   */
  onWooProductSelected(product: WooCommerceProductSummary | null): void {
    if (!product) return;
    const current = this.metadataForm.getRawValue();
    const hasUserText =
      (current.titulo && current.titulo.trim() !== '') ||
      (current.descripcion && current.descripcion.trim() !== '') ||
      (current.thumbnailUrl && current.thumbnailUrl.trim() !== '');

    const applySuggestions = () => {
      const next = { ...current };
      if (product.name) next.titulo = product.name;
      // El producto WC actual sólo expone los campos mapeados en el endpoint
      // (id/name/sku/price/status); descripción/thumbnail llegarán cuando el
      // cache se enriquezca (TODO P2). Por ahora sólo el título.
      this.metadataForm.patchValue(next);
    };

    if (hasUserText) {
      this.confirmation.confirm({
        header: 'Sobrescribir con datos de WooCommerce',
        message:
          'Has escrito datos en el formulario. ¿Quieres sustituirlos con los datos del producto WooCommerce?',
        acceptLabel: 'Sobrescribir',
        rejectLabel: 'Mantener actuales',
        accept: () => applySuggestions(),
        reject: () => {
          /* no-op */
        },
      });
    } else {
      applySuggestions();
    }
  }

  /** Helper: payload preview para `<app-curso-detail-page>` con datos del form. */
  /**
   * Previsualizar = abrir el curso REAL del alumno en una pestaña nueva. El
   * backend da bypass de acceso a ADMIN/SUPERADMIN, así que el aula es
   * totalmente navegable e interactiva (vídeo, texto, test/cuestionario con el
   * motor real del alumno), sin necesidad de haber comprado el curso. Sustituye
   * al antiguo preview estático ("Ver como alumno") que no dejaba interactuar.
   */
  previsualizar = (): void => {
    const slug = this.curso()?.slug;
    if (!slug) return;
    window.open(`/app/cursos/${slug}`, '_blank');
  };

  /**
   * D15 — Save con optimistic locking. El service `update()` no muestra
   * toast en error (ignoreError=true); lo gestionamos aquí.
   */
  saveMetadata = async (): Promise<void> => {
    if (this.metadataForm.invalid) return;
    this.saving.set(true);
    const raw = this.metadataForm.getRawValue();
    try {
      const id = this.cursoId();
      if (id) {
        const c = this.curso();
        if (!c?.updatedAt) {
          this.toast.error(
            'No se ha podido determinar el estado del curso. Recarga la página.',
          );
          return;
        }
        const payload: CursoUpdatePayload = {
          titulo: raw.titulo ?? undefined,
          descripcion: raw.descripcion ?? undefined,
          wooProductId: raw.wooProductId ?? null,
          thumbnailUrl: raw.thumbnailUrl ?? undefined,
          duracionEstimadaMinutos: raw.duracionEstimadaMinutos ?? undefined,
          updatedAt: c.updatedAt,
        };
        const updated = await firstValueFrom(
          this.cursosAdminService.update(id, payload),
        );
        this.curso.update((prev) => (prev ? { ...prev, ...updated } : prev));
        this.toast.success('Metadatos guardados correctamente');
      } else {
        const createPayload: CursoCreatePayload = {
          titulo: raw.titulo ?? '',
          slug: raw.slug ?? '',
          descripcion: raw.descripcion ?? undefined,
          wooProductId: raw.wooProductId ?? null,
          thumbnailUrl: raw.thumbnailUrl ?? undefined,
          duracionEstimadaMinutos: raw.duracionEstimadaMinutos ?? undefined,
        };
        const created = await firstValueFrom(
          this.cursosAdminService.create(createPayload),
        );
        this.toast.success('Curso creado correctamente');
        this.router.navigate(['/app/cursos-admin', created.id]);
      }
    } catch (err) {
      const httpErr = err as HttpErrorResponse;
      if (httpErr?.status === 409) {
        this.toast.warning(
          'Otro admin modificó este curso. Recargando con los datos actuales…',
        );
        const id = this.cursoId();
        if (id) await this.loadCurso(id);
      } else {
        // Fallback genérico: el service ignoró el toast, lo mostramos aquí.
        this.toast.error(
          httpErr?.error?.message ?? 'No se han podido guardar los cambios.',
        );
      }
    } finally {
      this.saving.set(false);
    }
  };

  publicar = async (): Promise<void> => {
    const id = this.cursoId();
    if (!id) return;
    const updated = await firstValueFrom(this.cursosAdminService.publicar(id));
    this.curso.update((prev) =>
      prev ? { ...prev, estado: updated.estado } : prev,
    );
    this.toast.success('Curso publicado');
  };

  archivar = async (): Promise<void> => {
    const id = this.cursoId();
    if (!id) return;
    const updated = await firstValueFrom(this.cursosAdminService.archivar(id));
    this.curso.update((prev) =>
      prev ? { ...prev, estado: updated.estado } : prev,
    );
    this.toast.success('Curso archivado');
  };

  despublicar = async (): Promise<void> => {
    const id = this.cursoId();
    if (!id) return;
    const updated = await firstValueFrom(
      this.cursosAdminService.despublicar(id),
    );
    this.curso.update((prev) =>
      prev ? { ...prev, estado: updated.estado } : prev,
    );
    this.toast.success('Curso devuelto a BORRADOR');
  };

  // ---- Secciones ----

  openAddSeccion(): void {
    this.seccionEditando.set(null);
    this.seccionDialogVisible.set(true);
  }

  openEditSeccion(seccion: Seccion): void {
    this.seccionEditando.set(seccion);
    this.seccionDialogVisible.set(true);
  }

  async onSeccionSaved(result: SeccionFormResult): Promise<void> {
    this.seccionDialogVisible.set(false);
    const id = this.cursoId();
    if (!id) return;
    const editando = this.seccionEditando();
    try {
      if (editando) {
        const updated = await firstValueFrom(
          this.cursosAdminService.updateSeccion(editando.id, {
            titulo: result.titulo,
          }),
        );
        this.curso.update((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            secciones: prev.secciones.map((s) =>
              s.id === updated.id ? { ...s, ...updated } : s,
            ),
          };
        });
      } else {
        const created = await firstValueFrom(
          this.cursosAdminService.createSeccion(id, {
            titulo: result.titulo,
          }),
        );
        this.curso.update((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            secciones: [...prev.secciones, { ...created, lecciones: [] }],
          };
        });
      }
      this.toast.success('Sección guardada');
    } catch {
      // handleError shows toast
    }
  }

  deleteSeccion(seccion: Seccion): void {
    this.confirmation.confirm({
      header: 'Eliminar sección',
      message: `¿Eliminar la sección "${seccion.titulo}"? Se eliminarán también todas sus lecciones.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDeleteSeccion(seccion),
      reject: () => {
        /* no-op */
      },
    });
  }

  private async doDeleteSeccion(seccion: Seccion): Promise<void> {
    try {
      await firstValueFrom(this.cursosAdminService.deleteSeccion(seccion.id));
      this.curso.update((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          secciones: prev.secciones.filter((s) => s.id !== seccion.id),
        };
      });
      this.toast.success('Sección eliminada');
    } catch {
      // handleError shows toast
    }
  }

  async moveSeccionUp(index: number): Promise<void> {
    if (index === 0) return;
    await this.swapSecciones(index, index - 1);
  }

  async moveSeccionDown(index: number): Promise<void> {
    const secciones = this.curso()?.secciones ?? [];
    if (index >= secciones.length - 1) return;
    await this.swapSecciones(index, index + 1);
  }

  private async swapSecciones(i: number, j: number): Promise<void> {
    const prev = this.curso();
    if (!prev) return;
    const secciones = [...prev.secciones];
    [secciones[i], secciones[j]] = [secciones[j], secciones[i]];
    const reordered = secciones.map((s, idx) => ({ ...s, orden: idx }));
    this.curso.set({ ...prev, secciones: reordered });
    try {
      await firstValueFrom(
        this.cursosAdminService.reorderSecciones(
          reordered.map((s) => ({ id: s.id, orden: s.orden })),
        ),
      );
    } catch {
      this.curso.set(prev);
    }
  }

  /** Drag-and-drop de secciones (CDK). Reusa la persistencia de reorder. */
  async dropSeccion(event: CdkDragDrop<Seccion[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const prev = this.curso();
    if (!prev) return;
    const secciones = [...prev.secciones];
    moveItemInArray(secciones, event.previousIndex, event.currentIndex);
    const reordered = secciones.map((s, idx) => ({ ...s, orden: idx }));
    this.curso.set({ ...prev, secciones: reordered });
    try {
      await firstValueFrom(
        this.cursosAdminService.reorderSecciones(
          reordered.map((s) => ({ id: s.id, orden: s.orden })),
        ),
      );
    } catch {
      this.curso.set(prev);
    }
  }

  // ---- Lecciones ----

  openAddLeccion(seccion: Seccion): void {
    this.leccionEditando.set(null);
    this.leccionSeccionId.set(seccion.id);
    this.leccionDialogVisible.set(true);
  }

  openEditLeccion(leccion: Leccion, seccion: Seccion): void {
    this.leccionEditando.set(leccion);
    this.leccionSeccionId.set(seccion.id);
    this.leccionDialogVisible.set(true);
  }

  async onLeccionSaved(result: LeccionFormResult): Promise<void> {
    this.leccionDialogVisible.set(false);
    const seccionId = this.leccionSeccionId();
    if (!seccionId) return;
    const editando = this.leccionEditando();
    try {
      if (editando) {
        // Consolidación: la lección solo lleva título/orden; el contenido vive
        // en los bloques ("Contenido").
        const updatePayload: LeccionUpdatePayload = {
          titulo: result.titulo,
        };
        const updated = await firstValueFrom(
          this.cursosAdminService.updateLeccion(editando.id, updatePayload),
        );
        this.updateLeccionInState(updated);
      } else {
        const createPayload: LeccionCreatePayload = {
          titulo: result.titulo,
        };
        const created = await firstValueFrom(
          this.cursosAdminService.createLeccion(seccionId, createPayload),
        );
        this.curso.update((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            secciones: prev.secciones.map((s) =>
              s.id === seccionId
                ? { ...s, lecciones: [...s.lecciones, created] }
                : s,
            ),
          };
        });
      }
      this.toast.success('Lección guardada');
    } catch {
      // handleError shows toast
    }
  }

  private updateLeccionInState(updated: Leccion): void {
    this.curso.update((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        secciones: prev.secciones.map((s) => ({
          ...s,
          lecciones: s.lecciones.map((l) =>
            l.id === updated.id ? { ...l, ...updated } : l,
          ),
        })),
      };
    });
  }

  deleteLeccion(leccion: Leccion): void {
    this.confirmation.confirm({
      header: 'Eliminar lección',
      message: `¿Eliminar la lección "${leccion.titulo}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDeleteLeccion(leccion),
      reject: () => {
        /* no-op */
      },
    });
  }

  private async doDeleteLeccion(leccion: Leccion): Promise<void> {
    try {
      await firstValueFrom(this.cursosAdminService.deleteLeccion(leccion.id));
      this.curso.update((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          secciones: prev.secciones.map((s) => ({
            ...s,
            lecciones: s.lecciones.filter((l) => l.id !== leccion.id),
          })),
        };
      });
      this.toast.success('Lección eliminada');
    } catch {
      // handleError shows toast
    }
  }

  async moveLeccionUp(seccion: Seccion, index: number): Promise<void> {
    if (index === 0) return;
    await this.swapLecciones(seccion, index, index - 1);
  }

  async moveLeccionDown(seccion: Seccion, index: number): Promise<void> {
    if (index >= seccion.lecciones.length - 1) return;
    await this.swapLecciones(seccion, index, index + 1);
  }

  private async swapLecciones(
    seccion: Seccion,
    i: number,
    j: number,
  ): Promise<void> {
    const prev = this.curso();
    if (!prev) return;
    const lecciones = [...seccion.lecciones];
    [lecciones[i], lecciones[j]] = [lecciones[j], lecciones[i]];
    const reordered = lecciones.map((l, idx) => ({ ...l, orden: idx }));
    const newSecciones = prev.secciones.map((s) =>
      s.id === seccion.id ? { ...s, lecciones: reordered } : s,
    );
    this.curso.set({ ...prev, secciones: newSecciones });
    try {
      await firstValueFrom(
        this.cursosAdminService.reorderLecciones(
          reordered.map((l) => ({ id: l.id, orden: l.orden })),
        ),
      );
    } catch {
      this.curso.set(prev);
    }
  }

  /**
   * Drag-and-drop de lecciones DENTRO de una sección (CDK). El reorder
   * cross-sección no se soporta (cada sección es su propia lista). Reusa la
   * persistencia de reorderLecciones.
   */
  async dropLeccion(
    event: CdkDragDrop<Leccion[]>,
    seccion: Seccion,
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const prev = this.curso();
    if (!prev) return;
    const lecciones = [...seccion.lecciones];
    moveItemInArray(lecciones, event.previousIndex, event.currentIndex);
    const reordered = lecciones.map((l, idx) => ({ ...l, orden: idx }));
    const newSecciones = prev.secciones.map((s) =>
      s.id === seccion.id ? { ...s, lecciones: reordered } : s,
    );
    this.curso.set({ ...prev, secciones: newSecciones });
    try {
      await firstValueFrom(
        this.cursosAdminService.reorderLecciones(
          reordered.map((l) => ({ id: l.id, orden: l.orden })),
        ),
      );
    } catch {
      this.curso.set(prev);
    }
  }

  // ---- Bloques (contenido de la lección) ----

  openBloques(leccion: Leccion): void {
    this.bloquesLeccion.set(leccion);
    this.bloquesDialogVisible.set(true);
  }

  /**
   * El diálogo de bloques persiste sus propios cambios (create/update/delete/
   * reorder) y emite la pila resultante. Aquí solo refrescamos el estado local
   * para que el contador "N bloques" y la próxima apertura del diálogo estén
   * sincronizados, sin recargar el curso entero.
   */
  onBloquesChanged(bloques: Bloque[]): void {
    const leccion = this.bloquesLeccion();
    if (!leccion) return;
    this.curso.update((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        secciones: prev.secciones.map((s) => ({
          ...s,
          lecciones: s.lecciones.map((l) =>
            l.id === leccion.id ? { ...l, bloques } : l,
          ),
        })),
      };
    });
    // Mantener el input del diálogo en sync con la pila ya persistida.
    this.bloquesLeccion.update((l) => (l ? { ...l, bloques } : l));
  }

  estadoSeverity(estado: EstadoCurso): TagSeverity {
    const map: Record<EstadoCurso, TagSeverity> = {
      BORRADOR: 'warning',
      PUBLICADO: 'success',
      ARCHIVADO: 'secondary',
    };
    return map[estado];
  }
}
