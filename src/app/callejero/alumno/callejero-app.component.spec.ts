import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import {
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
    component.cfgN.set(6);
    component.empezarExamen();
    expect(component.examOn()).toBe(true);
    expect(component.totalRetos()).toBe(6);
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
    component.onIniciarExamenRecorridos();
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
    component.onIniciarExamenRecorridos();
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
});
