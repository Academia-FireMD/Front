import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TestModule } from '../../test/test.module';

interface NoFailedQuestionsPayload {
  message: string;
  reason: 'NO_FAILED_QUESTIONS';
}

/**
 * Bloque TEST embebido en el aula (decisión lockada: TEST inline, no redirect).
 * Aísla el import de `TestModule` (que arrastra el motor de tests) a este único
 * componente standalone para que `bloque-render` no cargue todo TestModule.
 *
 * Flujo: tarjeta "Iniciar test" → POST /bloques/:id/iniciar-test → embebe
 * `<app-completar-test [embedded]>` con el testId; al finalizar, el motor emite
 * `finalizado` (no navega fuera) y mostramos un resumen inline con accesos a
 * ver resultados / repetir.
 */
@Component({
  selector: 'app-bloque-test-inline',
  standalone: true,
  imports: [ButtonModule, TestModule],
  templateUrl: './bloque-test-inline.component.html',
  styleUrl: './bloque-test-inline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueTestInlineComponent {
  readonly bloqueId = input.required<number>();
  readonly numPreguntas = input<number | null | undefined>(null);
  readonly esDeRepaso = input<boolean | undefined>(false);
  /** En preview admin no se llama al backend. */
  readonly preview = input<boolean>(false);

  /** Emite cuando el alumno termina el test (para auto-marcar la lección). */
  readonly completado = output<void>();

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastrService);

  readonly starting = signal(false);
  readonly startedTestId = signal<number | null>(null);
  readonly completed = signal(false);
  readonly noFailedQuestions = signal<NoFailedQuestionsPayload | null>(null);

  async iniciarTest(): Promise<void> {
    if (this.preview()) {
      this.toast.info('Vista previa — la acción no se ejecuta.');
      return;
    }
    this.starting.set(true);
    this.noFailedQuestions.set(null);
    try {
      const test = await firstValueFrom(
        this.http.post<{ id: number }>(
          `${environment.apiUrl}/bloques/${this.bloqueId()}/iniciar-test`,
          {},
          { withCredentials: true },
        ),
      );
      this.completed.set(false);
      this.startedTestId.set(test.id);
    } catch (err) {
      this.handleError(err as HttpErrorResponse);
    } finally {
      this.starting.set(false);
    }
  }

  onFinalizado(): void {
    this.completed.set(true);
    if (!this.preview()) this.completado.emit();
  }

  verResultados(): void {
    const id = this.startedTestId();
    if (id != null) {
      this.router.navigate(['/app/test/alumno/stats-test', id]);
    }
  }

  repetir(): Promise<void> {
    this.startedTestId.set(null);
    this.completed.set(false);
    return this.iniciarTest();
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
