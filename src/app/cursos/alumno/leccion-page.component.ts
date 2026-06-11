import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { forkJoin } from 'rxjs';
import {
  CursoSlugResponse,
  Leccion,
  LeccionResponse,
  ProgresoLeccion,
} from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CurriculumSidebarComponent } from '../ui/curriculum-sidebar.component';
import { LeccionShellComponent } from '../ui/leccion-shell.component';
import { estaCompletada, leccionesPlanas } from '../ui/progreso.util';
import { BloqueRenderComponent } from './bloque-render.component';
import { LeccionFlashcardsComponent } from './leccion-flashcards.component';
import { LeccionTestComponent } from './leccion-test.component';
import { LeccionTextoComponent } from './leccion-texto.component';
import { LeccionVideoComponent } from './leccion-video.component';

/**
 * Aula del alumno. Reescrita 2026-06-10: layout de 2 columnas (currículum +
 * contenido) con navegación anterior/siguiente, "marcar completada" y progreso.
 * Carga el árbol del curso (GET /cursos/:slug, con progreso) para el sidebar y
 * la lección activa (GET /lecciones/:id) para el reproductor.
 *
 * Preview admin (previewMode=true): renderiza SOLO el contenido de la lección
 * (sin el chrome del aula) usando previewData, sin fetch ni AccesoCurso check.
 */
@Component({
  selector: 'app-leccion-page',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ButtonModule,
    LeccionShellComponent,
    CurriculumSidebarComponent,
    BloqueRenderComponent,
    LeccionVideoComponent,
    LeccionTextoComponent,
    LeccionTestComponent,
    LeccionFlashcardsComponent,
  ],
  templateUrl: './leccion-page.component.html',
  styleUrl: './leccion-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastrService);
  private readonly destroyRef = inject(DestroyRef);

  readonly previewData = input<LeccionResponse | null>(null);
  readonly previewMode = input<boolean>(false);

  cursoData = signal<CursoSlugResponse | null>(null);
  leccionData = signal<LeccionResponse | null>(null);
  progreso = signal<ProgresoLeccion[]>([]);
  loading = signal(true);
  error = signal(false);
  marcando = signal(false);

  private loadedSlug: string | null = null;

  readonly isPreview = computed(
    () => this.previewMode() && this.previewData() !== null,
  );

  readonly secciones = computed(() => this.cursoData()?.curso.secciones ?? []);
  readonly tituloCurso = computed(() => this.cursoData()?.curso.titulo ?? '');
  readonly leccionActivaId = computed(
    () => this.leccionData()?.leccion.id ?? null,
  );
  readonly tituloLeccion = computed(
    () => this.leccionData()?.leccion.titulo ?? '',
  );
  readonly completadaActiva = computed(() => {
    const id = this.leccionActivaId();
    return id != null && estaCompletada(id, this.progreso());
  });

  /** Bloques de la lección (pila). Vacío → lección legacy (render por tipo). */
  readonly bloques = computed(() => this.leccionData()?.leccion.bloques ?? []);
  readonly playbackUrls = computed(
    () => this.leccionData()?.playbackUrls ?? {},
  );

  constructor() {
    effect(
      () => {
        if (!this.previewMode()) return;
        const preview = this.previewData();
        if (preview) {
          this.leccionData.set(preview);
          this.loading.set(false);
          this.error.set(false);
        }
      },
      { allowSignalWrites: true },
    );
  }

  get slug(): string {
    return this.route.snapshot.paramMap.get('slug') ?? '';
  }

  ngOnInit(): void {
    if (this.isPreview()) return;

    // Reaccionar a cambios de :id (navegación anterior/siguiente reusa el
    // componente sin re-ejecutar ngOnInit) recargando la lección y, si cambia
    // el curso, el árbol completo.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const slug = params.get('slug') ?? '';
        const idParam = params.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (isNaN(id) || !slug) {
          this.error.set(true);
          this.loading.set(false);
          return;
        }
        this.cargar(slug, id);
      });
  }

  private cargar(slug: string, id: number): void {
    this.loading.set(true);
    this.error.set(false);

    // El árbol del curso solo se recarga si cambia el slug.
    if (this.loadedSlug === slug && this.cursoData()) {
      this.service.getLeccion(id).subscribe({
        next: (lec) => {
          this.leccionData.set(lec);
          this.loading.set(false);
        },
        error: () => this.fallo(),
      });
      return;
    }

    forkJoin({
      curso: this.service.getCurso(slug),
      leccion: this.service.getLeccion(id),
    }).subscribe({
      next: ({ curso, leccion }) => {
        this.loadedSlug = slug;
        this.cursoData.set(curso);
        this.progreso.set(curso.progreso ?? []);
        this.leccionData.set(leccion);
        this.loading.set(false);
      },
      error: () => this.fallo(),
    });
  }

  private fallo(): void {
    this.loading.set(false);
    this.error.set(true);
  }

  irALeccion(leccion: Leccion): void {
    this.router.navigate(['/app/cursos', this.slug, 'leccion', leccion.id]);
  }

  volver(): void {
    this.router.navigate(['/app/cursos', this.slug]);
  }

  /**
   * Control único de completitud del aula (footer del shell). Funciona para
   * cualquier tipo de lección: persiste progreso al 100%, actualiza el sidebar
   * de forma optimista y auto-avanza a la siguiente lección si existe.
   */
  marcarCompletada(): void {
    const id = this.leccionActivaId();
    if (id == null || this.marcando()) return;
    this.marcando.set(true);
    this.service
      .upsertProgreso(id, {
        segundosVisto: 0,
        porcentajeVisto: 100,
        completada: true,
      })
      .subscribe({
        next: () => {
          this.marcando.set(false);
          this.aplicarCompletadaLocal(id);
          this.toast.success('Lección completada');
          this.autoAvanzar(id);
        },
        error: () => {
          this.marcando.set(false);
          this.toast.error(
            'No se pudo guardar el progreso, inténtalo de nuevo.',
          );
        },
      });
  }

  /** Marca la lección como completada en el progreso local (sin refetch). */
  private aplicarCompletadaLocal(leccionId: number): void {
    this.progreso.update((prev) => {
      const existe = prev.find((p) => p.leccionId === leccionId);
      if (existe) {
        return prev.map((p) =>
          p.leccionId === leccionId
            ? { ...p, completada: true, porcentajeVisto: 100 }
            : p,
        );
      }
      return [
        ...prev,
        {
          id: -leccionId, // placeholder local-only
          leccionId,
          usuarioId: 0,
          segundosVisto: 0,
          porcentajeVisto: 100,
          completada: true,
        },
      ];
    });
  }

  private autoAvanzar(actualId: number): void {
    const planas = leccionesPlanas({ secciones: this.secciones() });
    const idx = planas.findIndex((l) => l.id === actualId);
    const siguiente =
      idx >= 0 && idx < planas.length - 1 ? planas[idx + 1] : null;
    if (siguiente) this.irALeccion(siguiente);
  }
}
