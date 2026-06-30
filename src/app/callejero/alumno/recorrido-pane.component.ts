import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type {
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
} from 'primeng/autocomplete';
import {
  Calle,
  DificultadCallejero,
  GeocodeBuscarItem,
  RecorridoLibreErrorCode,
  RecorridoResponse,
} from '../models/callejero.model';
import { CjDificultadChipsComponent } from '../shared/cj-dificultad-chips.component';
import { CjZonaChipsComponent } from '../shared/cj-zona-chips.component';

const DIF_DESC_REC: Record<DificultadCallejero, string> = {
  FACIL: 'Te pregunta solo calles y avenidas de longitud considerable.',
  MEDIO: 'Calles largas y de longitud media.',
  DIFICIL: 'Cualquier calle, incluidas las cortas y sin salida.',
};

/** Modos del buscador de recorridos: calle del banco (autocomplete) o dirección libre (v27). */
export type ModoRecorrido = 'calle-bd' | 'direccion-libre';

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
  imports: [
    CommonModule,
    FormsModule,
    AutoCompleteModule,
    CjDificultadChipsComponent,
    CjZonaChipsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recorrido-pane.component.html',
  styleUrl: './recorrido-pane.component.scss',
  host: {
    class: 'cj-recorrido-pane',
    '[class.cj-recorrido-pane--min]': 'minimizado()',
  },
})
export class RecorridoPaneComponent implements OnDestroy {
  // ---- Inputs (datos del padre) ----
  /** Catálogo de calles para el autocomplete (segmentado por oposición en BD). */
  readonly calles = input<Calle[]>([]);
  /** Calle-destino actualmente seleccionada (eco del padre). */
  readonly destino = input<Calle | null>(null);
  /** Recorrido recibido del backend; `null` mientras no hay búsqueda activa. */
  readonly recorrido = input<RecorridoResponse | null>(null);
  /** Petición en curso (spinner en el buscador). */
  readonly loading = input<boolean>(false);
  /**
   * Error de recorrido (D7 — estado DURO, sin mapa falso):
   *  - `'no-disponible'`: calle de BD sin recorrido publicado (404 de `getRecorrido`).
   *  - `'NO_GEOCODE'`: dirección libre no localizada por el geocoder (404).
   *  - `'ROUTE_UNAVAILABLE'`: localizada pero sin ruta trazable (503).
   */
  readonly error = input<'no-disponible' | RecorridoLibreErrorCode | null>(
    null,
  );
  /** Estado del examen de recorridos; `null` si no hay examen en curso. */
  readonly examen = input<RecorridoExamenView | null>(null);
  /** Resultado final del examen; `null` mientras no haya terminado. */
  readonly resultado = input<RecorridoResultadoView | null>(null);
  /** Dificultad seleccionada (port v27): filtra el pool por longitud de calle. */
  readonly dificultad = input<DificultadCallejero>('MEDIO');
  /** Parques disponibles para el examen de recorridos (derivados de zonas). */
  readonly parques = input<string[]>([]);
  /**
   * Sugerencias OSM para el autocomplete de dirección libre (T10). El padre
   * las carga vía `geocodeBuscar` al recibir `geocodeBuscarChange`.
   */
  readonly geocodeSugerencias = input<GeocodeBuscarItem[]>([]);

  // ---- Outputs (intención hacia el padre) ----
  /** El alumno eligió una calle-destino del autocomplete (modo `calle-bd`). */
  readonly buscarDestino = output<number>();
  /** El alumno pidió trazar a una dirección de texto libre (modo `direccion-libre`, v27). */
  readonly buscarDireccionLibre = output<string>();
  /**
   * El alumno tecleó en el input de dirección libre (con debounce 300ms, T10).
   * El padre llama a geocodeBuscar y pasa los resultados via `geocodeSugerencias`.
   * Emite cadena vacía cuando el input queda vacío (el padre debe limpiar sugerencias).
   */
  readonly geocodeBuscarChange = output<string>();
  /** El alumno seleccionó una sugerencia OSM (T10). */
  readonly geocodeSugerenciaSeleccionada = output<GeocodeBuscarItem>();
  /** El alumno cambió la dificultad del examen de recorridos. */
  readonly cambiarDificultad = output<DificultadCallejero>();
  /** El alumno pulsó "Examen de recorridos". Emite los parques seleccionados. */
  readonly iniciarExamenRecorridos = output<string[]>();
  /** El alumno eligió un parque en el reto actual del examen. */
  readonly responderParque = output<string>();
  /** El alumno pulsó "Siguiente" / "Otra calle" (avanzar de reto). */
  readonly siguienteOtraCalle = output<void>();
  /** El alumno minimizó/restauró la ventana (notifica al padre por si reacciona). */
  readonly minimizarToggle = output<boolean>();
  /**
   * El alumno alternó el modo del buscador (calle-banco ↔ dirección libre). El
   * padre lo usa para limpiar el resultado/error/capa del modo anterior y no
   * arrastrar un resumen o una polilínea incoherentes con el modo actual.
   */
  readonly modoCambiado = output<ModoRecorrido>();

