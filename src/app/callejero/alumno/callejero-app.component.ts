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
import { ToastrService } from 'ngx-toastr';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';
import { CallejeroService } from '../services/callejero.service';
import {
  Calle,
  Ciudad,
  GenerarExamenResponse,
  LeaderboardResponse,
  OpcionParqueExamen,
  PoiCategoria,
  PoiCiudad,
  RecorridoResponse,
  RespuestaExamenDto,
  RetoExamen,
  Zona,
} from '../models/callejero.model';
import {
  RecorridoExamenView,
  RecorridoPaneComponent,
  RecorridoResultadoView,
} from './recorrido-pane.component';

/**
 * Callejero v3 — port fiel del tool de Raúl (TÉCNIKAFIRE · Bombers València).
 *
 * Replica su UX: sidebar con 3 pestañas (Mapa/Estudio/Examen), zonas de parque
 * coloreadas, POIs por categoría con iconos, bases Calles/Fusión/Satélite, ficha
 * al click, modo Estudio (buscador + listas) y examen sobre el mapa (localizar
 * con tolerancia + "¿qué parque cubre/coopera en X?"). Se alimenta de nuestra
 * API (zonas+POIs por oposición) y persiste el examen (histórico + leaderboard).
 */

interface CatInfo {
  label: string;
  color: string;
}
const CATS: Record<PoiCategoria, CatInfo> = {
  bomberos: { label: 'Parques de bomberos', color: '#BF0B1B' },
  hospital: { label: 'Hospitales', color: '#1B6FD0' },
  parque: { label: 'Parques y jardines', color: '#15803D' },
  museo: { label: 'Museos', color: '#8E44AD' },
  lugar: { label: 'Lugares de referencia', color: '#E67E22' },
  calle: { label: 'Calles y avenidas', color: '#5B6B7F' },
};
const CAT_ORDER: PoiCategoria[] = [
  'bomberos',
  'hospital',
  'parque',
  'museo',
  'lugar',
  'calle',
];

/** Llama (icono de bombero) en SVG data-uri (no dependemos de un PNG externo). */
const FLAME_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#BF0B1B" stroke="#fff" stroke-width="1" d="M12 2c1 3-1 4-2 6-1 1.7-.6 3.4.6 4.2.3-1 .9-1.7 1.6-2.2-.2 1.7.7 2.5 1.5 3.3 1.1 1.1 1.4 2.6.6 4-.7 1.2-2 1.9-3.4 1.9-2.7 0-4.9-2-4.9-4.8 0-2.4 1.6-4 2.2-6C8.9 6.9 10.9 5 12 2Z"/></svg>`,
  );
function flameIcon(px: number): L.DivIcon {
  return L.divIcon({
    className: 'flame-pin',
    html: `<img src="${FLAME_SVG}" style="width:${px}px;height:auto;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">`,
    iconSize: [px, px * 1.2],
    iconAnchor: [px / 2, px * 1.1],
  });
}

const ATTRIB = '© OpenStreetMap · © CARTO · Esri';
const BASE_URLS: Record<string, { url: string; opts: L.TileLayerOptions }> = {
  calles: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 20, attribution: ATTRIB },
  },
  mudo: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 20, attribution: ATTRIB },
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { maxZoom: 20, attribution: ATTRIB },
  },
};

type TabKey = 'mapa' | 'estudio' | 'examen' | 'recorridos';
type BaseKey = 'calles' | 'fusion' | 'satelite';
type TipoReto = 'localiza' | 'zona' | 'coopera';

interface Reto {
  poi: PoiCiudad;
  zona: Zona | null;
  tipo: TipoReto;
  ok?: boolean;
  detalle?: string;
}
interface FeedbackEstado {
  ok: boolean;
  tit: string;
  txt: string;
}
interface FichaCampo {
  k: string;
  v: string;
  peque?: boolean;
}
interface FichaEstado {
  titulo: string;
  sub: string;
  campos: FichaCampo[];
  centrar?: { lat: number; lng: number };
}
interface ResultadoFila {
  n: string;
  tipo: string;
  ok: boolean;
  detalle?: string;
}

