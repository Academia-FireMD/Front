import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastrService } from 'ngx-toastr';
import * as L from 'leaflet';
import { CallejeroService } from '../services/callejero.service';
import {
  Calle,
  Ciudad,
  DetalleRetoResultado,
  IntentoExamenHistorial,
  RespuestaExamenDto,
  ResultadoExamen,
  RetoExamen,
  Zona,
} from '../models/callejero.model';

/** Tiles claros (CartoDB Positron) — coherente con el mapa de práctica. */
const MAP_TILES =
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const ATRIBUCION = '© OpenStreetMap contributors · © IGN CartoCiudad · © CARTO';

/** Pausa (ms) entre responder un reto y cargar el siguiente. */
const FEEDBACK_MS = 1300;
/** Resolución del cronómetro (ms). */
const TICK_MS = 100;

type FaseExamen = 'inicio' | 'jugando' | 'resultado' | 'historial';

interface FeedbackEstado {
  tipo: 'acierto' | 'fallo';
  texto: string;
}

interface OpcionQuiz {
  calleId: number;
  nombre: string;
}

/**
 * Modo Examen del callejero (Callejero v2 — Hito 2).
 *
 * Examen cronometrado de 20 retos mixtos (localizar + identificar) sobre el
 * scope elegido (parque(s) o ciudad completa). Cada reto tiene 15s con
 * auto-avance; al final el backend calcula la nota (0-10, aprueba ≥5) y
 * persiste el intento. La nota la calcula SIEMPRE el servidor desde el token
 * firmado; el feedback inmediato por reto es solo UX.
 *
 * Máquina de estados: inicio → jugando → resultado (→ histórico).
 */
