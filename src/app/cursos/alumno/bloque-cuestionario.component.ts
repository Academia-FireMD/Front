import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Bloque,
  CuestionarioResultado,
  CuestionarioResultadoItem,
} from '../models/curso.model';

/**
 * Bloque CUESTIONARIO en el aula: quiz propio del bloque, autocorregido. El
 * alumno selecciona una opción por pregunta y pulsa "Corregir"; el backend
 * (que tiene la respuesta correcta, nunca filtrada antes) devuelve aciertos +
 * feedback por pregunta. Stateless: la completitud de la lección va por el
 * footer "Marcar completada".
 */
@Component({
  selector: 'app-bloque-cuestionario',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './bloque-cuestionario.component.html',
  styleUrl: './bloque-cuestionario.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueCuestionarioComponent {
  readonly bloque = input.required<Bloque>();
  /** En preview admin no se llama al backend. */
  readonly preview = input<boolean>(false);

  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastrService);

  /** preguntaId → índice de opción elegida. */
  readonly selecciones = signal<Record<number, number>>({});
  readonly corrigiendo = signal(false);
  readonly resultado = signal<CuestionarioResultado | null>(null);

  readonly preguntas = computed(() => this.bloque().bloquePreguntas ?? []);
  readonly corregido = computed(() => this.resultado() !== null);

  /** Resultado por preguntaId (para pintar feedback junto a cada pregunta). */
  readonly resultadoPorPregunta = computed<
    Record<number, CuestionarioResultadoItem>
  >(() => {
    const res = this.resultado();
    if (!res) return {};
    return Object.fromEntries(res.resultados.map((r) => [r.preguntaId, r]));
  });

  readonly todasRespondidas = computed(() => {
    const sel = this.selecciones();
    return this.preguntas().every((p) => sel[p.id] != null);
  });

  seleccionar(preguntaId: number, opcionIndex: number): void {
    if (this.corregido()) return; // bloqueado tras corregir
    this.selecciones.update((prev) => ({ ...prev, [preguntaId]: opcionIndex }));
  }

  estaSeleccionada(preguntaId: number, opcionIndex: number): boolean {
    return this.selecciones()[preguntaId] === opcionIndex;
  }

  /** Clase de la opción tras corregir: correcta / fallada / neutra. */
  claseOpcion(preguntaId: number, opcionIndex: number): string {
    const res = this.resultadoPorPregunta()[preguntaId];
    if (!res) return '';
    if (opcionIndex === res.respuestaCorrecta) return 'opcion--correcta';
    if (opcionIndex === res.opcionElegida && !res.correcta)
      return 'opcion--fallada';
    return '';
  }

  async corregir(): Promise<void> {
    if (this.preview()) {
      this.toast.info('Vista previa — la corrección no se ejecuta.');
      return;
    }
    if (!this.todasRespondidas()) {
      this.toast.warning('Responde todas las preguntas antes de corregir.');
      return;
    }
    const sel = this.selecciones();
    const respuestas = this.preguntas().map((p) => ({
      preguntaId: p.id,
      opcionElegida: sel[p.id] ?? null,
    }));
    this.corrigiendo.set(true);
    try {
      const res = await firstValueFrom(
        this.http.post<CuestionarioResultado>(
          `${environment.apiUrl}/bloques/${this.bloque().id}/cuestionario/corregir`,
          { respuestas },
          { withCredentials: true },
        ),
      );
      this.resultado.set(res);
    } catch (err) {
      const e = err as HttpErrorResponse;
      this.toast.error(
        e.error?.message ?? 'No se pudo corregir el cuestionario.',
      );
    } finally {
      this.corrigiendo.set(false);
    }
  }

  reintentar(): void {
    this.resultado.set(null);
    this.selecciones.set({});
  }
}
