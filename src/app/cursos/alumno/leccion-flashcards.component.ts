import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Leccion } from '../models/curso.model';

interface NoFailedQuestionsPayload {
  message: string;
  leccionId: number;
  temaId: number;
  reason: 'NO_FAILED_QUESTIONS';
}

/**
 * Refactor 2026-05-25 (T13): análogo a leccion-test pero contra
 * `/lecciones/:id/iniciar-flashcards` y redirige a
 * `/app/test/alumno/realizar-flash-cards-test/:id` (ruta canónica).
 */
@Component({
  selector: 'app-leccion-flashcards',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './leccion-flashcards.component.html',
  styleUrl: './leccion-flashcards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionFlashcardsComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastrService);

  readonly leccion = input.required<Leccion>();
  readonly preview = input<boolean>(false);

  readonly starting = signal(false);
  readonly noFailedQuestions = signal<NoFailedQuestionsPayload | null>(null);

  async empezar(): Promise<void> {
    if (this.preview()) {
      this.toast.info('Vista previa — la acción no se ejecuta.');
      return;
    }
    const leccionId = this.leccion().id;
    this.starting.set(true);
    this.noFailedQuestions.set(null);
    try {
      const test = await firstValueFrom(
        this.http.post<{ id: number }>(
          `${environment.apiUrl}/lecciones/${leccionId}/iniciar-flashcards`,
          {},
          { withCredentials: true },
        ),
      );
      this.router.navigate([
        '/app/test/alumno/realizar-flash-cards-test',
        test.id,
      ]);
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
    this.toast.error(
      err.error?.message ?? 'No se han podido iniciar las flashcards.',
    );
  }

  irAlTema(): void {
    const payload = this.noFailedQuestions();
    if (!payload) return;
    this.router.navigate(['/app/test/alumno/realizar-flash-cards-test'], {
      queryParams: { temaId: payload.temaId },
    });
  }
}
