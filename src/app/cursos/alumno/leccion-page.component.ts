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
import { forkJoin, Subscription } from 'rxjs';
import {
  APLICACION_CODIGO_HIDRAULICA,
  Bloque,
  CursoSlugResponse,
  Leccion,
  LeccionResponse,
  ProgresoLeccion,
} from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { HidraulicaSyncEstado } from '../services/hidraulica-interactivo.service';
import { AuthService } from '../../services/auth.service';
import { AplicacionWorkspaceComponent } from './aplicacion-workspace.component';
import { AulaInmersivaService } from '../ui/aula-inmersiva.service';
import { esLeccionAplicacionValida } from '../ui/curso-cta.util';
import { CurriculumSidebarComponent } from '../ui/curriculum-sidebar.component';
import { LeccionShellComponent } from '../ui/leccion-shell.component';
import { estaCompletada, leccionesPlanas } from '../ui/progreso.util';
import { BloqueRenderComponent } from './bloque-render.component';
import { LeccionFlashcardsComponent } from './leccion-flashcards.component';
import { LeccionTestComponent } from './leccion-test.component';
import { LeccionTextoComponent } from './leccion-texto.component';
import { LeccionVideoComponent } from './leccion-video.component';

/**
 * Filtra la pila para que el aula tenga UN único contexto de aplicación
 * interactiva por lección. El caso de dos bloques HIDRAULICA está permitido en
 * admin/CRUD, pero dos iframes con la misma cuenta+lección competirían por el
 * mismo estado (snapshots/GET null). Se conserva el primer bloque
 * INTERACTIVO/HIDRAULICA y TODOS los demás bloques en su orden original.
 */
