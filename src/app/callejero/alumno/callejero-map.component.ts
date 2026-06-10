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
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ToastrService } from 'ngx-toastr';
import * as L from 'leaflet';
import { CallejeroService } from '../services/callejero.service';
import {
  Calle,
  Ciudad,
  ModoCallejero,
  Poi,
  ResumenProgresoZona,
  Zona,
} from '../models/callejero.model';
import { ProgresoPanelComponent } from './components/progreso-panel.component';

/** Atribución obligatoria (OSM ODbL + IGN CartoCiudad). */
const ATRIBUCION =
  '© OpenStreetMap contributors · © IGN CartoCiudad';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Umbral de proximidad (m) para acertar la ubicación de un POI. */
const POI_UMBRAL_METROS = 90;

interface OpcionModo {
  label: string;
  value: ModoCallejero;
}

interface FeedbackEstado {
  tipo: 'acierto' | 'fallo';
  texto: string;
}

interface OpcionQuiz {
  calleId: number;
  nombre: string;
}

/**
 * Componente central del módulo Callejero. Pinta un mapa Leaflet (tiles OSM con
 * atribución) y orquesta los 5 modos de práctica (Task 3.3 del plan):
 *  1. Explorar — tooltip con el nombre al pasar/hacer click. Sin scoring.
 *  2. Mapa mudo — calles sin etiqueta; botón "Revelar".
 *  3. Encuentra la calle X — el sistema pide una calle; el alumno hace click.
 *  4. ¿Qué calle es esta? — calle resaltada + 4 opciones (distractores reales).
 *  5. Ubicar POI — el alumno hace click en la ubicación del POI (proximidad).
 *
 * El estado se modela con signals; Leaflet se maneja imperativamente fuera de
 * la detección de cambios (capa GeoJSON re-pintada al cambiar de zona/modo).
 */
@Component({
  selector: 'app-callejero-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DropdownModule,
    ProgresoPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-map.component.html',
  styleUrl: './callejero-map.component.scss',
})
export class CallejeroMapComponent implements AfterViewInit, OnDestroy {
  private readonly service = inject(CallejeroService);
  private readonly toast = inject(ToastrService);

  @ViewChild('mapEl', { static: true })
  private readonly mapEl!: ElementRef<HTMLDivElement>;

  // ---- Estado de carga / selección ----
  readonly ciudades = signal<Ciudad[]>([]);
  readonly ciudadSel = signal<Ciudad | null>(null);
  readonly zonas = signal<Zona[]>([]);
  readonly zonaSel = signal<Zona | null>(null);
  readonly calles = signal<Calle[]>([]);
  readonly pois = signal<Poi[]>([]);
  readonly progreso = signal<ResumenProgresoZona[]>([]);
  readonly loadingCiudades = signal<boolean>(true);
  readonly loadingZona = signal<boolean>(false);

  // ---- Estado de modos ----
  readonly modo = signal<ModoCallejero>('EXPLORAR');
  readonly modos: OpcionModo[] = [
    { label: 'Explorar', value: 'EXPLORAR' },
    { label: 'Mapa mudo', value: 'MAPA_MUDO' },
    { label: 'Encuentra la calle', value: 'ENCUENTRA_CALLE' },
    { label: '¿Qué calle es?', value: 'QUE_CALLE_ES' },
    { label: 'Ubicar POI', value: 'UBICAR_POI' },
  ];

  /** Reto activo (calle o POI objetivo) y opciones del quiz. */
  readonly retoCalle = signal<Calle | null>(null);
  readonly retoPoi = signal<Poi | null>(null);
  readonly opcionesQuiz = signal<OpcionQuiz[]>([]);
  readonly feedback = signal<FeedbackEstado | null>(null);
  readonly mudoRevelado = signal<boolean>(false);

  readonly hayZona = computed(() => this.zonaSel() !== null);
  readonly esModoScoring = computed(() =>
    ['ENCUENTRA_CALLE', 'QUE_CALLE_ES', 'UBICAR_POI'].includes(this.modo()),
  );

  // ---- Leaflet (imperativo, fuera de signals) ----
  private map?: L.Map;
  private capaCalles?: L.GeoJSON;
  private capaZona?: L.GeoJSON;
  private capaPois?: L.LayerGroup;
  /** id de calle → layer Leaflet, para resaltar el reto de "¿Qué calle es?". */
  private readonly layerPorCalleId = new Map<number, L.Path>();

  // ============ Lifecycle ============

