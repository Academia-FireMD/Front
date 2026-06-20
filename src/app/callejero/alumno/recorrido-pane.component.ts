import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type {
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import { Calle, RecorridoResponse } from '../models/callejero.model';

/**
 * Estado del examen de recorridos que el padre pasa al pane. Es PRESENTACIONAL:
 * el reto en curso, sus opciones de parque, el feedback inmediato y el progreso.
 * La nota la calcula el backend; aquí solo se muestra.
 */
export interface RecorridoExamenView {
  /** Calle objetivo del reto actual ("¿qué parque cubre esta calle?"). */
  calleNombre: string;
  /** Parques candidatos (selector). */
  opciones: string[];
  /** Reto actual (1-based para mostrar) y total. */
  indice: number;
  total: number;
  aciertos: number;
  /** Feedback tras responder; `null` mientras se espera la respuesta. */
  feedback: { ok: boolean; texto: string } | null;
  /** El parque elegido por el alumno en el reto actual (para resaltar). */
  elegido: string | null;
  /** El/los parque(s) correcto(s) del reto (para resaltar tras responder). */
  correctos: string[];
  /** ¿Es el último reto? (cambia la etiqueta del botón siguiente). */
  esUltimo: boolean;
}

/**
 * Resultado final del examen de recorridos (lo calcula el backend). El padre lo
 * pasa cuando el examen termina; el pane solo lo presenta.
 */
export interface RecorridoResultadoView {
  nota: number;
  aciertos: number;
  total: number;
  aprobado: boolean;
}

/**
 * Pane presentacional de la 4ª pestaña "Recorridos" (Callejero v10).
 *
 * D5 (arquitectura lockada): NO contiene Leaflet ni HttpClient. El padre
 * (`callejero-app.component.ts`) es el ÚNICO dueño del mapa, de las capas y de
 * las llamadas a la API. Este componente recibe datos por `input()` y emite
 * intención por `output()`. Cubre:
 *  - Buscador (p-autoComplete) de calle-destino.
 *  - Resultado del recorrido: km · min + lista ORDENADA de calles.
 *  - Estado "ruta no disponible" DURO (D7): mensaje claro, sin mapa falso.
 *  - Ventana minimizable (signal `minimizado` + toggle, clase host).
 *  - Modo "Examen de recorridos": calle resaltada + botones de parque + feedback.
 */
@Component({
  selector: 'app-recorrido-pane',
  standalone: true,
  imports: [CommonModule, AutoCompleteModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recorrido-pane.component.html',
  styleUrl: './recorrido-pane.component.scss',
  host: {
    class: 'cj-recorrido-pane',
    '[class.cj-recorrido-pane--min]': 'minimizado()',
  },
})
export class RecorridoPaneComponent {
  // ---- Inputs (datos del padre) ----
  /** Catálogo de calles para el autocomplete (segmentado por oposición en BD). */
  readonly calles = input<Calle[]>([]);
  /** Calle-destino actualmente seleccionada (eco del padre). */
  readonly destino = input<Calle | null>(null);
  /** Recorrido recibido del backend; `null` mientras no hay búsqueda activa. */
  readonly recorrido = input<RecorridoResponse | null>(null);
  /** Petición en curso (spinner en el buscador). */
  readonly loading = input<boolean>(false);
  /** Error de recorrido: `'no-disponible'` (404) o `null`. (D7) */
  readonly error = input<'no-disponible' | null>(null);
  /** Estado del examen de recorridos; `null` si no hay examen en curso. */
  readonly examen = input<RecorridoExamenView | null>(null);
  /** Resultado final del examen; `null` mientras no haya terminado. */
  readonly resultado = input<RecorridoResultadoView | null>(null);

  // ---- Outputs (intención hacia el padre) ----
  /** El alumno eligió una calle-destino del autocomplete. */
  readonly buscarDestino = output<number>();
  /** El alumno pulsó "Examen de recorridos". */
  readonly iniciarExamenRecorridos = output<void>();
  /** El alumno eligió un parque en el reto actual del examen. */
  readonly responderParque = output<string>();
  /** El alumno pulsó "Siguiente" / "Otra calle" (avanzar de reto). */
  readonly siguienteOtraCalle = output<void>();
  /** El alumno minimizó/restauró la ventana (notifica al padre por si reacciona). */
  readonly minimizarToggle = output<boolean>();

  // ---- Estado local (presentación) ----
  readonly minimizado = signal<boolean>(false);
  /** Sugerencias del autocomplete (resultado del filtrado local). */
  readonly sugerencias = signal<Calle[]>([]);

  /** ¿Hay un examen de recorridos en curso? */
  readonly examenActivo = computed(() => this.examen() !== null);

  /**
   * Filtra el catálogo de calles por el texto tecleado (case/acentos-insensible
   * aprox.), limitando a 20 sugerencias para no saturar el dropdown.
   */
  filtrarCalles(ev: AutoCompleteCompleteEvent): void {
    const q = ev.query.trim().toLowerCase();
    if (!q) {
      this.sugerencias.set([]);
      return;
    }
    const res = this.calles()
      .filter((c) => c.nombre.toLowerCase().includes(q))
      .slice(0, 20);
    this.sugerencias.set(res);
  }

  onSeleccionarCalle(ev: AutoCompleteSelectEvent): void {
    const c = ev.value as Calle | null;
    if (c?.id != null) this.buscarDestino.emit(c.id);
  }

  toggleMinimizar(): void {
    const v = !this.minimizado();
    this.minimizado.set(v);
    this.minimizarToggle.emit(v);
  }

  onIniciarExamen(): void {
    this.iniciarExamenRecorridos.emit();
  }

  onResponder(parque: string): void {
    // Bloquea doble-respuesta: si ya hay feedback, no reenvía.
    if (this.examen()?.feedback) return;
    this.responderParque.emit(parque);
  }

  onSiguiente(): void {
    this.siguienteOtraCalle.emit();
  }

  /** Estado visual de una opción de parque tras responder. */
  estadoOpcion(parque: string): 'ok' | 'bad' | 'idle' {
    const ex = this.examen();
    if (!ex || !ex.feedback) return 'idle';
    if (ex.correctos.includes(parque)) return 'ok';
    if (ex.elegido === parque) return 'bad';
    return 'idle';
  }
}
