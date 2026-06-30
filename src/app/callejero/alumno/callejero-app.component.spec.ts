import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import {
  CalleCiudad,
  CalleModificada,
  Calle,
  Ciudad,
  PoiCiudad,
  RecorridoResponse,
  Zona,
} from '../models/callejero.model';
import { CallejeroService } from '../services/callejero.service';
import { CallejeroAppComponent } from './callejero-app.component';

/**
 * Tests del callejero v3 (port de Raúl). El renderizado Leaflet se valida por QA
 * visual; aquí cubrimos la lógica: carga de datos, tabs, capas, modo Estudio,
 * generación y puntuación del examen.
 */

const CIUDAD: Ciudad = {
  id: 1,
  slug: 'valencia',
  nombre: 'València',
  bbox: [-0.45, 39.35, -0.3, 39.52],
};

// Un polígono cuadrado simple (lng,lat) que cubre la zona de prueba.
const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-0.4, 39.45],
      [-0.35, 39.45],
      [-0.35, 39.5],
      [-0.4, 39.5],
      [-0.4, 39.45],
    ],
  ],
};
const ZONAS: Zona[] = [
  {
    id: 10,
    ciudadId: 1,
    codigo: 'BMV-CAM3',
    nombre: 'Campanar (Oeste)',
    tipo: 'PARQUE',
    geometria: SQUARE,
    color: '#880E4F',
    parque: 'Campanar',
    coopera: 'Oeste',
    areaName: 'Campanar (Oeste)',
  },
];
const POIS: PoiCiudad[] = [
  {
    id: 1,
    nombre: 'Parque Bomberos Campanar',
    tipo: 'PARQUE_BOMBEROS',
    categoria: 'bomberos',
    lat: 39.47,
    lng: -0.37,
    zonaId: 10,
  },
  {
    id: 2,
    nombre: 'Hospital La Fe',
    tipo: 'HOSPITAL',
    categoria: 'hospital',
    lat: 39.46,
    lng: -0.376,
    zonaId: 10,
  },
  {
    id: 3,
    nombre: 'IVAM',
    tipo: 'OTRO',
    categoria: 'museo',
    lat: 39.479,
    lng: -0.382,
    zonaId: 10,
  },
  {
    id: 4,
    nombre: 'Mestalla',
    tipo: 'OTRO',
    categoria: 'lugar',
    lat: 39.474,
    lng: -0.358,
    zonaId: 10,
  },
  {
    id: 5,
    nombre: 'Jardín del Turia',
    tipo: 'OTRO',
    categoria: 'parque',
    lat: 39.466,
    lng: -0.361,
    zonaId: 10,
  },
  {
    id: 6,
    nombre: 'Calle Colón',
    tipo: 'OTRO',
    categoria: 'calle',
    lat: 39.469,
    lng: -0.371,
    zonaId: 10,
  },
];

const CALLES: Calle[] = [
  {
    id: 100,
    zonaId: 10,
    codigoExterno: 'c100',
    nombre: 'Av. del Cid',
    tipoVia: 'Avenida',
    codigoPostal: null,
    geometria: { type: 'LineString', coordinates: [] },
  },
];

/** Calles de ciudad con punto medio + longitud (T4). */
const CALLES_CIUDAD: CalleCiudad[] = [
  {
    id: 1001,
    nombre: 'Avenida del Puerto',
    tipoVia: 'Avenida',
    lat: 39.471,
    lng: -0.362,
    longitudM: 600,
    parquesCobertura: ['Campanar'],
  },
  {
    id: 1002,
    nombre: 'Calle Colón',
    tipoVia: 'Calle',
    lat: 39.469,
    lng: -0.371,
    longitudM: 200,
    parquesCobertura: ['Centro'],
  },
  {
    id: 1003,
    nombre: 'Calle Corta',
    tipoVia: 'Calle',
    lat: 39.465,
    lng: -0.368,
    longitudM: 80,
    parquesCobertura: ['Centro'],
  },
];

const RECORRIDO: RecorridoResponse = {
  polyline: {
    type: 'LineString',
    coordinates: [
      [-0.37, 39.47],
      [-0.36, 39.46],
    ],
  },
  calles: ['Av. del Cid', 'Calle Colón'],
  km: 2.1,
  minutos: 5,
  estacion: { nombre: 'Parque Campanar', lat: 39.48, lng: -0.38 },
};

