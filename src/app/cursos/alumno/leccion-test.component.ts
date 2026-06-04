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
 * Refactor 2026-05-25 (T13): inicia un Test desde una lección TEST.
 *  - Backend crea el Test (con sobreescribir=true) y devuelve `{ id, ... }`.
 *  - Redirect a `/app/test/alumno/realizar-test/:id` (ruta canónica usada en
 *    todo el resto de la app).
 *  - 422 con `reason='NO_FAILED_QUESTIONS'` → screen explanatorio + CTA al
 *    listado de tests del tema (el alumno necesita generar fallos antes).
 *  - 403 → toast + navigate al catálogo (no debería pasar si AccesoCurso
 *    está bien, pero defensive).
 */
@Component({
  selector: 'app-leccion-test',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './leccion-test.component.html',
  styleUrl: './leccion-test.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionTestComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastrService);

  readonly leccion = input.required<Leccion>();
  /** En preview admin NO se debe llamar al backend ni redirigir. */
  readonly preview = input<boolean>(false);

  readonly starting = signal(false);
  readonly noFailedQuestions = signal<NoFailedQuestionsPayload | null>(null);

  async empezarTest(): Promise<void> {
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
          `${environment.apiUrl}/lecciones/${leccionId}/iniciar-test`,
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

  irAlTema(): void {
    const payload = this.noFailedQuestions();
    if (!payload) return;
    // Ruta canónica para generar tests del tema (mismo path que el botón
    // de "tests del tema" en otras pantallas).
    this.router.navigate(['/app/test/alumno/realizar-test'], {
      queryParams: { temaId: payload.temaId },
    });
  }
}