@Component({
  selector: 'app-callejero-examen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    DropdownModule,
    MultiSelectModule,
    ProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-examen.component.html',
  styleUrl: './callejero-examen.component.scss',
})
export class CallejeroExamenComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(CallejeroService);
  private readonly toast = inject(ToastrService);

  @ViewChild('mapEl', { static: false })
  private mapEl?: ElementRef<HTMLDivElement>;

  // ---- Fase / selección ----
  readonly fase = signal<FaseExamen>('inicio');
  readonly ciudades = signal<Ciudad[]>([]);
  readonly ciudadSel = signal<Ciudad | null>(null);
  readonly parques = signal<Zona[]>([]);
  /** Parques elegidos; vacío = ciudad completa. */
  readonly parquesSel = signal<Zona[]>([]);
  readonly loadingInicio = signal<boolean>(true);
  readonly generando = signal<boolean>(false);

  // ---- Estado del examen en curso ----
  private token = '';
  private retos: RetoExamen[] = [];
  private callesScope: Calle[] = [];
  private respuestas: RespuestaExamenDto[] = [];
  private duracionRetoMs = 15000;
  private retoInicioMs = 0;

  readonly retoIdx = signal<number>(0);
  readonly totalRetos = signal<number>(0);
  readonly retoActual = signal<RetoExamen | null>(null);
  readonly opcionesQuiz = signal<OpcionQuiz[]>([]);
  readonly feedback = signal<FeedbackEstado | null>(null);
  /** ms restantes del reto actual (para la barra de tiempo). */
  readonly restanteMs = signal<number>(15000);
  /** Bloquea la interacción mientras se muestra el feedback / se avanza. */
  readonly bloqueado = signal<boolean>(false);
  readonly aciertosEnVivo = signal<number>(0);

  readonly porcentajeTiempo = computed(() =>
    this.duracionRetoMs > 0
      ? Math.max(0, Math.round((this.restanteMs() / this.duracionRetoMs) * 100))
      : 0,
  );
  readonly segundosRestantes = computed(() =>
    Math.ceil(this.restanteMs() / 1000),
  );

  // ---- Resultado / histórico ----
  readonly resultado = signal<ResultadoExamen | null>(null);
  readonly historial = signal<IntentoExamenHistorial[]>([]);
  readonly loadingHistorial = signal<boolean>(false);

  readonly scopeLabel = computed(() => {
    const sel = this.parquesSel();
    if (sel.length === 0) return 'Ciudad completa';
    if (sel.length === 1) return sel[0].nombre;
    return `${sel.length} parques`;
  });

  // ---- Leaflet ----
  private map?: L.Map;
  private capaCalles?: L.GeoJSON;
  private readonly layerPorCalleId = new Map<number, L.Path>();
  private tickTimer?: ReturnType<typeof setInterval>;
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  // ============ Lifecycle ============

  ngAfterViewInit(): void {
    this.cargarInicio();
  }

  ngOnDestroy(): void {
    this.pararTimers();
    this.destruirMapa();
  }

  private destruirMapa(): void {
    try {
      this.map?.remove();
    } catch {
      // Leaflet puede fallar al desmontar SVG en jsdom; lo ignoramos.
    }
    this.map = undefined;
    this.capaCalles = undefined;
    this.layerPorCalleId.clear();
  }

  // ============ Inicio ============

  private cargarInicio(): void {
    this.loadingInicio.set(true);
    this.service.listarCiudades().subscribe({
      next: (ciudades) => {
        this.ciudades.set(ciudades);
        this.loadingInicio.set(false);
        if (ciudades.length > 0) this.seleccionarCiudad(ciudades[0]);
      },
      error: () => this.loadingInicio.set(false),
    });
  }

  seleccionarCiudad(ciudad: Ciudad | null): void {
    if (!ciudad) return;
    this.ciudadSel.set(ciudad);
    this.parquesSel.set([]);
    this.service.listarZonas(ciudad.id).subscribe({
      next: (zonas) => this.parques.set(zonas),
      error: () => this.parques.set([]),
    });
  }

  /** Lanza la generación del examen y arranca el juego. */
  empezar(): void {
    const ciudad = this.ciudadSel();
    if (!ciudad || this.generando()) return;
    this.generando.set(true);
    const zonaIds = this.parquesSel().map((z) => z.id);
    this.service.generarExamen(ciudad.id, zonaIds).subscribe({
      next: (res) => {
        this.generando.set(false);
        this.token = res.token;
        this.retos = res.retos;
        this.callesScope = res.calles;
        this.duracionRetoMs = res.duracionRetoMs;
        this.respuestas = [];
        this.totalRetos.set(res.totalRetos);
        this.retoIdx.set(0);
        this.aciertosEnVivo.set(0);
        this.resultado.set(null);
        this.fase.set('jugando');
        // El mapa se monta cuando el contenedor existe (siguiente tick).
        setTimeout(() => this.iniciarMapaYReto(), 0);
      },
      error: () => {
        this.generando.set(false);
        // El interceptor de ApiBaseService ya muestra el toast del 400/403.
      },
    });
  }

  // ============ Mapa ============

  private iniciarMapaYReto(): void {
    if (!this.mapEl) return;
    this.destruirMapa();
    const map = L.map(this.mapEl.nativeElement, {
      center: [39.47, -0.376],
      zoom: 13,
    });
    L.tileLayer(MAP_TILES, {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: ATRIBUCION,
    }).addTo(map);
    this.map = map;
    this.pintarCalles(this.callesScope);
    this.ajustarVista();
    this.cargarReto(0);
  }

  private pintarCalles(calles: Calle[]): void {
    if (!this.map) return;
    this.capaCalles?.remove();
    this.layerPorCalleId.clear();
    const fc = {
      type: 'FeatureCollection' as const,
      features: calles.map((c) => ({
        type: 'Feature' as const,
        properties: { calleId: c.id, nombre: c.nombre },
        geometry: c.geometria,
      })),
    };
    this.capaCalles = L.geoJSON(fc, {
      style: { color: '#2563eb', weight: 3, opacity: 0.8 },
      onEachFeature: (feature, layer) => {
        const calleId = feature.properties?.['calleId'] as number;
        if (layer instanceof L.Path) this.layerPorCalleId.set(calleId, layer);
        layer.on('click', () => this.onCalleClick(calleId));
        layer.on('mouseover', () => {
          if (layer instanceof L.Path)
            layer.setStyle({ weight: 6, opacity: 1 });
        });
        layer.on('mouseout', () => {
          // No restaurar la calle resaltada del reto de identificar.
          const reto = this.retoActual();
          if (
            layer instanceof L.Path &&
            !(reto?.tipo === 'IDENTIFICAR' && reto.calleId === calleId)
          ) {
            layer.setStyle({ color: '#2563eb', weight: 3, opacity: 0.8 });
          }
        });
      },
    }).addTo(this.map);
  }

  private ajustarVista(): void {
    if (!this.map || !this.capaCalles) return;
    const bounds = this.capaCalles.getBounds();
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [24, 24] });
  }

  // ============ Bucle de retos ============

  private cargarReto(idx: number): void {
    if (idx >= this.retos.length) {
      this.finalizar();
      return;
    }
    const reto = this.retos[idx];
    this.retoIdx.set(idx);
    this.retoActual.set(reto);
    this.feedback.set(null);
    this.bloqueado.set(false);
    this.resaltarReto(null);

    if (reto.tipo === 'IDENTIFICAR') {
      this.opcionesQuiz.set(
        (reto.opciones ?? []).map((o) => ({
          calleId: o.calleId,
          nombre: o.nombre,
        })),
      );
      this.resaltarReto(reto.calleId);
    } else {
      this.opcionesQuiz.set([]);
    }

    this.retoInicioMs = Date.now();
    this.iniciarCronometro();
  }

  private iniciarCronometro(): void {
    this.pararTick();
    this.restanteMs.set(this.duracionRetoMs);
    this.tickTimer = setInterval(() => {
      const restante = this.duracionRetoMs - (Date.now() - this.retoInicioMs);
      if (restante <= 0) {
        this.restanteMs.set(0);
        this.onTimeout();
      } else {
        this.restanteMs.set(restante);
      }
    }, TICK_MS);
  }

  /** Click en una calle del mapa (resuelve los retos de LOCALIZAR). */
  private onCalleClick(calleId: number): void {
    const reto = this.retoActual();
    if (!reto || this.bloqueado() || reto.tipo !== 'LOCALIZAR') return;
    this.resolver(reto, calleId);
  }

  /** Click en una opción (resuelve los retos de IDENTIFICAR). */
  responderOpcion(opcion: OpcionQuiz): void {
    const reto = this.retoActual();
    if (!reto || this.bloqueado() || reto.tipo !== 'IDENTIFICAR') return;
    this.resolver(reto, opcion.calleId);
  }

  private resolver(reto: RetoExamen, respuestaCalleId: number): void {
    this.pararTick();
    this.bloqueado.set(true);
    const acierto = respuestaCalleId === reto.calleId;
    const tiempoMs = Math.min(
      this.duracionRetoMs,
      Date.now() - this.retoInicioMs,
    );
    this.respuestas.push({
      orden: reto.orden,
      respuestaCalleId,
      tiempoMs,
      agotoTiempo: false,
    });
    if (acierto) this.aciertosEnVivo.update((n) => n + 1);
    // Siempre muestra dónde estaba la calle correcta (aprende del fallo).
    this.resaltarReto(reto.calleId);
    this.feedback.set(
      acierto
        ? { tipo: 'acierto', texto: `¡Correcto! Es ${reto.nombre}.` }
        : { tipo: 'fallo', texto: `No. Era ${reto.nombre} (resaltada).` },
    );
    this.programarSiguiente();
  }

  private onTimeout(): void {
    this.pararTick();
    const reto = this.retoActual();
    if (!reto || this.bloqueado()) return;
    this.bloqueado.set(true);
    this.respuestas.push({
      orden: reto.orden,
      respuestaCalleId: null,
      tiempoMs: this.duracionRetoMs,
      agotoTiempo: true,
    });
    this.resaltarReto(reto.calleId);
    this.feedback.set({
      tipo: 'fallo',
      texto: `¡Tiempo! Era ${reto.nombre} (resaltada).`,
    });
    this.programarSiguiente();
  }

  private programarSiguiente(): void {
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(
      () => this.cargarReto(this.retoIdx() + 1),
      FEEDBACK_MS,
    );
  }

  // ============ Finalizar ============

  private finalizar(): void {
    this.pararTimers();
    const tiempoTotalMs = this.respuestas.reduce((s, r) => s + r.tiempoMs, 0);
    this.service
      .registrarExamen({
        token: this.token,
        tiempoTotalMs,
        respuestas: this.respuestas,
      })
      .subscribe({
        next: (res) => {
          this.resultado.set(res);
          this.fase.set('resultado');
          this.destruirMapa();
        },
        error: () => {
          this.toast.error(
            'No se pudo registrar el examen. Inténtalo de nuevo.',
          );
          this.fase.set('inicio');
          this.destruirMapa();
        },
      });
  }

  // ============ Resultado / acciones ============

  get detalleFallos(): DetalleRetoResultado[] {
    return this.resultado()?.detalle.filter((d) => !d.acertado) ?? [];
  }

  /** Repite un examen sobre el mismo scope (nuevo muestreo de retos). */
  reintentar(): void {
    this.fase.set('inicio');
    this.empezar();
  }

  volverInicio(): void {
    this.pararTimers();
    this.destruirMapa();
    this.resultado.set(null);
    this.fase.set('inicio');
  }

  abandonar(): void {
    this.pararTimers();
    this.destruirMapa();
    this.fase.set('inicio');
  }

  // ============ Histórico ============

  verHistorial(): void {
    this.fase.set('historial');
    this.loadingHistorial.set(true);
    const ciudad = this.ciudadSel();
    this.service.historialExamen(ciudad?.id).subscribe({
      next: (res) => {
        this.historial.set(res.items);
        this.loadingHistorial.set(false);
      },
      error: () => this.loadingHistorial.set(false),
    });
  }

  formatTiempo(ms: number): string {
    const totalSeg = Math.round(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    return min > 0 ? `${min}m ${seg}s` : `${seg}s`;
  }

  // ============ Helpers ============

  private resaltarReto(calleId: number | null): void {
    this.layerPorCalleId.forEach((layer) =>
      layer.setStyle({ color: '#2563eb', weight: 3, opacity: 0.8 }),
    );
    if (calleId == null) return;
    this.layerPorCalleId
      .get(calleId)
      ?.setStyle({ color: '#f59e0b', weight: 7, opacity: 1 });
  }

  private pararTick(): void {
    clearInterval(this.tickTimer);
    this.tickTimer = undefined;
  }

  private pararTimers(): void {
    this.pararTick();
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = undefined;
  }
}
