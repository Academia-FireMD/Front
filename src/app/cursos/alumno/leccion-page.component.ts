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
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LeccionFlashcardsComponent } from './leccion-flashcards.component';
import { LeccionResponse } from '../models/curso.model';
import { LeccionTestComponent } from './leccion-test.component';
import { LeccionTextoComponent } from './leccion-texto.component';
import { LeccionVideoComponent } from './leccion-video.component';
import { CursosAlumnoService } from '../services/cursos-alumno.service';

/**
 * Refactor 2026-05-25 (T12 / T13 / D4):
 *  - Acepta `previewData` para que el admin renderice una lección desde el
 *    form sin fetch HTTP ni AccesoCurso check. Banner siempre visible en preview.
 *  - Para TEST/FLASHCARDS, delega en `<app-leccion-test>` / `<app-leccion-flashcards>`
 *    que llaman al endpoint `iniciar-test`/`iniciar-flashcards` del backend.
 *
 * HIGH-4 (codex review): el modo preview requiere `previewMode=true`. Si
 * solo se pasa `previewData` sin `previewMode`, el componente hace fetch
 * normal (con AccesoCurso check del backend).
 */
@Component({
  selector: 'app-leccion-page',
  standalone: true,
  imports: [
    ButtonModule,
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

  /**
   * Datos pre-construidos para preview. Solo se usan si `previewMode=true`.
   */
  readonly previewData = input<LeccionResponse | null>(null);
  /**
   * HIGH-4 (codex review): opt-in explícito. Sin `previewMode=true`,
   * `previewData` se ignora y se hace el fetch HTTP normal con AccesoCurso.
   */
  readonly previewMode = input<boolean>(false);

  leccionData = signal<LeccionResponse | null>(null);
  loading = signal(true);
  error = signal(false);

  readonly isPreview = computed(
    () => this.previewMode() && this.previewData() !== null,
  );

  constructor() {
    // `allowSignalWrites: true` — Angular 18 prohibe writes a signals dentro
    // de effects por default; aquí necesitamos sincronizar el input
    // (previewData) con el signal local (leccionData).
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
    if (this.isPreview()) {
      // effect ya cubre.
      return;
    }
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (isNaN(id)) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }
    this.service.getLeccion(id).subscribe({
      next: (data) => {
        this.leccionData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/app/cursos', this.slug]);
  }
}