const CALLES_MODIFICADAS: CalleModificada[] = [
  {
    nombreNuevo: 'Av. de la Constitución',
    nombreAntiguo: 'Calle General Mola',
    tipoVia: 'Avenida',
  },
  {
    nombreNuevo: 'Calle de la Democracia',
    nombreAntiguo: 'Calle del Caudillo',
    tipoVia: 'Calle',
  },
  {
    nombreNuevo: 'Av. de los Derechos Humanos',
    nombreAntiguo: 'Av. del Generalísimo',
    tipoVia: 'Avenida',
  },
  {
    nombreNuevo: 'Calle de la Paz',
    nombreAntiguo: 'Calle de la Victoria',
    tipoVia: 'Calle',
  },
];

const RECORRIDO_LIBRE = {
  direccionResuelta: 'Calle de Colón 12, València',
  lat: 39.4699,
  lng: -0.3712,
  parqueNombre: 'Centro',
  estacion: { nombre: 'Parque Centro', lat: 39.4665, lng: -0.3759 },
  // Contrato v27: pares crudos [lat, lng] (NO GeoJSON).
  polyline: [
    [39.4665, -0.3759],
    [39.4699, -0.3712],
  ] as [number, number][],
  km: 1.4,
  minutos: 4,
};

function mockService() {
  return {
    listarCiudades: jest.fn().mockReturnValue(of([CIUDAD])),
    listarZonas: jest.fn().mockReturnValue(of(ZONAS)),
    listarPoisCiudad: jest.fn().mockReturnValue(of(POIS)),
    listarCalles: jest.fn().mockReturnValue(of({ calles: CALLES, pois: [] })),
    listarCallesCiudad: jest.fn().mockReturnValue(of([])),
    listarCallesModificadas: jest.fn().mockReturnValue(of([])),
    geocodeReverse: jest
      .fn()
      .mockReturnValue(of({ direccion: 'Calle Test 1, València' })),
    geocodeBuscar: jest
      .fn()
      .mockReturnValue(
        of([{ nombre: 'Av. del Puerto 12, València', lat: 39.47, lng: -0.36 }]),
      ),
    getRecorrido: jest.fn().mockReturnValue(of(RECORRIDO)),
    getRecorridoLibre: jest.fn().mockReturnValue(of(RECORRIDO_LIBRE)),
    generarExamenRecorrido: jest.fn().mockReturnValue(
      of({
        token: 'tok',
        tipoExamen: 'RECORRIDO',
        ciudadId: 1,
        zonaIds: [],
        totalRetos: 1,
        duracionRetoMs: 1000,
        calles: [{ ...CALLES[0], parquesCobertura: ['Campanar'] }],
        retos: [
          {
            orden: 0,
            tipo: 'RECORRIDO',
            calleId: 100,
            nombre: 'Av. del Cid',
            opciones: [{ parque: 'Campanar' }, { parque: 'Centro' }],
          },
        ],
      }),
    ),
    registrarExamen: jest.fn().mockReturnValue(
      of({
        intentoId: 1,
        creadoEn: '',
        ciudadId: 1,
        zonaIds: [],
        totalRetos: 1,
        aciertos: 1,
        fallos: 0,
        nota: 10,
        aprobado: true,
        tiempoTotalMs: 100,
        detalle: [],
      }),
    ),
    registrarResultadoExamen: jest
      .fn()
      .mockReturnValue(of({ intentoId: 1, nota: 10, aprobado: true })),
    leaderboardExamen: jest
      .fn()
      .mockReturnValue(
        of({ ciudadId: 1, total: 0, top: [], miRango: null, miOptIn: false }),
      ),
    setLeaderboardOptIn: jest.fn().mockReturnValue(of({ optIn: true })),
  };
}