  // ---- Estado local (presentación) ----
  readonly minimizado = signal<boolean>(false);
  /** Sugerencias del autocomplete (resultado del filtrado local). */
  readonly sugerencias = signal<Calle[]>([]);
  /** Modo del buscador: calle del banco (autocomplete) o dirección libre (v27). */
  readonly modo = signal<ModoRecorrido>('calle-bd');
  /** Texto tecleado en el modo dirección libre (v27). */
  readonly textoLibre = signal<string>('');
  /** Parques seleccionados para el examen de recorridos. */
  readonly parquesRecSel = signal<Set<string>>(new Set());
  /**
   * Modo externo (port v27 / Raúl): false = "Escribo/elijo yo la calle",
   * true = "Que me pregunten una calle" (muestra config del examen).
   */
  readonly preguntar = signal<boolean>(false);
  /** Texto del filtro de la base de calles en la sección "Escribo/elijo". */
  readonly baseBuscarTexto = signal<string>('');

  readonly DIF_DESC_REC = DIF_DESC_REC;

  /** Opciones del selector de dificultad (port v27). */
  readonly dificultades: { valor: DificultadCallejero; label: string }[] = [
    { valor: 'FACIL', label: 'Fácil' },
    { valor: 'MEDIO', label: 'Medio' },
    { valor: 'DIFICIL', label: 'Difícil' },
  ];

  /** Subject para debounce del geocoder (T10 — dirección libre). */
  private readonly geocoderSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor() {
    effect(
      () => {
        const ps = this.parques();
        if (ps.length > 0) this.parquesRecSel.set(new Set(ps));
      },
      { allowSignalWrites: true },
    );

    // T10: debounce 300ms para el autocomplete de dirección libre.
    this.geocoderSubject
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((q) => this.geocodeBuscarChange.emit(q));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Alterna entre "Escribo/elijo yo la calle" (false) y "Que me pregunten" (true).
   * Port v27 / Raúl: los checkboxes del sidebar son radio-exclusivos.
   */
  setPreguntar(v: boolean): void {
    this.preguntar.set(v);
  }

  /** El alumno seleccionó directamente una calle del filtro de la base. */
  onSeleccionarCalleDirecto(c: Calle): void {
    this.buscarDestino.emit(c.id);
  }

  /** ¿Hay un examen de recorridos en curso? */
  readonly examenActivo = computed(() => this.examen() !== null);

  /**
   * Calles filtradas por texto de búsqueda base (sección "Escribo/elijo").
   * Sin filtro muestra las primeras 20; con filtro hasta 30 resultados.
   */
  readonly callesFiltradas = computed<Calle[]>(() => {
    const q = this.baseBuscarTexto().trim().toLowerCase();
    if (!q) return this.calles().slice(0, 20);
    return this.calles()
      .filter((c) => c.nombre.toLowerCase().includes(q))
      .slice(0, 30);
  });

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

  /** Cambia entre modo calle-banco y dirección libre (v27). */
  setModo(modo: ModoRecorrido): void {
    if (this.modo() === modo) return;
    this.modo.set(modo);
    // Limpia el estado local del buscador para no arrastrar texto/sugerencias
    // del modo anterior; el padre limpia su resultado/error/capa al recibir
    // `modoCambiado` (el estado de recorrido es compartido entre ambos modos).
    this.textoLibre.set('');
    this.sugerencias.set([]);
    this.modoCambiado.emit(modo);
  }

  /** Modo dirección libre (v27): emite el texto tecleado si no está vacío. */
  onTrazarLibre(): void {
    const q = this.textoLibre().trim();
    if (q) this.buscarDireccionLibre.emit(q);
  }

  /**
   * Maneja el cambio del input de dirección libre (T10). Actualiza el signal
   * local y pone en el Subject el texto para debounce → padre llama geocodeBuscar.
   * Si el texto queda vacío, emite '' inmediatamente (sin debounce) para que el
   * padre limpie las sugerencias al instante.
   */
  onTextoLibreChange(q: string): void {
    this.textoLibre.set(q);
    if (!q.trim()) {
      this.geocodeBuscarChange.emit('');
    } else {
      this.geocoderSubject.next(q.trim());
    }
  }

  /** El alumno eligió una sugerencia OSM (T10). */
  onSugerenciaSeleccionada(item: GeocodeBuscarItem): void {
    this.geocodeSugerenciaSeleccionada.emit(item);
  }

  toggleMinimizar(): void {
    const v = !this.minimizado();
    this.minimizado.set(v);
    this.minimizarToggle.emit(v);
  }

  onIniciarExamen(): void {
    this.iniciarExamenRecorridos.emit([...this.parquesRecSel()]);
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