@Component({
  selector: 'app-callejero-app',
  standalone: true,
  imports: [CommonModule, FormsModule, RecorridoPaneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-app.component.html',
  styleUrl: './callejero-app.component.scss',
})
export class CallejeroAppComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(CallejeroService);
  private readonly toast = inject(ToastrService);

  @ViewChild('mapEl', { static: true })
  private readonly mapEl!: ElementRef<HTMLDivElement>;

  readonly CATS = CATS;
  readonly CAT_ORDER = CAT_ORDER;

  // ---- Estado general ----
  readonly ciudades = signal<Ciudad[]>([]);
  readonly ciudadSel = signal<Ciudad | null>(null);
  readonly zonas = signal<Zona[]>([]);
  readonly pois = signal<PoiCiudad[]>([]);
  readonly cargando = signal<boolean>(true);
  readonly cargaError = signal<boolean>(false);
  readonly tab = signal<TabKey>('mapa');
  readonly sidebarAbierto = signal<boolean>(false);

  /**
   * Sin acceso = sin ninguna ciudad del callejero accesible para sus
   * suscripciones (entorno multi-sub: le falta, p.ej., la de Valencia). La
   * segmentación por oposición del backend ya bloquea el dato; esto es la UX
   * del paywall ("añade la suscripción").
   */
  readonly sinAcceso = computed(
    () =>
      !this.cargando() && !this.cargaError() && this.ciudades().length === 0,
  );

  // ---- Capas (visibilidad) ----
  readonly baseActiva = signal<BaseKey>('calles');
  readonly capaZonasOn = signal<boolean>(true);
  readonly capaEstOn = signal<boolean>(true);
  readonly capaCatOn = signal<Record<PoiCategoria, boolean>>({
    bomberos: true,
    hospital: true,
    parque: true,
    museo: true,
    lugar: true,
    calle: true,
  });

  // ---- Ficha ----
  readonly ficha = signal<FichaEstado | null>(null);
  readonly fichaMinimizada = signal<boolean>(false);

  // ---- Estudio ----
  readonly buscar = signal<string>('');
  readonly listasEstudio = computed(() => {
    const f = this.buscar().trim().toLowerCase();
    return CAT_ORDER.map((c) => {
      let items = this.pois().filter((p) => p.categoria === c);
      if (f) items = items.filter((p) => p.nombre.toLowerCase().includes(f));
      items = [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return { cat: c, info: CATS[c], items };
    }).filter((g) => g.items.length > 0);
  });

  // ---- Examen (config) ----
  readonly examCats = signal<Record<PoiCategoria, boolean>>({
    bomberos: true,
    hospital: true,
    parque: true,
    museo: true,
    lugar: true,
    calle: true,
  });
  readonly cfgN = signal<number>(15);
  readonly cfgTol = signal<number>(300);
  readonly cfgMudo = signal<boolean>(true);
  readonly cfgZonas = signal<boolean>(true);
  readonly opcionesN = [10, 15, 20, 30, 40];
  readonly opcionesTol = [150, 200, 300, 450, 600];

  // ---- Examen (en vivo) ----
  readonly examOn = signal<boolean>(false);
  readonly retoIdx = signal<number>(0);
  readonly totalRetos = signal<number>(0);
  readonly aciertos = signal<number>(0);
  readonly racha = signal<number>(0);
  readonly puntos = signal<number>(0);
  readonly retoActual = signal<Reto | null>(null);
  readonly opcionesQuiz = signal<string[]>([]);
  readonly feedback = signal<FeedbackEstado | null>(null);
  readonly esUltimo = computed(() => this.retoIdx() >= this.totalRetos() - 1);

  // ---- Resultado ----
  readonly resultadoVisible = signal<boolean>(false);
  readonly resFilas = signal<ResultadoFila[]>([]);
  readonly resNota = signal<number>(0);
  readonly resAciertos = signal<string>('');
  readonly resPuntos = signal<number>(0);
  readonly hayFallos = computed(() => this.resFilas().some((f) => !f.ok));

  // ---- Leaderboard ----
  readonly leaderboard = signal<LeaderboardResponse | null>(null);
  readonly leaderboardVisible = signal<boolean>(false);

  // ---- Recorridos (Callejero v10) ----
  /** Catálogo de calles del scope (autocomplete del pane), agregado por zonas. */
  readonly recCalles = signal<Calle[]>([]);
  readonly recDestino = signal<Calle | null>(null);
  readonly recResultado = signal<RecorridoResponse | null>(null);
  readonly recLoading = signal<boolean>(false);
  readonly recError = signal<'no-disponible' | null>(null);
  /** Estado del examen de recorridos para el pane (presentacional). */
  readonly recExamenView = signal<RecorridoExamenView | null>(null);
  /** Resultado final del examen de recorridos. */
  readonly recExamenResultado = signal<RecorridoResultadoView | null>(null);

  // ---- Estado interno del examen ----
  private retos: Reto[] = [];
  private espera = false;
  private tol = 300;
  private baseAntes: BaseKey = 'calles';

  // ---- Leaflet ----
  private map?: L.Map;
  private baseLayer?: L.TileLayer;
  private capaZonas?: L.LayerGroup;
  private capaEst?: L.LayerGroup;
  private capasCat: Partial<Record<PoiCategoria, L.LayerGroup>> = {};
  private capaExamen?: L.LayerGroup;
  private pinTmp?: L.CircleMarker;
  /** Capa dedicada al recorrido (polilínea + marcadores estación/destino). */
  private capaRecorrido?: L.LayerGroup;

  // ---- Estado interno del examen de recorridos ----
  private recExamToken: string | null = null;
  private recExamRetos: RetoExamen[] = [];
  /** parquesCobertura por calleId (D8): se llena al generar (desde `calles`). */
  private recCobertura = new Map<number, string[]>();
  private recExamIdx = 0;
  private recExamAciertos = 0;
  private recExamRespuestas: RespuestaExamenDto[] = [];
  private recExamRetoInicio = 0;

  // ============ Lifecycle ============

  ngAfterViewInit(): void {
    try {
      this.initMapa();
    } catch {
      // Leaflet puede fallar en entornos sin layout real (jsdom/tests). El
      // mapa es secundario para la carga de datos; los `pintar*` guardan en
      // `this.map`. En navegador real no ocurre (lo valida el QA visual).
    }
    this.cargarCiudades();
  }

  ngOnDestroy(): void {
    try {
      this.map?.remove();
    } catch {
      /* jsdom */
    }
    this.map = undefined;
  }

  private initMapa(): void {
    const map = L.map(this.mapEl.nativeElement, {
      zoomControl: false,
      center: [39.4665, -0.37],
      zoom: 13,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    this.baseLayer = this.tileLayer('calles').addTo(map);
    this.capaZonas = L.layerGroup().addTo(map);
    this.capaEst = L.layerGroup().addTo(map);
    this.capaExamen = L.layerGroup().addTo(map);
    this.capaRecorrido = L.layerGroup().addTo(map);
    for (const c of CAT_ORDER) this.capasCat[c] = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));
    this.map = map;
  }

  private tileLayer(key: 'calles' | 'mudo' | 'satelite'): L.TileLayer {
    const b = BASE_URLS[key];
    return L.tileLayer(b.url, b.opts);
  }

  /** Ejecuta una operación Leaflet ignorando errores de jsdom (tests). */
  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      /* render Leaflet en entorno sin DOM real */
    }
  }

  // ============ Carga de datos ============

  private cargarCiudades(): void {
    this.cargando.set(true);
    this.cargaError.set(false);
    this.service.listarCiudades().subscribe({
      next: (cs) => {
        this.ciudades.set(cs);
        if (cs.length > 0) this.seleccionarCiudad(cs[0]);
        else this.cargando.set(false); // → sinAcceso() = true → paywall
      },
      error: () => {
        this.cargaError.set(true);
        this.cargando.set(false);
      },
    });
  }

  /** CTA del paywall: añadir la suscripción que da acceso al callejero (tienda). */
  abrirTienda(): void {
    window.open(environment.wooCommerceUrl, '_blank');
  }

  seleccionarCiudad(ciudad: Ciudad | null): void {
    if (!ciudad) return;
    this.ciudadSel.set(ciudad);
    this.cargando.set(true);
    this.cerrarFicha();
    this.resetRecorrido();
    this.recCalles.set([]);
    this.service.listarZonas(ciudad.id).subscribe({
      next: (zonas) => {
        this.zonas.set(zonas);
        this.safe(() => this.pintarZonas(zonas));
        this.cargarCallesAutocomplete(zonas);
        this.service.listarPoisCiudad(ciudad.id).subscribe({
          next: (pois) => {
            this.pois.set(pois);
            this.safe(() => this.pintarPois(pois));
            this.cargando.set(false);
            this.safe(() => this.ajustarVista());
          },
          error: () => this.cargando.set(false),
        });
      },
      error: () => this.cargando.set(false),
    });
  }

  /**
   * Agrega las calles de todas las zonas para el autocomplete de Recorridos.
   * Reusa `GET /callejero/zonas/:id/calles` (no hay endpoint de "todas las
   * calles" de la ciudad). Dedupe por id y ordena por nombre. Cualquier zona que
   * falle se ignora (best-effort): el autocomplete se degrada, no rompe.
   */
  private cargarCallesAutocomplete(zonas: Zona[]): void {
    if (zonas.length === 0) return;
    const acc = new Map<number, Calle>();
    let pendientes = zonas.length;
    for (const z of zonas) {
      this.service.listarCalles(z.id).subscribe({
        next: (r) => {
          for (const c of r.calles) acc.set(c.id, c);
          if (--pendientes === 0) this.publicarCallesAutocomplete(acc);
        },
        error: () => {
          if (--pendientes === 0) this.publicarCallesAutocomplete(acc);
        },
      });
    }
  }
  private publicarCallesAutocomplete(acc: Map<number, Calle>): void {
    this.recCalles.set(
      [...acc.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    );
  }

  // ============ Pintado ============

  private pintarZonas(zonas: Zona[]): void {
    if (!this.map || !this.capaZonas) return;
    this.capaZonas.clearLayers();
    for (const z of zonas) {
      const color = z.color || '#D7263D';
      const fc = {
        type: 'Feature' as const,
        properties: {},
        geometry: z.geometria,
      };
      const layer = L.geoJSON(fc, {
        style: { color, weight: 2, fillColor: color, fillOpacity: 0.18 },
      });
      layer.bindTooltip(z.areaName || z.nombre, {
        sticky: true,
        className: 'poi-tip',
      });
      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!this.examOn()) this.fichaPunto(e.latlng);
      });
      layer.addTo(this.capaZonas);
    }
  }

  private pintarPois(pois: PoiCiudad[]): void {
    if (!this.map) return;
    for (const c of CAT_ORDER) this.capasCat[c]?.clearLayers();
    this.capaEst?.clearLayers();
    for (const p of pois) {
      const cat = p.categoria;
      const m =
        cat === 'bomberos'
          ? L.marker([p.lat, p.lng], {
              icon: flameIcon(26),
              zIndexOffset: 400,
            })
          : L.circleMarker([p.lat, p.lng], {
              radius: cat === 'calle' ? 5 : 7,
              color: '#fff',
              weight: 1.6,
              fillColor: CATS[cat]?.color ?? '#5B6B7F',
              fillOpacity: 0.95,
            });
      m.bindTooltip(p.nombre, {
        direction: 'top',
        className: 'poi-tip',
        offset: [0, -6],
      });
      m.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!this.examOn()) this.fichaPOI(p);
      });
      this.capasCat[cat]?.addLayer(m);
    }
  }

  private ajustarVista(): void {
    if (!this.map || !this.capaZonas) return;
    try {
      const bounds = L.latLngBounds([]);
      this.capaZonas.eachLayer((l) => {
        if (l instanceof L.GeoJSON) bounds.extend(l.getBounds());
      });
      if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.05));
    } catch {
      /* ignore */
    }
  }

  // ============ Tabs / sidebar ============

  setTab(t: TabKey): void {
    const anterior = this.tab();
    this.tab.set(t);
    // Al salir de Recorridos, limpia la capa del mapa y el estado del pane (D7:
    // nunca dejamos una línea/recorrido huérfano pintado en otra pestaña).
    if (anterior === 'recorridos' && t !== 'recorridos') {
      this.resetRecorrido();
    }
  }
  toggleSidebar(): void {
    this.sidebarAbierto.update((v) => !v);
  }

  // ============ Bases ============

  setBase(b: BaseKey): void {
    if (b === this.baseActiva() || !this.map) return;
    this.baseActiva.set(b);
    this.aplicarBase(b);
  }
  private aplicarBase(b: BaseKey): void {
    if (!this.map) return;
    this.baseLayer?.remove();
    const key =
      b === 'fusion' ? 'mudo' : b === 'satelite' ? 'satelite' : 'calles';
    this.baseLayer = this.tileLayer(key).addTo(this.map);
    this.baseLayer.bringToBack();
  }

  // ============ Capas ============

  toggleCapaZonas(on: boolean): void {
    this.capaZonasOn.set(on);
    if (!this.map || !this.capaZonas) return;
    on ? this.capaZonas.addTo(this.map) : this.capaZonas.remove();
  }
  toggleCapaEst(on: boolean): void {
    this.capaEstOn.set(on);
    if (!this.map || !this.capaEst) return;
    on ? this.capaEst.addTo(this.map) : this.capaEst.remove();
  }
  toggleCapaCat(cat: PoiCategoria, on: boolean): void {
    this.capaCatOn.update((m) => ({ ...m, [cat]: on }));
    const g = this.capasCat[cat];
    if (!this.map || !g) return;
    on ? g.addTo(this.map) : g.remove();
  }
  countCat(cat: PoiCategoria): number {
    return this.pois().filter((p) => p.categoria === cat).length;
  }

  // ============ Ficha ============

  private filasZona(z: Zona | null): FichaCampo[] {
    if (!z)
      return [
        { k: 'Zona de parque', v: 'Fuera de la zonificación', peque: true },
      ];
    return [
      { k: 'nombre', v: z.nombre },
      { k: 'parque', v: z.parque ?? '' },
      { k: 'coopera', v: z.coopera ?? '' },
      { k: 'código', v: z.codigo },
      { k: 'área', v: z.areaName ?? '' },
    ].filter((f) => f.v);
  }
  private zonaEn(lat: number, lng: number): Zona | null {
    for (const z of this.zonas()) {
      if (this.pip(lat, lng, z.geometria)) return z;
    }
    return null;
  }
  /** Point-in-polygon (ray casting) sobre GeoJSON Polygon/MultiPolygon ([lng,lat]). */
  private pip(lat: number, lng: number, geo: unknown): boolean {
    const g = geo as {
      type: string;
      coordinates: number[][][] | number[][][][];
    };
    const polys =
      g.type === 'MultiPolygon'
        ? (g.coordinates as number[][][][])
        : [g.coordinates as number[][][]];
    for (const poly of polys) {
      const ring = poly[0];
      let dentro = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0],
          yi = ring[i][1],
          xj = ring[j][0],
          yj = ring[j][1];
        if (
          yi > lat !== yj > lat &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
        )
          dentro = !dentro;
      }
      if (dentro) return true;
    }
    return false;
  }
  private ponPin(lat: number, lng: number): void {
    if (!this.map) return;
    this.pinTmp?.remove();
    this.pinTmp = L.circleMarker([lat, lng], {
      radius: 9,
      color: '#0D1B2A',
      weight: 2,
      fillColor: '#F9B112',
      fillOpacity: 0.95,
    }).addTo(this.map);
  }
  private fichaPunto(latlng: L.LatLng): void {
    const z = this.zonaEn(latlng.lat, latlng.lng);
    this.ponPin(latlng.lat, latlng.lng);
    this.fichaMinimizada.set(false);
    this.ficha.set({
      titulo: z ? z.nombre : 'Punto consultado',
      sub: z ? 'Zonificación por parques' : 'Sin zona asignada',
      campos: this.filasZona(z).concat([
        {
          k: 'coordenadas',
          v: latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5),
          peque: true,
        },
      ]),
    });
  }
  private fichaPOI(p: PoiCiudad): void {
    const z = this.zonaEn(p.lat, p.lng);
    this.ponPin(p.lat, p.lng);
    this.fichaMinimizada.set(false);
    this.ficha.set({
      titulo: p.nombre,
      sub: CATS[p.categoria]?.label ?? 'Ficha del lugar',
      campos: this.filasZona(z).concat([
        {
          k: 'coordenadas',
          v: p.lat.toFixed(5) + ', ' + p.lng.toFixed(5),
          peque: true,
        },
      ]),
      centrar: { lat: p.lat, lng: p.lng },
    });
  }
  toggleFichaMinimizada(): void {
    this.fichaMinimizada.update((v) => !v);
  }

  cerrarFicha(): void {
    this.ficha.set(null);
    this.fichaMinimizada.set(false);
    this.pinTmp?.remove();
    this.pinTmp = undefined;
  }
  centrarFicha(): void {
    const c = this.ficha()?.centrar;
    if (c && this.map) this.map.flyTo([c.lat, c.lng], 16);
  }
  private onMapClick(e: L.LeafletMouseEvent): void {
    if (this.examOn()) {
      this.respLocaliza(e.latlng);
      return;
    }
    this.fichaPunto(e.latlng);
  }

  // ============ Estudio ============

  irAPoi(p: PoiCiudad): void {
    if (this.map) this.map.flyTo([p.lat, p.lng], 16);
    this.fichaPOI(p);
    if (window.innerWidth <= 820) this.sidebarAbierto.set(false);
  }

  // ============ Examen ============

  toggleExamCat(cat: PoiCategoria, on: boolean): void {
    this.examCats.update((m) => ({ ...m, [cat]: on }));
  }
  private shuffle<T>(a: T[]): T[] {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }
  empezarExamen(): void {
    const cats = CAT_ORDER.filter((c) => this.examCats()[c]);
    if (!cats.length) {
      this.toast.info('Selecciona al menos una categoría');
      return;
    }
    const candidatos = this.pois().filter((p) => cats.includes(p.categoria));
    if (candidatos.length < 4) {
      this.toast.info('Muy pocos lugares en esas categorías');
      return;
    }
    const n = Math.min(this.cfgN(), candidatos.length);
    const conZonas = this.cfgZonas();
    this.retos = this.shuffle(candidatos)
      .slice(0, n)
      .map((p) => {
        const z = this.zonaEn(p.lat, p.lng);
        let tipo: TipoReto = 'localiza';
        if (conZonas && z && Math.random() < 0.4) {
          tipo = Math.random() < 0.5 && z.coopera ? 'coopera' : 'zona';
        }
        return { poi: p, zona: z, tipo };
      });
    this.tol = this.cfgTol();
    this.baseAntes = this.baseActiva();
    this.examOn.set(true);
    this.retoIdx.set(0);
    this.aciertos.set(0);
    this.racha.set(0);
    this.puntos.set(0);
    this.totalRetos.set(this.retos.length);
    this.cerrarFicha();
    // Examen ciego: ocultar capas; opcional base muda.
    this.safe(() => this.ocultarCapas());
    this.safe(() => {
      if (this.cfgMudo() && this.map) {
        this.baseLayer?.remove();
        this.baseLayer = this.tileLayer('mudo').addTo(this.map);
        this.baseLayer.bringToBack();
      }
    });
    if (window.innerWidth <= 820) this.sidebarAbierto.set(false);
    this.safe(() => this.map?.flyTo([39.4665, -0.37], 12.5));
    this.pregunta();
  }
  private ocultarCapas(): void {
    if (!this.map) return;
    this.capaZonas?.remove();
    this.capaEst?.remove();
    for (const c of CAT_ORDER) this.capasCat[c]?.remove();
  }
  private restaurarCapas(): void {
    if (!this.map) return;
    if (this.capaZonasOn()) this.capaZonas?.addTo(this.map);
    if (this.capaEstOn()) this.capaEst?.addTo(this.map);
    for (const c of CAT_ORDER)
      if (this.capaCatOn()[c]) this.capasCat[c]?.addTo(this.map);
    this.aplicarBase(this.baseAntes);
  }
  private pregunta(): void {
    this.capaExamen?.clearLayers();
    this.espera = true;
    this.feedback.set(null);
    const q = this.retos[this.retoIdx()];
    this.retoActual.set(q);
    if (q.tipo === 'localiza') {
      this.opcionesQuiz.set([]);
      if (this.mapEl) this.mapEl.nativeElement.style.cursor = 'crosshair';
    } else {
      const esZona = q.tipo === 'zona';
      const correcto = (esZona ? q.zona?.parque : q.zona?.coopera) ?? '';
      let vals = [
        ...new Set(
          this.zonas()
            .map((z) => (esZona ? z.parque : z.coopera))
            .filter((v): v is string => !!v),
        ),
      ];
      vals = this.shuffle(vals).slice(0, 5);
      if (!vals.includes(correcto)) {
        vals[0] = correcto;
        vals = this.shuffle(vals);
      }
      this.opcionesQuiz.set(vals);
    }
  }
  private respLocaliza(latlng: L.LatLng): void {
    if (!this.espera) return;
    const q = this.retos[this.retoIdx()];
    if (q.tipo !== 'localiza') return;
    this.espera = false;
    if (this.mapEl) this.mapEl.nativeElement.style.cursor = '';
    const obj = L.latLng(q.poi.lat, q.poi.lng);
    const d = Math.round(this.map?.distance(latlng, obj) ?? 99999);
    const tol = this.tol + (q.poi.categoria === 'calle' ? 100 : 0);
    const ok = d <= tol;
    this.dibujarLocaliza(latlng, obj, ok, q.poi.nombre);
    this.registra(q, ok, `a ${d} m (tolerancia ${tol} m)`);
    if (ok) {
      this.feedback.set({
        ok: true,
        tit: '¡Correcto!',
        txt: `Has caído a ${d} m del objetivo.`,
      });
    } else {
      this.feedback.set({
        ok: false,
        tit: `A ${d} m`,
        txt: 'Era aquí. Te muestro el punto.',
      });
      this.map?.flyTo(obj, 15.5);
    }
  }
  private dibujarLocaliza(
    clic: L.LatLng,
    obj: L.LatLng,
    ok: boolean,
    nombre: string,
  ): void {
    if (!this.capaExamen) return;
    const col = ok ? '#15803D' : '#D7263D';
    L.circleMarker(clic, {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: col,
      fillOpacity: 1,
    }).addTo(this.capaExamen);
    L.circleMarker(obj, {
      radius: 9,
      color: '#fff',
      weight: 2,
      fillColor: '#F9B112',
      fillOpacity: 1,
    })
      .bindTooltip(nombre, {
        permanent: true,
        direction: 'top',
        className: 'poi-tip',
      })
      .addTo(this.capaExamen);
    L.polyline([clic, obj], { color: col, weight: 2, dashArray: '6 6' }).addTo(
      this.capaExamen,
    );
  }
  responderOpcion(v: string): void {
    if (!this.espera) return;
    const q = this.retos[this.retoIdx()];
    const correcto =
      (q.tipo === 'zona' ? q.zona?.parque : q.zona?.coopera) ?? '';
    this.espera = false;
    const ok = v === correcto;
    this.registra(q, ok, ok ? '' : `la respuesta era ${correcto}`);
    if (ok) {
      this.feedback.set({
        ok: true,
        tit: '¡Correcto!',
        txt: `${q.tipo === 'zona' ? 'Parque' : 'Coopera'}: ${correcto}.`,
      });
    } else {
      this.feedback.set({
        ok: false,
        tit: 'Fallo',
        txt: `La respuesta correcta era ${correcto}.`,
      });
      const p = q.poi;
      this.map?.flyTo([p.lat, p.lng], 15.5);
      L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: '#F9B112',
        fillOpacity: 1,
      })
        .bindTooltip(p.nombre, {
          permanent: true,
          direction: 'top',
          className: 'poi-tip',
        })
        .addTo(this.capaExamen!);
    }
  }
  /** Para resaltar la opción correcta/errónea tras responder (gobernado por feedback()). */
  estadoOpcion(v: string): 'ok' | 'bad' {
    const q = this.retoActual();
    const correcto =
      (q?.tipo === 'zona' ? q?.zona?.parque : q?.zona?.coopera) ?? '';
    return v === correcto ? 'ok' : 'bad';
  }
  private registra(q: Reto, ok: boolean, detalle: string): void {
    q.ok = ok;
    q.detalle = detalle;
    if (ok) {
      this.aciertos.update((n) => n + 1);
      this.racha.update((n) => n + 1);
      this.puntos.update((p) => p + 100 + Math.min(this.racha() * 10, 50));
    } else {
      this.racha.set(0);
    }
  }
  siguiente(): void {
    this.cerrarFicha();
    if (this.esUltimo()) {
      this.finExamen();
      return;
    }
    this.retoIdx.update((i) => i + 1);
    this.pregunta();
  }
  abandonar(): void {
    this.retos = this.retos.slice(0, this.retoIdx() + (this.espera ? 0 : 1));
    this.finExamen();
  }
  private finExamen(): void {
    this.examOn.set(false);
    this.espera = false;
    if (this.mapEl) this.mapEl.nativeElement.style.cursor = '';
    this.capaExamen?.clearLayers();
    this.restaurarCapas();
    const hechas = this.retos.filter((q) => q.ok !== undefined);
    if (!hechas.length) return;
    this.resNota.set(
      Math.round((this.aciertos() / hechas.length) * 10 * 10) / 10,
    );
    this.resAciertos.set(`${this.aciertos()}/${hechas.length}`);
    this.resPuntos.set(this.puntos());
    this.resFilas.set(
      hechas.map((q) => ({
        n: q.poi.nombre,
        tipo:
          q.tipo === 'localiza'
            ? 'Localizar'
            : q.tipo === 'zona'
              ? 'Zona'
              : 'Coopera',
        ok: !!q.ok,
        detalle: q.detalle,
      })),
    );
    this.resultadoVisible.set(true);
    // Persistir (histórico + leaderboard).
    const ciudad = this.ciudadSel();
    if (ciudad) {
      this.service
        .registrarResultadoExamen({
          ciudadId: ciudad.id,
          totalRetos: hechas.length,
          aciertos: this.aciertos(),
          puntos: this.puntos(),
        })
        .subscribe({ error: () => {} });
    }
  }
  cerrarResultado(): void {
    this.resultadoVisible.set(false);
  }
  repasarFallos(): void {
    const fallos = this.retos
      .filter((q) => q.ok === false)
      .map((q) => ({ poi: q.poi, zona: q.zona, tipo: q.tipo }) as Reto);
    if (!fallos.length) return;
    this.resultadoVisible.set(false);
    this.retos = this.shuffle(fallos);
    this.totalRetos.set(this.retos.length);
    this.examOn.set(true);
    this.retoIdx.set(0);
    this.aciertos.set(0);
    this.racha.set(0);
    this.puntos.set(0);
    this.ocultarCapas();
    if (this.cfgMudo() && this.map) {
      this.baseLayer?.remove();
      this.baseLayer = this.tileLayer('mudo').addTo(this.map);
      this.baseLayer.bringToBack();
    }
    this.pregunta();
  }

  // ============ Leaderboard ============

  verLeaderboard(): void {
    const ciudad = this.ciudadSel();
    if (!ciudad) return;
    this.service.leaderboardExamen(ciudad.id).subscribe({
      next: (lb) => {
        this.leaderboard.set(lb);
        this.leaderboardVisible.set(true);
      },
    });
  }
  cerrarLeaderboard(): void {
    this.leaderboardVisible.set(false);
  }
  toggleOptIn(on: boolean): void {
    this.service.setLeaderboardOptIn(on).subscribe({
      next: () => this.verLeaderboard(),
    });
  }

  // ============ Recorridos (Callejero v10) ============

  /** Limpia la capa del mapa + el estado del pane de recorridos. */
  private resetRecorrido(): void {
    this.recDestino.set(null);
    this.recResultado.set(null);
    this.recLoading.set(false);
    this.recError.set(null);
    this.recExamenView.set(null);
    this.recExamenResultado.set(null);
    this.recExamToken = null;
    this.recExamRetos = [];
    this.recCobertura.clear();
    this.safe(() => this.capaRecorrido?.clearLayers());
  }

  /**
   * El alumno eligió una calle-destino: pide el recorrido precomputado al
   * backend. Con éxito pinta polilínea + marcadores en SU capa Leaflet; con 404
   * limpia la capa y marca `error='no-disponible'` (D7) — NUNCA línea recta.
   */
  onBuscarDestino(calleId: number): void {
    const destino = this.recCalles().find((c) => c.id === calleId) ?? null;
    this.recDestino.set(destino);
    this.recResultado.set(null);
    this.recError.set(null);
    this.recLoading.set(true);
    this.safe(() => this.capaRecorrido?.clearLayers());

    this.service.getRecorrido(calleId).subscribe({
      next: (rec) => {
        this.recLoading.set(false);
        this.recResultado.set(rec);
        this.safe(() => this.pintarRecorrido(rec, destino));
      },
      error: () => {
        // 404 "Ruta no disponible" (o cualquier fallo): estado DURO, sin pintar
        // nada en el mapa. Jamás una línea recta como recorrido (D7).
        this.recLoading.set(false);
        this.recResultado.set(null);
        this.recError.set('no-disponible');
        this.safe(() => this.capaRecorrido?.clearLayers());
      },
    });
  }

  /**
   * Pinta la polilínea precomputada + marcadores de estación (origen) y destino.
   * La geometría llega del backend (OSRM); si por lo que sea no es una geometría
   * de línea válida, NO inventa una recta: deja la capa limpia (D7).
   */
  private pintarRecorrido(rec: RecorridoResponse, destino: Calle | null): void {
    if (!this.map || !this.capaRecorrido) return;
    this.capaRecorrido.clearLayers();

    const latlngs = this.polylineALatLngs(rec.polyline);
    if (latlngs.length < 2) return; // sin geometría válida → no pintamos recta falsa

    const linea = L.polyline(latlngs, {
      color: '#BF0B1B',
      weight: 5,
      opacity: 0.9,
    }).addTo(this.capaRecorrido);

    if (rec.estacion) {
      L.marker([rec.estacion.lat, rec.estacion.lng], { icon: flameIcon(26) })
        .bindTooltip(rec.estacion.nombre, {
          direction: 'top',
          className: 'poi-tip',
        })
        .addTo(this.capaRecorrido);
    }
    const fin = latlngs[latlngs.length - 1];
    L.circleMarker(fin, {
      radius: 9,
      color: '#fff',
      weight: 2,
      fillColor: '#F9B112',
      fillOpacity: 1,
    })
      .bindTooltip(destino?.nombre ?? 'Destino', {
        permanent: true,
        direction: 'top',
        className: 'poi-tip',
      })
      .addTo(this.capaRecorrido);

    try {
      this.map.fitBounds(linea.getBounds().pad(0.15));
    } catch {
      /* jsdom */
    }
    if (window.innerWidth <= 820) this.sidebarAbierto.set(false);
  }

  /**
   * Convierte la `polyline` del backend (GeoJSON LineString/MultiLineString o un
   * array crudo de pares) a `L.LatLng[]`. GeoJSON va en `[lng, lat]`; Leaflet en
   * `[lat, lng]`. Devuelve `[]` si la forma no es reconocible (no inventa).
   */
  private polylineALatLngs(polyline: unknown): L.LatLngExpression[] {
    const toLatLng = (pair: unknown): L.LatLngExpression | null => {
      if (
        Array.isArray(pair) &&
        pair.length >= 2 &&
        typeof pair[0] === 'number' &&
        typeof pair[1] === 'number'
      ) {
        return [pair[1], pair[0]]; // [lng,lat] → [lat,lng]
      }
      return null;
    };
    const flatten = (coords: unknown[]): L.LatLngExpression[] => {
      const out: L.LatLngExpression[] = [];
      for (const c of coords) {
        const ll = toLatLng(c);
        if (ll) out.push(ll);
      }
      return out;
    };

    if (polyline && typeof polyline === 'object' && 'type' in polyline) {
      const g = polyline as { type: string; coordinates?: unknown };
      if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
        return flatten(g.coordinates);
      }
      if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
        const out: L.LatLngExpression[] = [];
        for (const seg of g.coordinates)
          if (Array.isArray(seg)) out.push(...flatten(seg));
        return out;
      }
      return [];
    }
    // Array crudo de pares [lng,lat].
    if (Array.isArray(polyline)) return flatten(polyline);
    return [];
  }

  /** El alumno pidió empezar el examen de recorridos. */
  onIniciarExamenRecorridos(): void {
    const ciudad = this.ciudadSel();
    if (!ciudad) return;
    this.recExamenResultado.set(null);
    this.recError.set(null);
    this.recResultado.set(null);
    this.recDestino.set(null);
    this.safe(() => this.capaRecorrido?.clearLayers());
    this.service.generarExamenRecorrido(ciudad.id).subscribe({
      next: (ex) => this.arrancarExamenRecorridos(ex),
      error: () => {
        // El backend ya muestra el toast (BadRequest con motivo claro).
      },
    });
  }

  private arrancarExamenRecorridos(ex: GenerarExamenResponse): void {
    this.recExamToken = ex.token;
    this.recExamRetos = ex.retos;
    this.recExamIdx = 0;
    this.recExamAciertos = 0;
    this.recExamRespuestas = [];
    // Mapa calleId → parquesCobertura (D8) para el feedback inmediato local. La
    // nota la recalcula el backend; esto solo resalta acierto/fallo al vuelo.
    this.recCobertura.clear();
    for (const calle of ex.calles) {
      const cobertura = (calle as Calle & { parquesCobertura?: string[] })
        .parquesCobertura;
      if (Array.isArray(cobertura)) this.recCobertura.set(calle.id, cobertura);
    }
    this.pintarRetoRecorrido();
  }

  private pintarRetoRecorrido(): void {
    const reto = this.recExamRetos[this.recExamIdx];
    if (!reto) return;
    this.recExamRetoInicio = Date.now();
    const opciones = ((reto.opciones ?? []) as OpcionParqueExamen[]).map(
      (o) => o.parque,
    );
    this.recExamenView.set({
      calleNombre: reto.nombre,
      opciones,
      indice: this.recExamIdx + 1,
      total: this.recExamRetos.length,
      aciertos: this.recExamAciertos,
      feedback: null,
      elegido: null,
      correctos: this.recCobertura.get(reto.calleId) ?? [],
      esUltimo: this.recExamIdx >= this.recExamRetos.length - 1,
    });
  }

  /** El alumno eligió un parque para el reto actual. */
  onResponderParque(parque: string): void {
    const view = this.recExamenView();
    const reto = this.recExamRetos[this.recExamIdx];
    if (!view || view.feedback || !reto) return;

    const correctos = this.recCobertura.get(reto.calleId) ?? [];
    const ok = correctos.includes(parque); // D8: cualquier parque del conjunto
    if (ok) this.recExamAciertos++;

    this.recExamRespuestas.push({
      orden: reto.orden,
      respuestaParque: parque,
      tiempoMs: Math.max(0, Date.now() - this.recExamRetoInicio),
      agotoTiempo: false,
    });

    this.recExamenView.set({
      ...view,
      aciertos: this.recExamAciertos,
      elegido: parque,
      correctos,
      feedback: {
        ok,
        texto: ok
          ? `${parque} cubre esta calle.`
          : `Cubre: ${correctos.join(', ') || '—'}.`,
      },
    });
  }

  /** Avanza al siguiente reto del examen de recorridos o lo cierra. */
  onSiguienteRecorrido(): void {
    const esUltimo = this.recExamIdx >= this.recExamRetos.length - 1;
    if (esUltimo) {
      this.cerrarExamenRecorridos();
      return;
    }
    this.recExamIdx++;
    this.pintarRetoRecorrido();
  }

  private cerrarExamenRecorridos(): void {
    const token = this.recExamToken;
    const total = this.recExamRetos.length;
    const aciertos = this.recExamAciertos;
    this.recExamenView.set(null);
    if (!token) return;
    const tiempoTotalMs = this.recExamRespuestas.reduce(
      (s, r) => s + r.tiempoMs,
      0,
    );
    this.service
      .registrarExamen({
        token,
        tiempoTotalMs,
        respuestas: this.recExamRespuestas,
      })
      .subscribe({
        next: (res) => {
          this.recExamenResultado.set({
            nota: res.nota,
            aciertos: res.aciertos,
            total: res.totalRetos,
            aprobado: res.aprobado,
          });
        },
        error: () => {
          // Fallback: muestra el conteo local si el registro falla.
          this.recExamenResultado.set({
            nota: total ? Math.round((aciertos / total) * 10 * 10) / 10 : 0,
            aciertos,
            total,
            aprobado: total ? aciertos / total >= 0.5 : false,
          });
        },
      });
  }

  /** El alumno minimizó/restauró el pane de recorridos (no necesita reacción). */
  onMinimizarRecorrido(_min: boolean): void {
    // El estado lo gobierna el propio pane; el padre no necesita reaccionar.
  }
}