describe('CallejeroAppComponent', () => {
  let fixture: ComponentFixture<CallejeroAppComponent>;
  let component: CallejeroAppComponent;
  let svc: ReturnType<typeof mockService>;

  beforeEach(async () => {
    svc = mockService();
    await TestBed.configureTestingModule({
      imports: [CallejeroAppComponent],
      providers: [
        { provide: CallejeroService, useValue: svc },
        {
          provide: ToastrService,
          useValue: { info: jest.fn(), error: jest.fn() },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CallejeroAppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngAfterViewInit → mapa + carga
  });

  afterEach(() => fixture.destroy());

  it('carga ciudad, zonas y POIs', () => {
    expect(svc.listarCiudades).toHaveBeenCalled();
    expect(svc.listarZonas).toHaveBeenCalledWith(1);
    expect(svc.listarPoisCiudad).toHaveBeenCalledWith(1);
    expect(component.zonas().length).toBe(1);
    expect(component.pois().length).toBe(6);
  });

  it('cuenta POIs por categoría', () => {
    expect(component.countCat('bomberos')).toBe(1);
    expect(component.countCat('museo')).toBe(1);
    expect(component.countCat('calle')).toBe(1);
  });

  it('listasEstudio agrupa por categoría y filtra por búsqueda', () => {
    expect(component.listasEstudio().length).toBe(6); // 6 categorías con 1 item
    component.buscar.set('hospital');
    const g = component.listasEstudio();
    expect(g.length).toBe(1);
    expect(g[0].cat).toBe('hospital');
  });

  it('cambia de pestaña', () => {
    expect(component.tab()).toBe('mapa');
    component.setTab('examen');
    expect(component.tab()).toBe('examen');
  });

  it('empezarExamen genera retos de las categorías elegidas', () => {
    component.cfgN.set(5);
    component.empezarExamen();
    expect(component.examOn()).toBe(true);
    expect(component.totalRetos()).toBe(5);
    expect(component.retoActual()).not.toBeNull();
  });

  it('responder una opción correcta suma acierto y puntos', () => {
    // Forzar un reto de tipo zona respondible.
    component.cfgN.set(6);
    component.empezarExamen();
    // Empujar un reto 'zona' conocido al estado actual.
    (component as any).retos[component['retoIdx']()] = {
      poi: POIS[1],
      zona: ZONAS[0],
      tipo: 'zona',
    };
    (component as any).espera = true;
    component.retoActual.set((component as any).retos[component['retoIdx']()]);
    component.responderOpcion('Campanar'); // parque correcto
    expect(component.aciertos()).toBe(1);
    expect(component.puntos()).toBeGreaterThan(0);
    expect(component.feedback()?.ok).toBe(true);
  });

  it('sin ciudades accesibles → paywall (sinAcceso)', async () => {
    svc.listarCiudades.mockReturnValue(of([]));
    const fx = TestBed.createComponent(CallejeroAppComponent);
    fx.detectChanges();
    const cmp = fx.componentInstance;
    expect(cmp.cargando()).toBe(false);
    expect(cmp.sinAcceso()).toBe(true);
    fx.destroy();
  });

  it('con ciudad accesible → NO paywall', () => {
    expect(component.sinAcceso()).toBe(false);
  });

  it('verLeaderboard carga la clasificación', () => {
    component.verLeaderboard();
    expect(svc.leaderboardExamen).toHaveBeenCalledWith(1);
    expect(component.leaderboardVisible()).toBe(true);
  });

  // ── Recorridos (Callejero v10) ────────────────────────────────────────────

  it('hay una 4ª pestaña Recorridos', () => {
    component.setTab('recorridos');
    expect(component.tab()).toBe('recorridos');
  });

  it('carga el catálogo de calles para el autocomplete al elegir ciudad', () => {
    expect(svc.listarCalles).toHaveBeenCalledWith(10);
    expect(component.recCalles().length).toBe(1);
    expect(component.recCalles()[0].nombre).toBe('Av. del Cid');
  });

  it('onBuscarDestino con éxito guarda el recorrido (sin error)', () => {
    component.onBuscarDestino(100);
    expect(svc.getRecorrido).toHaveBeenCalledWith(100);
    expect(component.recResultado()?.km).toBe(2.1);
    expect(component.recError()).toBeNull();
    expect(component.recLoading()).toBe(false);
  });

  it('onBuscarDestino con 404 → error no-disponible, sin recorrido (D7)', () => {
    svc.getRecorrido.mockReturnValue(throwError(() => new Error('404')));
    component.onBuscarDestino(100);
    expect(component.recResultado()).toBeNull();
    expect(component.recError()).toBe('no-disponible');
    expect(component.recLoading()).toBe(false);
  });

  // ── Modo "dirección libre" (Callejero v27) ────────────────────────────────

  it('onBuscarDireccionLibre con éxito guarda el recorrido (km/min) + destino resuelto, sin error', () => {
    component.onBuscarDireccionLibre('Calle Colón 12');
    expect(svc.getRecorridoLibre).toHaveBeenCalledWith(1, 'Calle Colón 12');
    expect(component.recResultado()?.km).toBe(1.4);
    expect(component.recResultado()?.minutos).toBe(4);
    // El destino se modela como Calle sintética con la dirección resuelta.
    expect(component.recDestino()?.nombre).toBe('Calle de Colón 12, València');
    expect(component.recError()).toBeNull();
    expect(component.recLoading()).toBe(false);
  });

  it('onBuscarDireccionLibre no llama al backend con texto en blanco', () => {
    component.onBuscarDireccionLibre('   ');
    expect(svc.getRecorridoLibre).not.toHaveBeenCalled();
  });

  it('onBuscarDireccionLibre con 404 → error NO_GEOCODE, sin recorrido (D7)', () => {
    svc.getRecorridoLibre.mockReturnValue(
      throwError(() => ({ status: 404, error: { code: 'NO_GEOCODE' } })),
    );
    component.onBuscarDireccionLibre('Calle inexistente');
    expect(component.recResultado()).toBeNull();
    expect(component.recDestino()).toBeNull();
    expect(component.recError()).toBe('NO_GEOCODE');
    expect(component.recLoading()).toBe(false);
  });

  it('onBuscarDireccionLibre con 503 → error ROUTE_UNAVAILABLE (D7)', () => {
    svc.getRecorridoLibre.mockReturnValue(
      throwError(() => ({ status: 503, error: { code: 'ROUTE_UNAVAILABLE' } })),
    );
    component.onBuscarDireccionLibre('Calle Colón 12');
    expect(component.recResultado()).toBeNull();
    expect(component.recError()).toBe('ROUTE_UNAVAILABLE');
  });

  it('examen de recorridos: generar → responder (D8) → registrar nota', () => {
    component.onIniciarExamenRecorridos(['Campanar']);
    expect(svc.generarExamenRecorrido).toHaveBeenCalledWith(1, [], 'MEDIO');
    const view = component.recExamenView();
    expect(view).not.toBeNull();
    expect(view?.calleNombre).toBe('Av. del Cid');
    expect(view?.opciones).toContain('Campanar');

    // Responder el parque correcto (cobertura D8).
    component.onResponderParque('Campanar');
    expect(component.recExamenView()?.feedback?.ok).toBe(true);
    expect(component.recExamenView()?.aciertos).toBe(1);

    // Último reto → cerrar → registrar.
    component.onSiguienteRecorrido();
    expect(svc.registrarExamen).toHaveBeenCalled();
    expect(component.recExamenView()).toBeNull();
    expect(component.recExamenResultado()?.nota).toBe(10);
  });

  it('salir de la pestaña Recorridos limpia el estado del recorrido', () => {
    component.onBuscarDestino(100);
    expect(component.recResultado()).not.toBeNull();
    component.setTab('recorridos');
    component.setTab('mapa');
    expect(component.recResultado()).toBeNull();
    expect(component.recDestino()).toBeNull();
  });

  it('onModoRecorridoCambiado limpia resultado/error/destino del modo anterior, sin tocar el examen', () => {
    // Examen en curso (flujo aparte que NO debe limpiarse al alternar modo).
    component.onIniciarExamenRecorridos(['Campanar']);
    expect(component.recExamenView()).not.toBeNull();
    // Búsqueda previa con resultado (estado compartido entre modos).
    component.onBuscarDestino(100);
    expect(component.recResultado()).not.toBeNull();
    expect(component.recDestino()).not.toBeNull();

    component.onModoRecorridoCambiado('direccion-libre');

    expect(component.recResultado()).toBeNull();
    expect(component.recError()).toBeNull();
    expect(component.recDestino()).toBeNull();
    expect(component.recLoading()).toBe(false);
    // El examen sigue intacto.
    expect(component.recExamenView()).not.toBeNull();
  });

  it('escapeHtml escapa los metacaracteres (sink XSS de los tooltips del modo libre)', () => {
    const out = (component as any).escapeHtml(
      '<img src=x onerror=alert(1)> & "q" \'p\'',
    );
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
    expect(out).toContain('&gt;');
    expect(out).toContain('&amp;');
    expect(out).toContain('&quot;');
    expect(out).toContain('&#39;');
  });

  it('toggleFichaMinimizada alterna el estado y cerrarFicha lo resetea', () => {
    component.ficha.set({
      titulo: 'Calle Colón',
      sub: 'Calle',
      campos: [{ k: 'zona', v: 'Campanar' }],
    });
    expect(component.fichaMinimizada()).toBe(false);

    component.toggleFichaMinimizada();
    expect(component.fichaMinimizada()).toBe(true);

    component.toggleFichaMinimizada();
    expect(component.fichaMinimizada()).toBe(false);

    component.fichaMinimizada.set(true);
    component.cerrarFicha();
    expect(component.fichaMinimizada()).toBe(false);
    expect(component.ficha()).toBeNull();
  });

  describe('filtros de examen (dificultad + zonas + soloZonas)', () => {
    it('catsPorDif FACIL excluye lugar y calle', () => {
      component.dificultadExamen.set('FACIL');
      component.cfgN.set(10);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      expect(component.totalRetos()).toBe(4);
      const cats = (component as any).retos.map((r: any) => r.poi.categoria);
      expect(cats).not.toContain('lugar');
      expect(cats).not.toContain('calle');
    });

    it('catsPorDif MEDIO incluye lugar pero excluye calle', () => {
      component.dificultadExamen.set('MEDIO');
      component.cfgN.set(10);
      component.empezarExamen();
      expect(component.totalRetos()).toBe(5);
      const cats = (component as any).retos.map((r: any) => r.poi.categoria);
      expect(cats).not.toContain('calle');
    });

    it('selección de parques acota los candidatos del examen', () => {
      component.parquesSeleccion.set(new Set());
      component.dificultadExamen.set('MEDIO');
      const toastSpy = jest.spyOn((component as any).toast, 'info');
      component.empezarExamen();
      expect(component.examOn()).toBe(false);
      expect(toastSpy).toHaveBeenCalledWith(
        expect.stringContaining('suficientes'),
      );
    });

    it('cfgSoloZonas genera solo retos de tipo zona o coopera', () => {
      component.cfgSoloZonas.set(true);
      component.cfgN.set(10);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const tipos = (component as any).retos.map((r: any) => r.tipo);
      expect(tipos.every((t: string) => t === 'zona' || t === 'coopera')).toBe(
        true,
      );
    });

    it('onCfgSoloZonasChange(true) fuerza cfgZonas a true', () => {
      component.cfgZonas.set(false);
      component.onCfgSoloZonasChange(true);
      expect(component.cfgSoloZonas()).toBe(true);
      expect(component.cfgZonas()).toBe(true);
    });

    it('onCfgSoloZonasChange(false) desactiva cfgSoloZonas sin tocar cfgZonas', () => {
      component.cfgZonas.set(true);
      component.onCfgSoloZonasChange(false);
      expect(component.cfgSoloZonas()).toBe(false);
      expect(component.cfgZonas()).toBe(true);
    });

    it('parquesUnicos derivados de zonas()', () => {
      expect(component.parquesUnicos()).toEqual(['Campanar']);
    });

    it('opcionesTol son Amplia/Media/Estricta etiquetadas', () => {
      const labels = component.opcionesTol.map((t) => t.label);
      expect(labels).toContain('Amplia · 500 m');
      expect(labels).toContain('Media · 300 m');
      expect(labels).toContain('Estricta · 175 m');
      const valores = component.opcionesTol.map((t) => t.valor);
      expect(valores).toContain(500);
      expect(valores).toContain(300);
      expect(valores).toContain(175);
    });

    it('onIniciarExamenRecorridos con todos los parques pasa zonaIds=[]', () => {
      component.onIniciarExamenRecorridos(['Campanar']);
      expect(svc.generarExamenRecorrido).toHaveBeenCalledWith(1, [], 'MEDIO');
    });

    it('onIniciarExamenRecorridos con parques vacíos pasa zonaIds=[]', () => {
      component.onIniciarExamenRecorridos([]);
      expect(svc.generarExamenRecorrido).toHaveBeenCalledWith(1, [], 'MEDIO');
    });

    it('toggleColapso pliega y despliega una categoría en Estudio', () => {
      // TA2: todas las categorías de CAT_ORDER arrancan colapsadas.
      expect(component.colapsadas().has('hospital')).toBe(true);
      component.toggleColapso('hospital');
      expect(component.colapsadas().has('hospital')).toBe(false);
      component.toggleColapso('hospital');
      expect(component.colapsadas().has('hospital')).toBe(true);
    });
  });

  // ── callesCiudad — T1 (carga), T2 (estudio/dedup), T3 (examen), T6 (cfgSoloZonas) ──

  describe('callesCiudad (T1/T3/T6)', () => {
    it('vialesPorDif FACIL solo devuelve calles con longitudM ≥ 450 m', () => {
      component.callesCiudad.set(CALLES_CIUDAD);
      const result = component.vialesPorDif('FACIL');
      expect(result.length).toBe(1);
      expect(result[0].nombre).toBe('Avenida del Puerto');
    });

    it('vialesPorDif MEDIO devuelve calles con longitudM ≥ 150 m', () => {
      component.callesCiudad.set(CALLES_CIUDAD);
      const result = component.vialesPorDif('MEDIO');
      expect(result.length).toBe(2);
      const nombres = result.map((c) => c.nombre);
      expect(nombres).toContain('Avenida del Puerto');
      expect(nombres).toContain('Calle Colón');
    });

    it('vialesPorDif DIFICIL devuelve todas las calles sin filtro de longitud', () => {
      component.callesCiudad.set(CALLES_CIUDAD);
      const result = component.vialesPorDif('DIFICIL');
      expect(result.length).toBe(3);
    });

    it('empezarExamen DIFICIL incluye candidatos de callesCiudad (categoria calle)', () => {
      component.callesCiudad.set(CALLES_CIUDAD); // 3 calles
      component.dificultadExamen.set('DIFICIL');
      component.cfgN.set(10);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const calleRetos = (component as any).retos.filter(
        (r: any) => r.poi.categoria === 'calle',
      );
      expect(calleRetos.length).toBeGreaterThan(0);
    });

    it('empezarExamen MEDIO incluye calles con longitudM ≥ 150 m en candidatos', () => {
      component.callesCiudad.set(CALLES_CIUDAD);
      component.dificultadExamen.set('MEDIO');
      component.cfgN.set(10);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const calleRetos = (component as any).retos.filter(
        (r: any) => r.poi.categoria === 'calle',
      );
      // MEDIO devuelve longitudM ≥ 150 → Avenida del Puerto (600) + Calle Colón (200)
      expect(calleRetos.length).toBeGreaterThan(0);
      const nombres = calleRetos.map((r: any) => r.poi.nombre);
      expect(nombres).not.toContain('Calle Corta'); // longitudM=80 → excluida
    });

    it('empezarExamen con cfgSoloZonas excluye candidatos de callesCiudad', () => {
      component.callesCiudad.set(CALLES_CIUDAD);
      component.dificultadExamen.set('DIFICIL');
      component.cfgSoloZonas.set(true);
      component.cfgN.set(10);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const calleRetos = (component as any).retos.filter(
        (r: any) => r.poi.categoria === 'calle',
      );
      expect(calleRetos.length).toBe(0);
    });
  });

  describe('listasEstudio dedup (T2)', () => {
    it('excluye del grupo calle los POIs cuyo nombre coincide con una callesCiudad', () => {
      // POIS[5] = 'Calle Colón' (categoria:'calle'); CALLES_CIUDAD[1] = 'Calle Colón'
      component.callesCiudad.set(CALLES_CIUDAD);
      const grupos = component.listasEstudio();
      const calleGrupo = grupos.find((g) => g.cat === 'calle');
      // 'Calle Colón' del POI se elimina por dedup; el único POI calle queda vacío
      expect(calleGrupo).toBeUndefined();
    });

    it('sin callesCiudad, el grupo calle muestra el POI normalmente', () => {
      component.callesCiudad.set([]);
      const grupos = component.listasEstudio();
      const calleGrupo = grupos.find((g) => g.cat === 'calle');
      expect(calleGrupo).toBeDefined();
      expect(calleGrupo!.items.some((p) => p.nombre === 'Calle Colón')).toBe(
        true,
      );
    });
  });

  // ── cooperasUnicas ────────────────────────────────────────────────────────

  it('cooperasUnicas derivado de zonas()', () => {
    // ZONAS = [{ coopera: 'Oeste', ... }]
    expect(component.cooperasUnicas()).toEqual(['Oeste']);
  });

  it('cooperasUnicas devuelve [] cuando ninguna zona tiene coopera', () => {
    component.zonas.set([{ ...ZONAS[0], coopera: undefined }]);
    expect(component.cooperasUnicas()).toEqual([]);
  });

  // ── listaModificadasEstudio ───────────────────────────────────────────────

  describe('listaModificadasEstudio', () => {
    beforeEach(() => {
      component.callesModificadas.set(CALLES_MODIFICADAS);
    });

    it('lista todas las calles modificadas ordenadas por nombreNuevo', () => {
      const lista = component.listaModificadasEstudio();
      expect(lista.length).toBe(4);
      // Alfabéticamente: Av. de la Constitución < Av. de los Derechos Humanos < Calle de la Democracia < Calle de la Paz
      expect(lista[0].nombreNuevo).toBe('Av. de la Constitución');
      expect(lista[1].nombreNuevo).toBe('Av. de los Derechos Humanos');
    });

    it('filtra por nombreNuevo (case-insensitive)', () => {
      component.buscar.set('democracia');
      const lista = component.listaModificadasEstudio();
      expect(lista.length).toBe(1);
      expect(lista[0].nombreNuevo).toBe('Calle de la Democracia');
    });

    it('filtra por nombreAntiguo (case-insensitive)', () => {
      component.buscar.set('generalísimo');
      const lista = component.listaModificadasEstudio();
      expect(lista.length).toBe(1);
      expect(lista[0].nombreAntiguo).toBe('Av. del Generalísimo');
    });

    it('búsqueda sin resultados devuelve lista vacía', () => {
      component.buscar.set('xyznotexist');
      expect(component.listaModificadasEstudio().length).toBe(0);
    });

    it('sin filtro devuelve todas sin límite', () => {
      component.buscar.set('');
      expect(component.listaModificadasEstudio().length).toBe(4);
    });
  });

  // ── filasZona (caseTypeId / cTypeArea) ───────────────────────────────────

  describe('filasZona (Pieza 4 — CaseTypeID / CTypeArea)', () => {
    it('incluye CaseTypeID y CTypeArea cuando están presentes', () => {
      const zonaConExtras: Zona = {
        ...ZONAS[0],
        caseTypeId: 'CT-001',
        cTypeArea: 'Area Norte',
      };
      const campos = (component as any).filasZona(zonaConExtras) as {
        k: string;
        v: string;
      }[];
      expect(campos.some((c) => c.k === 'CaseTypeID' && c.v === 'CT-001')).toBe(
        true,
      );
      expect(
        campos.some((c) => c.k === 'CTypeArea' && c.v === 'Area Norte'),
      ).toBe(true);
    });

    it('omite CaseTypeID y CTypeArea cuando son null', () => {
      const zonaSinExtras: Zona = {
        ...ZONAS[0],
        caseTypeId: null,
        cTypeArea: null,
      };
      const campos = (component as any).filasZona(zonaSinExtras) as {
        k: string;
        v: string;
      }[];
      expect(campos.some((c) => c.k === 'CaseTypeID')).toBe(false);
      expect(campos.some((c) => c.k === 'CTypeArea')).toBe(false);
    });

    it('zona null → fila "Fuera de la zonificación"', () => {
      const campos = (component as any).filasZona(null) as {
        k: string;
        v: string;
      }[];
      expect(campos[0].k).toBe('Zona de parque');
      expect(campos[0].v).toContain('Fuera');
    });
  });

  // ── calleRapida (Pieza 1) ─────────────────────────────────────────────────

  describe('calleRapida', () => {
    beforeEach(() => {
      // CALLES_CIUDAD lat/lng caen dentro del polígono SQUARE:
      // lat [39.45, 39.5] · lng [-0.4, -0.35] → zonaEn = ZONAS[0] (parque+coopera ✓)
      component.callesCiudad.set(CALLES_CIUDAD);
      component.dificultadExamen.set('DIFICIL');
      component.cfgN.set(10);
      component.cfgSoloZonas.set(false);
    });

    it('candidato calleRapida requiere zona con parque Y coopera', () => {
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const crRetos = (component as any).retos.filter(
        (r: any) => r.tipo === 'calleRapida',
      );
      expect(crRetos.length).toBeGreaterThan(0);
      for (const r of crRetos) {
        expect(r.crParqueCorrecto).toBeTruthy();
        expect(r.crCooperaCorrecto).toBeTruthy();
        expect(r.zona).not.toBeNull();
      }
    });

    it('comprobarCalleRapida con ambas correctas → acierto', () => {
      component.empezarExamen();
      // Inyectar un reto calleRapida conocido en la posición actual
      const crReto: any = {
        poi: { ...POIS[0], categoria: 'calle' as const },
        zona: ZONAS[0],
        tipo: 'calleRapida',
        crParqueCorrecto: 'Campanar',
        crCooperaCorrecto: 'Oeste',
      };
      const idx = component.retoIdx();
      (component as any).retos[idx] = crReto;
      (component as any).espera = true;
      component.retoActual.set(crReto);
      component.crSelParque.set('Campanar');
      component.crSelCoopera.set('Oeste');
      component.comprobarCalleRapida();
      expect(component.feedback()?.ok).toBe(true);
      expect(component.aciertos()).toBe(1);
    });

    it('comprobarCalleRapida con coopera incorrecta → fallo (acierto requiere ambos)', () => {
      component.empezarExamen();
      const crReto: any = {
        poi: { ...POIS[0], categoria: 'calle' as const },
        zona: ZONAS[0],
        tipo: 'calleRapida',
        crParqueCorrecto: 'Campanar',
        crCooperaCorrecto: 'Oeste',
      };
      const idx = component.retoIdx();
      (component as any).retos[idx] = crReto;
      (component as any).espera = true;
      component.retoActual.set(crReto);
      component.crSelParque.set('Campanar'); // parque correcto
      component.crSelCoopera.set('Este'); // coopera INCORRECTA
      component.comprobarCalleRapida();
      expect(component.feedback()?.ok).toBe(false);
      expect(component.aciertos()).toBe(0);
    });

    it('cfgSoloZonas excluye calleRapida del examen', () => {
      component.cfgSoloZonas.set(true);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const tipos = (component as any).retos.map((r: any) => r.tipo);
      expect(tipos).not.toContain('calleRapida');
    });
  });

  // ── modificada (Pieza 2) ──────────────────────────────────────────────────

  describe('modificada', () => {
    beforeEach(() => {
      component.callesModificadas.set(CALLES_MODIFICADAS);
      component.cfgN.set(10);
      component.cfgSoloZonas.set(false);
    });

    it('genera retos de tipo modificada cuando hay callesModificadas', () => {
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const mods = (component as any).retos.filter(
        (r: any) => r.tipo === 'modificada',
      );
      expect(mods.length).toBeGreaterThan(0);
      for (const r of mods) {
        expect(r.modDado).toBeTruthy();
        expect(r.modCorrecto).toBeTruthy();
        expect(['antes', 'ahora']).toContain(r.modDireccion);
      }
    });

    it('dirección "antes": dado=nombreNuevo, correcto=nombreAntiguo → respuesta correcta', () => {
      component.empezarExamen();
      const modReto: any = {
        poi: {
          id: 0,
          nombre: 'Av. de la Constitución',
          tipo: 'OTRO' as const,
          categoria: 'calle' as const,
          lat: 0,
          lng: 0,
          zonaId: null,
        },
        zona: null,
        tipo: 'modificada',
        modDado: 'Av. de la Constitución',
        modCorrecto: 'Calle General Mola',
        modDireccion: 'antes' as const,
      };
      const idx = component.retoIdx();
      (component as any).retos[idx] = modReto;
      (component as any).espera = true;
      component.retoActual.set(modReto);
      component.responderOpcion('Calle General Mola');
      expect(component.feedback()?.ok).toBe(true);
      expect(component.aciertos()).toBe(1);
    });

    it('dirección "ahora": dado=nombreAntiguo, correcto=nombreNuevo → respuesta correcta', () => {
      component.empezarExamen();
      const modReto: any = {
        poi: {
          id: 0,
          nombre: 'Calle del Caudillo',
          tipo: 'OTRO' as const,
          categoria: 'calle' as const,
          lat: 0,
          lng: 0,
          zonaId: null,
        },
        zona: null,
        tipo: 'modificada',
        modDado: 'Calle del Caudillo',
        modCorrecto: 'Calle de la Democracia',
        modDireccion: 'ahora' as const,
      };
      const idx = component.retoIdx();
      (component as any).retos[idx] = modReto;
      (component as any).espera = true;
      component.retoActual.set(modReto);
      component.responderOpcion('Calle de la Democracia');
      expect(component.feedback()?.ok).toBe(true);
      expect(component.aciertos()).toBe(1);
    });

    it('respuesta incorrecta → fallo', () => {
      component.empezarExamen();
      const modReto: any = {
        poi: {
          id: 0,
          nombre: 'Av. de la Constitución',
          tipo: 'OTRO' as const,
          categoria: 'calle' as const,
          lat: 0,
          lng: 0,
          zonaId: null,
        },
        zona: null,
        tipo: 'modificada',
        modDado: 'Av. de la Constitución',
        modCorrecto: 'Calle General Mola',
        modDireccion: 'antes' as const,
      };
      const idx = component.retoIdx();
      (component as any).retos[idx] = modReto;
      (component as any).espera = true;
      component.retoActual.set(modReto);
      component.responderOpcion('Respuesta Incorrecta XYZ');
      expect(component.feedback()?.ok).toBe(false);
      expect(component.aciertos()).toBe(0);
    });

    it('excluida del examen cuando no hay callesModificadas', () => {
      component.callesModificadas.set([]);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const tipos = (component as any).retos.map((r: any) => r.tipo);
      expect(tipos).not.toContain('modificada');
    });

    it('cfgSoloZonas excluye modificada del examen', () => {
      component.cfgSoloZonas.set(true);
      component.empezarExamen();
      expect(component.examOn()).toBe(true);
      const tipos = (component as any).retos.map((r: any) => r.tipo);
      expect(tipos).not.toContain('modificada');
    });
  });
});