export function filtrarBloquesRenderizables(
  bloques: readonly Bloque[],
): Bloque[] {
  let aplicacionVista = false;
  const salida: Bloque[] = [];
  for (const bloque of bloques) {
    const esAplicacionHidraulica =
      bloque.tipo === 'INTERACTIVO' &&
      bloque.aplicacionCodigo === APLICACION_CODIGO_HIDRAULICA;
    if (esAplicacionHidraulica) {
      if (aplicacionVista) continue;
      aplicacionVista = true;
    }
    salida.push(bloque);
  }
  return salida;
}

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
    AplicacionWorkspaceComponent,
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
  private readonly inmersiva = inject(AulaInmersivaService);
  private readonly auth = inject(AuthService);

  readonly previewData = input<LeccionResponse | null>(null);
  readonly previewMode = input<boolean>(false);

  cursoData = signal<CursoSlugResponse | null>(null);
  leccionData = signal<LeccionResponse | null>(null);
  progreso = signal<ProgresoLeccion[]>([]);
  loading = signal(true);
  error = signal(false);
  marcando = signal(false);

  /** Estado de sync que pinta la cabecera nativa del workspace inmersivo. */
  readonly syncEstado = signal<HidraulicaSyncEstado>('loading');
  readonly syncTexto = signal('Cargando aplicación…');
  readonly puedeReintentar = signal(false);
  /** Contador para reintentar el bloque sin recrear iframe/contexto. */
  readonly reintentoApp = signal(0);

  private loadedSlug: string | null = null;
  /** Única carga vigente: se cancela/ignora al cambiar de ruta o destruir. */
  private cargaSub: Subscription | null = null;
  private cargaGeneracion = 0;
  private destruido = false;

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
  /**
   * Pila que realmente renderiza el aula. Solo se omite el segundo (y
   * posteriores) INTERACTIVO/HIDRAULICA de la misma lección: un único iframe y
   * un único progreso por aplicación. El resto conserva su orden.
   */
  readonly bloquesRenderizables = computed(() =>
    filtrarBloquesRenderizables(this.bloques()),
  );
  readonly playbackUrls = computed(
    () => this.leccionData()?.playbackUrls ?? {},
  );

  /** Curso en presentación APLICACION (default ESTANDAR si el campo falta). */
  readonly esModoAplicacion = computed(
    () => this.cursoData()?.curso.modoPresentacion === 'APLICACION',
  );
  readonly leccionEntradaId = computed(
    () => this.cursoData()?.curso.leccionAplicacionId ?? null,
  );
  /**
   * Layout inmersivo SOLO si el curso es APLICACION, la lección activa es
   * exactamente su entrada y su pila real es una única aplicación aprobada.
   * Cualquier otra lección (intro/estándar/mixta) conserva el aula nativa.
   */
  readonly esAplicacionInmersiva = computed(() => {
    if (this.isPreview() || this.loading() || this.error()) return false;
    if (!this.esModoAplicacion()) return false;
    const entrada = this.leccionEntradaId();
    const activa = this.leccionActivaId();
    if (entrada == null || activa == null || entrada !== activa) return false;
    const leccion = this.leccionData()?.leccion;
    return leccion != null && esLeccionAplicacionValida(leccion);
  });

  /**
   * Lección sin contenido: ni bloques ni campos legacy. Pasa con lecciones
   * recién creadas como contenedor (consolidación) a las que el admin aún no
   * ha añadido bloques. El aula muestra un estado vacío amable en vez del
   * render legacy en blanco.
   */
  readonly leccionVacia = computed(() => {
    if (this.bloques().length > 0) return false;
    const l = this.leccionData()?.leccion;
    const url = this.leccionData()?.playbackUrl;
    if (!l) return false;
    return !l.contenidoMarkdown && !l.bunnyVideoId && !url && l.temaId == null;
  });

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

    // El layout inmersivo es temporal y reactivo al estado real del aula:
    // loading/error/otra lección/destrucción lo liberan inmediatamente.
    effect(
      () => {
        if (this.esAplicacionInmersiva()) this.inmersiva.activar();
        else this.inmersiva.desactivar();
      },
      { allowSignalWrites: true },
    );
    this.destroyRef.onDestroy(() => this.inmersiva.desactivar());
    this.auth.currentIdentity$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((identidad) => {
        if (!identidad) this.inmersiva.desactivar();
      });
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

        // Cancelar/ignorar SIEMPRE la carga anterior, también con params
        // inválidos: una respuesta vieja no puede pisar la ruta vigente.
        this.cancelarCarga();
        this.error.set(false);
        this.loading.set(true);

        if (isNaN(id) || !slug) {
          this.limpiarContenido();
          this.loading.set(false);
          this.error.set(true);
          return;
        }
        this.cargar(slug, id);
      });

    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      this.cancelarCarga();
    });
  }

  private cargar(slug: string, id: number): void {
    this.loading.set(true);
    this.error.set(false);
    const generacion = this.cargaGeneracion;

    // El árbol del curso solo se recarga si cambia el slug.
    if (this.loadedSlug === slug && this.cursoData()) {
      this.cargaSub = this.service.getLeccion(id).subscribe({
        next: (lec) => {
          if (!this.esCargaVigente(generacion)) return;
          this.leccionData.set(lec);
          this.loading.set(false);
        },
        error: () => {
          if (!this.esCargaVigente(generacion)) return;
          this.fallo();
        },
      });
      return;
    }

    this.cargaSub = forkJoin({
      curso: this.service.getCurso(slug),
      leccion: this.service.getLeccion(id),
    }).subscribe({
      next: ({ curso, leccion }) => {
        if (!this.esCargaVigente(generacion)) return;
        this.loadedSlug = slug;
        this.cursoData.set(curso);
        this.progreso.set(curso.progreso ?? []);
        this.leccionData.set(leccion);
        this.loading.set(false);
      },
      error: () => {
        if (!this.esCargaVigente(generacion)) return;
        this.fallo();
      },
    });
  }

  /** Invalida y cancela la carga en vuelo antes de cada emisión de paramMap. */
  private cancelarCarga(): void {
    this.cargaGeneracion += 1;
    this.cargaSub?.unsubscribe();
    this.cargaSub = null;
    this.loading.set(false);
  }

  private esCargaVigente(generacion: number): boolean {
    return !this.destruido && generacion === this.cargaGeneracion;
  }

  private limpiarContenido(): void {
    this.loadedSlug = null;
    this.cursoData.set(null);
    this.leccionData.set(null);
    this.progreso.set([]);
  }

  private fallo(): void {
    this.loading.set(false);
    this.error.set(true);
  }

  irALeccion(leccion: Leccion): void {
    this.router.navigate(['/app/cursos', this.slug, 'leccion', leccion.id]);
  }

  /** Cabecera inmersiva: refleja el estado real del puente (loading/saving/...). */
  onSyncAplicacion(evento: {
    estado: HidraulicaSyncEstado;
    texto: string;
    puedeReintentar: boolean;
  }): void {
    this.syncEstado.set(evento.estado);
    this.syncTexto.set(evento.texto);
    this.puedeReintentar.set(evento.puedeReintentar);
  }

  reintentarAplicacion(): void {
    this.reintentoApp.update((n) => n + 1);
  }

  onSeleccionarAplicacion(leccion: Leccion): void {
    this.irALeccion(leccion);
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

  /**
   * Auto-marca la lección al terminar un bloque interactivo (TEST/CUESTIONARIO).
   * Persiste el progreso al 100% y actualiza el sidebar SIN auto-avanzar (el
   * alumno suele querer revisar el resultado). Idempotente: no hace nada si la
   * lección ya está completada ni en preview.
   */
  onBloqueCompletado(): void {
    if (this.isPreview()) return;
    const id = this.leccionActivaId();
    if (id == null || this.completadaActiva()) return;
    this.service
      .upsertProgreso(id, {
        segundosVisto: 0,
        porcentajeVisto: 100,
        completada: true,
      })
      .subscribe({
        next: () => {
          this.aplicarCompletadaLocal(id);
          this.toast.success('Lección completada');
        },
        // Silencioso: el footer "Marcar completada" sigue disponible como red.
        error: () => undefined,
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