  ngAfterViewInit(): void {
    this.initMapa();
    this.cargarCiudades();
  }

  ngOnDestroy(): void {
    try {
      this.map?.remove();
    } catch {
      // Leaflet puede fallar al desmontar capas SVG en entornos sin layout
      // real (jsdom/tests). En navegador real no ocurre; lo ignoramos para no
      // dejar un error sin capturar al destruir el componente.
    }
    this.map = undefined;
  }

  private initMapa(): void {
    const map = L.map(this.mapEl.nativeElement, {
      center: [39.47, -0.376], // Valencia centro (fallback)
      zoom: 14,
    });
    L.tileLayer(OSM_TILES, {
      maxZoom: 19,
      attribution: ATRIBUCION,
    }).addTo(map);
    // Click en mapa vacío → modo Ubicar POI evalúa la proximidad.
    map.on('click', (e: L.LeafletMouseEvent) => this.onMapClick(e));
    this.map = map;
  }

  // ============ Carga de datos ============

  private cargarCiudades(): void {
    this.loadingCiudades.set(true);
    this.service.listarCiudades().subscribe({
      next: (ciudades) => {
        this.ciudades.set(ciudades);
        this.loadingCiudades.set(false);
        if (ciudades.length > 0) {
          this.seleccionarCiudad(ciudades[0]);
        }
      },
      error: () => this.loadingCiudades.set(false),
    });
  }

  seleccionarCiudad(ciudad: Ciudad | null): void {
    if (!ciudad) return;
    this.ciudadSel.set(ciudad);
    this.zonaSel.set(null);
    this.calles.set([]);
    this.limpiarReto();
    this.ajustarVistaBbox(ciudad.bbox);
    this.service.listarZonas(ciudad.id).subscribe({
      next: (zonas) => {
        this.zonas.set(zonas);
        this.pintarContornosZonas(zonas);
      },
    });
    this.cargarProgreso(ciudad.id);
  }

  seleccionarZona(zona: Zona | null): void {
    if (!zona) return;
    this.zonaSel.set(zona);
    this.loadingZona.set(true);
    this.limpiarReto();
    this.service.listarCalles(zona.id).subscribe({
      next: ({ calles, pois }) => {
        this.calles.set(calles);
        this.pois.set(pois);
        this.loadingZona.set(false);
        this.pintarCalles(calles);
        this.pintarPois(pois);
        this.ajustarVistaZona();
        this.aplicarModoActual();
      },
      error: () => this.loadingZona.set(false),
    });
  }

  private cargarProgreso(ciudadId: number): void {
    this.service.resumenProgreso(ciudadId).subscribe({
      next: (res) => this.progreso.set(res.zonas),
      error: () => {
        /* progreso es secundario: silencioso */
      },
    });
  }

  // ============ Pintado Leaflet ============

