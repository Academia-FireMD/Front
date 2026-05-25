import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CursoSlugResponse, Leccion, TipoLeccion } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';

/**
 * Refactor 2026-05-25 (T12 / D4): acepta input opcional `previewData` para
 * que el admin renderice el curso-detail SIN hacer fetch HTTP ni verificar
 * AccesoCurso. Cuando preview, muestra banner explicativo para evitar
 * false-confidence (parece un alumno pero no lo es).
 *
 * HIGH-4 (codex review): el modo preview requiere un **opt-in explícito**
 * via `previewMode=true`. Si un caller pasa sólo `previewData` por error,
 * el componente NO bypasea el fetch HTTP — comportamiento normal aplica.
 * Esto evita que un consumer accidental active el bypass de AccesoCurso.
 */
@Component({
  selector: 'app-curso-detail-page',
  standalone: true,
  imports: [
    AccordionModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    RouterLink,
    DecimalPipe,
  ],
  templateUrl: './curso-detail-page.component.html',
  styleUrl: './curso-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursoDetailPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * Datos pre-construidos para el preview. Solo se usan si `previewMode=true`.
   * Si el caller pasa `previewData` pero NO `previewMode`, el componente
   * ignora `previewData` y hace el fetch HTTP normal (con AccesoCurso check).
   */
  readonly previewData = input<CursoSlugResponse | null>(null);
  /**
   * HIGH-4 (codex review): opt-in explícito al modo preview. Sin este flag
   * a `true`, `previewData` no activa el bypass de AccesoCurso. Esto evita
   * que un consumer accidental que solo pase `previewData` skipee el check.
   */
  readonly previewMode = input<boolean>(false);

  cursoData = signal<CursoSlugResponse | null>(null);
  loading = signal(true);
  error = signal(false);

  readonly isPreview = computed(
    () => this.previewMode() && this.previewData() !== null,
  );

  tipoIconos: Record<TipoLeccion, string> = {
    VIDEO: 'pi pi-play-circle',
    TEXTO: 'pi pi-file',
    TEST: 'pi pi-question-circle',
    FLASHCARDS: 'pi pi-clone',
  };

  tipoLabels: Record<TipoLeccion, string> = {
    VIDEO: 'Vídeo',
    TEXTO: 'Lectura',
    TEST: 'Test',
    FLASHCARDS: 'Flashcards',
  };

  constructor() {
    // Si llega previewData en runtime (admin lo cambia con toggle), refleja
    // el cambio en el state local. Sirve para re-render sin reinstanciar.
    // Solo aplica si `previewMode=true` (HIGH-4 codex review).
    //
    // `allowSignalWrites: true` — Angular 18 prohibe writes a signals dentro
    // de effects por default; aquí necesitamos sincronizar el input
    // (previewData) con el signal local (cursoData) que el template lee.
    effect(
      () => {
        if (!this.previewMode()) return;
        const preview = this.previewData();
        if (preview) {
          this.cursoData.set(preview);
          this.loading.set(false);
          this.error.set(false);
        }
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit(): void {
    if (this.isPreview()) {
      // El effect arriba ya cubre este caso.
      return;
    }
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.service.getCurso(slug).subscribe({
      next: (data) => {
        this.cursoData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  openLeccion(leccion: Leccion): void {
    if (this.isPreview()) {
      // En modo preview no navegamos; el admin no debería poder pegar
      // navegación encima del form.
      return;
    }
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.router.navigate(['/app/cursos', slug, 'leccion', leccion.id]);
  }

  totalLecciones(): number {
    return (
      this.cursoData()?.curso.secciones?.flatMap((s) => s.lecciones).length ?? 0
    );
  }
}
