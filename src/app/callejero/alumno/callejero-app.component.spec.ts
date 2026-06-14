import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { Ciudad, PoiCiudad, Zona } from '../models/callejero.model';
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

function mockService() {
  return {
    listarCiudades: jest.fn().mockReturnValue(of([CIUDAD])),
    listarZonas: jest.fn().mockReturnValue(of(ZONAS)),
    listarPoisCiudad: jest.fn().mockReturnValue(of(POIS)),
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

  it('verLeaderboard carga la clasificación', () => {
    component.verLeaderboard();
    expect(svc.leaderboardExamen).toHaveBeenCalledWith(1);
    expect(component.leaderboardVisible()).toBe(true);
  });
});
