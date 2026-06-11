import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Bloque } from '../models/curso.model';

interface NoFailedQuestionsPayload {
  message: string;
  reason: 'NO_FAILED_QUESTIONS';
}

/**
 * Renderiza un bloque de la lección en el aula. Un bloque es un widget de
 * contenido; la lección los apila. Tipos:
 *  - VIDEO  → iframe Bunny (sin heartbeat; el progreso es por lección).
 *  - TEXTO  → markdown.
 *  - TEST   → tarjeta con "Iniciar test" (reusa el motor de tests por Tema).
 *  - CUESTIONARIO → placeholder (Fase 2).
 */
@Component({
  selector: 'app-bloque-render',
  standalone: true,
  imports: [ButtonModule, MarkdownComponent],
  templateUrl: './bloque-render.component.html',
  styleUrl: './bloque-render.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueRenderComponent {
  bloque = input.required<Bloque>();
  /** URL firmada del vídeo (solo bloques VIDEO). */
  playbackUrl = input<string | null>(null);
  /** En preview admin no se llama al backend ni se navega. */
  preview = input<boolean>(false);

  private readonly sanitizer = inject(DomSanitizer);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastrService);

  readonly starting = signal(false);
  readonly noFailedQuestions = signal<NoFailedQuestionsPayload | null>(null);

  readonly safeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.playbackUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  async iniciarTest(): Promise<void> {
    if (this.preview()) {
      this.toast.info('Vista previa — la acción no se ejecuta.');
      return;
    }
    const bloqueId = this.bloque().id;
    this.starting.set(true);
    this.noFailedQuestions.set(null);
    try {
      const test = await firstValueFrom(
        this.http.post<{ id: number }>(
          `${environment.apiUrl}/bloques/${bloqueId}/iniciar-test`,
          {},
          { withCredentials: true },
        ),
      );
      this.router.navigate(['/app/test/alumno/realizar-test', test.id]);
    } catch (err) {
      this.handleError(err as HttpErrorResponse);
    } finally {
      this.starting.set(false);
    }
  }

  private handleError(err: HttpErrorResponse): void {
    if (err.status === 422 && err.error?.reason === 'NO_FAILED_QUESTIONS') {
      this.noFailedQuestions.set(err.error as NoFailedQuestionsPayload);
      return;
    }
    if (err.status === 403) {
      this.toast.error('Sin acceso a este curso.');
      this.router.navigate(['/app/cursos']);
      return;
    }
    this.toast.error(err.error?.message ?? 'No se ha podido iniciar el test.');
  }
}
