import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { CursosAdminService } from '../services/cursos-admin.service';
import {
  Curso,
  CursoDetail,
  EstadoCurso,
  Leccion,
  Seccion,
} from '../models/curso.model';
import {
  SeccionFormDialogComponent,
  SeccionFormResult,
} from './seccion-form-dialog.component';
import {
  LeccionFormDialogComponent,
  LeccionFormResult,
} from './leccion-form-dialog.component';

type TagSeverity =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'secondary'
  | 'contrast'
  | undefined;

@Component({
  selector: 'app-curso-admin-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    TabViewModule,
    TagModule,
    DividerModule,
    SeccionFormDialogComponent,
    LeccionFormDialogComponent,
  ],
  templateUrl: './curso-admin-edit.component.html',
  styleUrl: './curso-admin-edit.component.scss',
})
export class CursoAdminEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private cursosAdminService = inject(CursosAdminService);
  private toast = inject(ToastrService);

  cursoId = signal<number | null>(null);
  curso = signal<CursoDetail | null>(null);
  loading = signal(true);
  saving = signal(false);
  publishing = signal(false);

  // Estado computado para el toolbar
  esNuevo = computed(() => this.cursoId() === null);
  estadoCurso = computed(() => this.curso()?.estado ?? null);

  // Sección dialogs
  seccionDialogVisible = signal(false);
  seccionEditando = signal<Seccion | null>(null);
  seccionParentCursoId = signal<number | null>(null);

  // Lección dialogs
  leccionDialogVisible = signal(false);
  leccionEditando = signal<Leccion | null>(null);
  leccionSeccionId = signal<number | null>(null);

  // Acceso
  usuarioIdAccesoValue: number | null = null;
  granting = signal(false);

  metadataForm = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', Validators.required],
    descripcion: [''],
    precio: [null as number | null],
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
        precio: data.precio ?? null,
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

  async saveMetadata(): Promise<void> {
    if (this.metadataForm.invalid) return;
    this.saving.set(true);
    const raw = this.metadataForm.getRawValue();
    try {
      const id = this.cursoId();
      if (id) {
        const updated = await firstValueFrom(
          this.cursosAdminService.update(id, {
            titulo: raw.titulo ?? undefined,
            descripcion: raw.descripcion ?? undefined,
            precio: raw.precio ?? undefined,
            thumbnailUrl: raw.thumbnailUrl ?? undefined,
            duracionEstimadaMinutos: raw.duracionEstimadaMinutos ?? undefined,
          }),
        );
        this.curso.update((prev) => (prev ? { ...prev, ...updated } : prev));
        this.toast.success('Metadatos guardados correctamente');
      } else {
        // Create new
        const created = await firstValueFrom(
          this.cursosAdminService.create({
            titulo: raw.titulo ?? '',
            slug: raw.slug ?? '',
            descripcion: raw.descripcion ?? undefined,
            precio: raw.precio ?? undefined,
            thumbnailUrl: raw.thumbnailUrl ?? undefined,
            duracionEstimadaMinutos: raw.duracionEstimadaMinutos ?? undefined,
          }),
        );
        this.toast.success('Curso creado correctamente');
        this.router.navigate(['/app/cursos-admin', created.id]);
      }
    } catch {
      // handleError shows toast
    } finally {
      this.saving.set(false);
    }
  }

  async publicar(): Promise<void> {
    const id = this.cursoId();
    if (!id) return;
    this.publishing.set(true);
    try {
      const updated = await firstValueFrom(
        this.cursosAdminService.publicar(id),
      );
      this.curso.update((prev) =>
        prev ? { ...prev, estado: updated.estado } : prev,
      );
      this.toast.success('Curso publicado');
    } catch {
    } finally {
      this.publishing.set(false);
    }
  }

  async archivar(): Promise<void> {
    const id = this.cursoId();
    if (!id) return;
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.cursosAdminService.archivar(id),
      );
      this.curso.update((prev) =>
        prev ? { ...prev, estado: updated.estado } : prev,
      );
      this.toast.success('Curso archivado');
    } catch {
    } finally {
      this.saving.set(false);
    }
  }

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
            orden: result.orden,
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
            orden: result.orden,
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

  async deleteSeccion(seccion: Seccion): Promise<void> {
    if (
      !confirm(
        `¿Eliminar la sección "${seccion.titulo}"? Se eliminarán todas sus lecciones.`,
      )
    )
      return;
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
        const updated = await firstValueFrom(
          this.cursosAdminService.updateLeccion(editando.id, {
            titulo: result.titulo,
            orden: result.orden,
            bunnyVideoId: result.bunnyVideoId,
            duracionSegundos: result.duracionSegundos,
            testPlantillaId: result.testPlantillaId,
            mazoFlashcardsId: result.mazoFlashcardsId,
            contenidoMarkdown: result.contenidoMarkdown,
          }),
        );
        this.updateLeccionInState(updated);
      } else {
        const created = await firstValueFrom(
          this.cursosAdminService.createLeccion(seccionId, {
            titulo: result.titulo,
            orden: result.orden,
            tipo: result.tipo as never,
            bunnyVideoId: result.bunnyVideoId,
            duracionSegundos: result.duracionSegundos,
            testPlantillaId: result.testPlantillaId,
            mazoFlashcardsId: result.mazoFlashcardsId,
            contenidoMarkdown: result.contenidoMarkdown,
          }),
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

  async deleteLeccion(leccion: Leccion): Promise<void> {
    if (!confirm(`¿Eliminar la lección "${leccion.titulo}"?`)) return;
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

  // ---- Acceso ----

  async grantAccess(): Promise<void> {
    const id = this.cursoId();
    const usuarioId = this.usuarioIdAccesoValue;
    if (!id || !usuarioId) {
      this.toast.warning('Introduce un ID de usuario válido');
      return;
    }
    this.granting.set(true);
    try {
      await firstValueFrom(this.cursosAdminService.grantAccess(id, usuarioId));
      this.toast.success(`Acceso concedido al usuario ${usuarioId}`);
      this.usuarioIdAccesoValue = null;
    } catch {
      // handleError shows toast
    } finally {
      this.granting.set(false);
    }
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
