import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import {
  Ciudad,
  GenerarExamenResponse,
  HistorialExamenResponse,
  ResultadoExamen,
  Zona,
} from '../models/callejero.model';
import { CallejeroService } from '../services/callejero.service';
import { CallejeroExamenComponent } from './callejero-examen.component';

/**
 * Tests del componente del modo Examen. El bucle interactivo (cronómetro,
 * clicks en el mapa Leaflet, auto-avance) se valida por QA visual / E2E; aquí
 * cubrimos la superficie lógica no-temporal: scope, generación, histórico,
 * resultado y formato.
 */

const CIUDAD: Ciudad = {
  id: 1,
  slug: 'valencia',
  nombre: 'Valencia',
  bbox: [-0.4, 39.4, -0.3, 39.5],
};
const PARQUES: Zona[] = [
  {
    id: 77,
    ciudadId: 1,
    codigo: 'P1',
    nombre: 'Oeste',
    tipo: 'PARQUE',
    geometria: { type: 'Polygon', coordinates: [] },
  },
  {
    id: 78,
    ciudadId: 1,
    codigo: 'P2',
    nombre: 'Norte',
    tipo: 'PARQUE',
    geometria: { type: 'Polygon', coordinates: [] },
  },
];

function buildServiceMock() {
  const generarResp: GenerarExamenResponse = {
    token: 'tok.123',
    ciudadId: 1,
    zonaIds: [],
    totalRetos: 2,
    duracionRetoMs: 15000,
    calles: [],
    retos: [
      { orden: 0, tipo: 'LOCALIZAR', calleId: 100, nombre: 'Calle A' },
      {
        orden: 1,
        tipo: 'IDENTIFICAR',
        calleId: 101,
        nombre: 'Calle B',
        opciones: [
          { calleId: 101, nombre: 'Calle B' },
          { calleId: 102, nombre: 'Calle C' },
        ],
      },
    ],
  };
  return {
    listarCiudades: jest.fn().mockReturnValue(of([CIUDAD])),
    listarZonas: jest.fn().mockReturnValue(of(PARQUES)),
    generarExamen: jest.fn().mockReturnValue(of(generarResp)),
    registrarExamen: jest.fn(),
    historialExamen: jest.fn(),
    _generarResp: generarResp,
  };
}

describe('CallejeroExamenComponent', () => {
  let fixture: ComponentFixture<CallejeroExamenComponent>;
  let component: CallejeroExamenComponent;
  let mock: ReturnType<typeof buildServiceMock>;

  beforeEach(async () => {
    mock = buildServiceMock();
    await TestBed.configureTestingModule({
      imports: [CallejeroExamenComponent],
      providers: [
        provideRouter([]),
        { provide: CallejeroService, useValue: mock },
        {
          provide: ToastrService,
          useValue: { info: jest.fn(), error: jest.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CallejeroExamenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngAfterViewInit → cargarInicio
  });

  afterEach(() => fixture.destroy());

  it('carga ciudades y autoselecciona la primera, cargando sus parques', () => {
    expect(mock.listarCiudades).toHaveBeenCalled();
    expect(component.ciudadSel()?.slug).toBe('valencia');
    expect(mock.listarZonas).toHaveBeenCalledWith(1);
    expect(component.parques().length).toBe(2);
    expect(component.fase()).toBe('inicio');
  });

  it('scopeLabel refleja la selección de parques', () => {
    expect(component.scopeLabel()).toBe('Ciudad completa');
    component.parquesSel.set([PARQUES[0]]);
    expect(component.scopeLabel()).toBe('Oeste');
    component.parquesSel.set(PARQUES);
    expect(component.scopeLabel()).toBe('2 parques');
  });

  it('empezar() genera el examen con el scope y pasa a fase jugando', () => {
    component.parquesSel.set([PARQUES[0], PARQUES[1]]);
    component.empezar();

    expect(mock.generarExamen).toHaveBeenCalledWith(1, [77, 78]);
    expect(component.fase()).toBe('jugando');
    expect(component.totalRetos()).toBe(2);
    expect(component.retoIdx()).toBe(0);
    expect(component.generando()).toBe(false);
  });

  it('ciudad completa → generarExamen con zonaIds vacío', () => {
    component.empezar();
    expect(mock.generarExamen).toHaveBeenCalledWith(1, []);
  });

  it('detalleFallos devuelve solo los retos no acertados', () => {
    const resultado: ResultadoExamen = {
      intentoId: 1,
      creadoEn: '2026-06-14T10:00:00Z',
      ciudadId: 1,
      zonaIds: [],
      totalRetos: 3,
      aciertos: 1,
      fallos: 2,
      nota: 3.33,
      aprobado: false,
      tiempoTotalMs: 30000,
      detalle: [
        {
          orden: 0,
          calleId: 100,
          calleNombre: 'A',
          tipoReto: 'LOCALIZAR',
          acertado: true,
          tiempoMs: 5000,
          agotoTiempo: false,
        },
        {
          orden: 1,
          calleId: 101,
          calleNombre: 'B',
          tipoReto: 'IDENTIFICAR',
          acertado: false,
          tiempoMs: 9000,
          agotoTiempo: false,
        },
        {
          orden: 2,
          calleId: 102,
          calleNombre: 'C',
          tipoReto: 'LOCALIZAR',
          acertado: false,
          tiempoMs: 15000,
          agotoTiempo: true,
        },
      ],
    };
    component.resultado.set(resultado);
    const fallos = component.detalleFallos;
    expect(fallos).toHaveLength(2);
    expect(fallos.map((d) => d.calleNombre)).toEqual(['B', 'C']);
  });

  it('verHistorial carga los intentos del alumno', () => {
    const historialResp: HistorialExamenResponse = {
      items: [
        {
          id: 2,
          ciudadId: 1,
          zonaIds: [],
          totalRetos: 20,
          aciertos: 15,
          fallos: 5,
          nota: 7.5,
          aprobado: true,
          tiempoTotalMs: 120000,
          creadoEn: '2026-06-14T10:00:00Z',
        },
        {
          id: 1,
          ciudadId: 1,
          zonaIds: [77],
          totalRetos: 20,
          aciertos: 8,
          fallos: 12,
          nota: 4,
          aprobado: false,
          tiempoTotalMs: 90000,
          creadoEn: '2026-06-13T10:00:00Z',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    };
    mock.historialExamen.mockReturnValue(of(historialResp));

    component.verHistorial();

    expect(component.fase()).toBe('historial');
    expect(mock.historialExamen).toHaveBeenCalledWith(1);
    expect(component.historial()).toHaveLength(2);
    expect(component.loadingHistorial()).toBe(false);
  });

  it('volverInicio resetea a la pantalla de inicio', () => {
    component.fase.set('resultado');
    component.resultado.set({} as ResultadoExamen);
    component.volverInicio();
    expect(component.fase()).toBe('inicio');
    expect(component.resultado()).toBeNull();
  });

  it('formatTiempo formatea minutos y segundos', () => {
    expect(component.formatTiempo(5000)).toBe('5s');
    expect(component.formatTiempo(65000)).toBe('1m 5s');
    expect(component.formatTiempo(125000)).toBe('2m 5s');
  });

  it('si generar falla, no rompe (sigue en inicio, generando=false)', () => {
    mock.generarExamen.mockReturnValue(throwError(() => new Error('400')));
    component.empezar();
    expect(component.fase()).toBe('inicio');
    expect(component.generando()).toBe(false);
  });
});