  private pintarContornosZonas(zonas: Zona[]): void {
    if (!this.map) return;
    this.capaZona?.remove();
    const fc = {
      type: 'FeatureCollection' as const,
      features: zonas.map((z) => ({
        type: 'Feature' as const,
        properties: { zonaId: z.id, nombre: z.nombre },
        geometry: z.geometria,
      })),
    };
    this.capaZona = L.geoJSON(fc, {
      style: {
        color: '#dc2626',
        weight: 1.5,
        fillOpacity: 0.04,
      },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          const zonaId = feature.properties?.['zonaId'] as number | undefined;
          const zona = this.zonas().find((z) => z.id === zonaId) ?? null;
          this.seleccionarZona(zona);
        });
      },
    }).addTo(this.map);
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
        const calle = calles.find((c) => c.id === calleId);
        if (!calle) return;
        if (layer instanceof L.Path) {
          this.layerPorCalleId.set(calleId, layer);
        }
        layer.on('click', () => this.onCalleClick(calle));
        layer.on('mouseover', () => this.onCalleHover(calle, layer));
        layer.on('mouseout', () => this.onCalleOut(calle, layer));
      },
    }).addTo(this.map);
  }

  private pintarPois(pois: Poi[]): void {
    if (!this.map) return;
    this.capaPois?.remove();
    const grupo = L.layerGroup();
    for (const poi of pois) {
      // circleMarker evita el bug clásico de los iconos de Leaflet en bundlers.
      L.circleMarker([poi.lat, poi.lng], {
        radius: 7,
        color: poi.tipo === 'PARQUE_BOMBEROS' ? '#dc2626' : '#0891b2',
        fillColor: poi.tipo === 'PARQUE_BOMBEROS' ? '#ef4444' : '#06b6d4',
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindTooltip(poi.nombre)
        .addTo(grupo);
    }
    this.capaPois = grupo;
    // En "Ubicar POI" se ocultan hasta resolver; aquí solo se preparan.
    if (this.modo() !== 'UBICAR_POI') {
      grupo.addTo(this.map);
    }
  }

  private ajustarVistaBbox(bbox: [number, number, number, number]): void {
    if (!this.map) return;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    this.map.fitBounds([
      [minLat, minLng],
      [maxLat, maxLng],
    ]);
  }

  private ajustarVistaZona(): void {
    if (!this.map || !this.capaCalles) return;
    const bounds = this.capaCalles.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  // ============ Interacción con calles ============

  private onCalleHover(calle: Calle, layer: L.Layer): void {
    if (layer instanceof L.Path) {
      layer.setStyle({ weight: 6, opacity: 1 });
    }
    // Explorar y modos no-mudos: tooltip con el nombre.
    if (this.modo() === 'EXPLORAR') {
      (layer as L.Path)
        .bindTooltip(calle.nombre, { sticky: true })
        .openTooltip();
    }
  }

  private onCalleOut(_calle: Calle, layer: L.Layer): void {
    if (layer instanceof L.Path) {
      layer.setStyle({ weight: 3, opacity: 0.8 });
      layer.closeTooltip();
    }
  }

  private onCalleClick(calle: Calle): void {
    switch (this.modo()) {
      case 'EXPLORAR':
        this.toast.info(calle.nombre);
        break;
      case 'MAPA_MUDO':
        // En mudo el click revela puntualmente el nombre.
        this.toast.info(calle.nombre);
        break;
      case 'ENCUENTRA_CALLE':
        this.resolverEncuentraCalle(calle);
        break;
      case 'QUE_CALLE_ES':
        // El click no resuelve este modo (se responde con las opciones).
        break;
      case 'UBICAR_POI':
        // El POI se ubica con click en el mapa, no en una calle.
        break;
    }
  }

  private onMapClick(e: L.LeafletMouseEvent): void {
    if (this.modo() !== 'UBICAR_POI') return;
    const reto = this.retoPoi();
    if (!reto) return;
    this.resolverUbicarPoi(e.latlng, reto);
  }

  // ============ Cambio de modo ============

  cambiarModo(modo: ModoCallejero): void {
    this.modo.set(modo);
    this.aplicarModoActual();
  }

  private aplicarModoActual(): void {
    this.limpiarFeedback();
    this.mudoRevelado.set(false);
    this.retoCalle.set(null);
    this.retoPoi.set(null);
    this.opcionesQuiz.set([]);
    this.resaltarReto(null);
    this.actualizarVisibilidadPois();

    switch (this.modo()) {
      case 'ENCUENTRA_CALLE':
        this.nuevoRetoEncuentraCalle();
        break;
      case 'QUE_CALLE_ES':
        this.nuevoRetoQueCalleEs();
        break;
      case 'UBICAR_POI':
        this.nuevoRetoUbicarPoi();
        break;
      default:
        break;
    }
  }

  private actualizarVisibilidadPois(): void {
    if (!this.map || !this.capaPois) return;
    if (this.modo() === 'UBICAR_POI') {
      this.capaPois.remove();
    } else {
      this.capaPois.addTo(this.map);
    }
  }

  // ============ Modo 3: Encuentra la calle X ============

  nuevoRetoEncuentraCalle(): void {
    const calle = this.calleAleatoria();
    this.retoCalle.set(calle);
    this.limpiarFeedback();
    this.resaltarReto(null);
  }

  private resolverEncuentraCalle(clic: Calle): void {
    const reto = this.retoCalle();
    if (!reto) return;
    const acierto = clic.codigoExterno === reto.codigoExterno;
    this.registrar(reto.id, acierto);
    this.feedback.set(
      acierto
        ? { tipo: 'acierto', texto: `¡Correcto! Es ${reto.nombre}.` }
        : { tipo: 'fallo', texto: `No. Has marcado ${clic.nombre}.` },
    );
  }

  // ============ Modo 4: ¿Qué calle es esta? ============

  nuevoRetoQueCalleEs(): void {
    const objetivo = this.calleAleatoria();
    this.retoCalle.set(objetivo);
    this.opcionesQuiz.set(objetivo ? this.construirOpciones(objetivo) : []);
    this.limpiarFeedback();
    this.resaltarReto(objetivo?.id ?? null);
  }

  responderQuiz(opcion: OpcionQuiz): void {
    const reto = this.retoCalle();
    if (!reto) return;
    const acierto = opcion.calleId === reto.id;
    this.registrar(reto.id, acierto);
    this.feedback.set(
      acierto
        ? { tipo: 'acierto', texto: `¡Correcto! Es ${reto.nombre}.` }
        : { tipo: 'fallo', texto: `No. Era ${reto.nombre}.` },
    );
  }

  /** 4 opciones: la correcta + 3 distractores reales de la misma zona. */
  private construirOpciones(objetivo: Calle): OpcionQuiz[] {
    const otras = this.calles().filter(
      (c) => c.id !== objetivo.id && c.nombre !== objetivo.nombre,
    );
    const distractores = this.muestreo(otras, 3).map((c) => ({
      calleId: c.id,
      nombre: c.nombre,
    }));
    const opciones: OpcionQuiz[] = [
      { calleId: objetivo.id, nombre: objetivo.nombre },
      ...distractores,
    ];
    return this.barajar(opciones);
  }

  // ============ Modo 5: Ubicar POI ============

  nuevoRetoUbicarPoi(): void {
    const pois = this.pois();
    if (pois.length === 0) {
      this.retoPoi.set(null);
      return;
    }
    const poi = pois[Math.floor(Math.random() * pois.length)];
    this.retoPoi.set(poi);
    this.limpiarFeedback();
  }

  private resolverUbicarPoi(clic: L.LatLng, reto: Poi): void {
    const distancia = clic.distanceTo(L.latLng(reto.lat, reto.lng));
    const acierto = distancia <= POI_UMBRAL_METROS;
    this.feedback.set(
      acierto
        ? {
            tipo: 'acierto',
            texto: `¡Correcto! ${reto.nombre} (${Math.round(distancia)} m).`,
          }
        : {
            tipo: 'fallo',
            texto: `Lejos: a ${Math.round(distancia)} m de ${reto.nombre}.`,
          },
    );
  }

  // ============ Mapa mudo ============

  toggleRevelarMudo(): void {
    this.mudoRevelado.update((v) => !v);
    if (!this.capaCalles) return;
    if (this.mudoRevelado()) {
      this.capaCalles.eachLayer((layer) => {
        const feature = (layer as L.GeoJSON).feature;
        const nombre =
          feature && feature.type === 'Feature'
            ? (feature.properties?.['nombre'] as string | undefined)
            : undefined;
        if (nombre && layer instanceof L.Path) {
          layer.bindTooltip(nombre, { permanent: true, direction: 'center' });
        }
      });
    } else {
      this.capaCalles.eachLayer((layer) => {
        if (layer instanceof L.Path) layer.unbindTooltip();
      });
    }
  }

  // ============ Helpers de scoring / progreso ============

  private registrar(calleId: number, acierto: boolean): void {
    this.service.registrarProgreso(calleId, acierto).subscribe({
      next: (res) => {
        if (res && 'zonas' in res) {
          this.progreso.set(res.zonas);
        } else {
          const ciudad = this.ciudadSel();
          if (ciudad) this.cargarProgreso(ciudad.id);
        }
      },
      error: () => {
        const ciudad = this.ciudadSel();
        if (ciudad) this.cargarProgreso(ciudad.id);
      },
    });
  }

  // ============ Helpers genéricos ============

  private calleAleatoria(): Calle | null {
    const calles = this.calles();
    if (calles.length === 0) return null;
    return calles[Math.floor(Math.random() * calles.length)];
  }

  private resaltarReto(calleId: number | null): void {
    // Restaura estilo por defecto y resalta la calle objetivo en amarillo.
    this.layerPorCalleId.forEach((layer) =>
      layer.setStyle({ color: '#2563eb', weight: 3, opacity: 0.8 }),
    );
    if (calleId == null) return;
    const layer = this.layerPorCalleId.get(calleId);
    layer?.setStyle({ color: '#f59e0b', weight: 7, opacity: 1 });
  }

  private muestreo<T>(arr: T[], n: number): T[] {
    return this.barajar([...arr]).slice(0, n);
  }

  private barajar<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private limpiarReto(): void {
    this.retoCalle.set(null);
    this.retoPoi.set(null);
    this.opcionesQuiz.set([]);
    this.calles.set([]);
    this.pois.set([]);
    this.limpiarFeedback();
  }

  private limpiarFeedback(): void {
    this.feedback.set(null);
  }
}
