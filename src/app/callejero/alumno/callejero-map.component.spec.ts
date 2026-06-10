import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import * as L from 'leaflet';
import {
  CallesZonaResponse,
  Ciudad,
  ResumenProgreso,
  Zona,
} from '../models/callejero.model';
import { CallejeroService } from '../services/callejero.service';
import { loadValenciaFixture } from '../testing/valencia-fixture';
import { CallejeroMapComponent } from './callejero-map.component';

/**
 * Tests de componente del mapa callejero. Mockeamos `CallejeroService` con el
 * fixture real de Valencia (seed del spike) y ejercitamos la lógica de los 5
 * modos sin depender del renderizado real de tiles de Leaflet. El mapa se
 * inicializa contra un div de jsdom (sin tiles), suficiente para que las capas
 * GeoJSON y la indexación de calles funcionen.
 */

function buildServiceMock(fx: ReturnType<typeof loadValenciaFixture>) {
  const ciudades: Ciudad[] = [fx.ciudad];
  const zonas: Zona[] = fx.zonas;
  const zona = fx.zonaConMasCalles;
  const callesResp: CallesZonaResponse = {
    calles: fx.callesPorZona.get(zona.id) ?? [],
    pois: fx.pois,
  };
  const progreso: ResumenProgreso = {
    zonas: zonas.map((z) => ({
      zonaId: z.id,
      nombre: z.nombre,
      totalCalles: fx.callesPorZona.get(z.id)?.length ?? 0,
      dominadas: 0,
    })),
  };

  return {
    listarCiudades: jest.fn().mockReturnValue(of(ciudades)),
    listarZonas: jest.fn().mockReturnValue(of(zonas)),
    listarCalles: jest.fn().mockReturnValue(of(callesResp)),
    registrarProgreso: jest.fn().mockReturnValue(of(progreso)),
    resumenProgreso: jest.fn().mockReturnValue(of(progreso)),
    _zona: zona,
    _callesResp: callesResp,
    _progreso: progreso,
  };
}

describe('CallejeroMapComponent', () => {
  let fixture: ComponentFixture<CallejeroMapComponent>;
  let component: CallejeroMapComponent;
  let mock: ReturnType<typeof buildServiceMock>;
  let fx: ReturnType<typeof loadValenciaFixture>;

  beforeEach(async () => {
    fx = loadValenciaFixture();
    mock = buildServiceMock(fx);

    await TestBed.configureTestingModule({
      imports: [CallejeroMapComponent],
      providers: [
        { provide: CallejeroService, useValue: mock },
        { provide: ToastrService, useValue: { info: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CallejeroMapComponent);
    component = fixture.componentInstance;
    // ngAfterViewInit inicializa el mapa + carga ciudades.
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('carga ciudades y autoselecciona la primera (Valencia)', () => {
    expect(mock.listarCiudades).toHaveBeenCalled();
    expect(component.ciudadSel()?.slug).toBe('valencia');
    expect(component.zonas().length).toBe(fx.zonas.length);
  });

  it('al seleccionar una zona carga sus calles y POIs', () => {
    component.seleccionarZona(mock._zona);
    fixture.detectChanges();

    expect(mock.listarCalles).toHaveBeenCalledWith(mock._zona.id);
    expect(component.calles().length).toBe(mock._callesResp.calles.length);
    expect(component.pois().length).toBe(fx.pois.length);
    expect(component.zonaSel()?.id).toBe(mock._zona.id);
  });

  it('Modo Encuentra-calle: click correcto registra acierto', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('ENCUENTRA_CALLE');
    fixture.detectChanges();

    const reto = component.retoCalle();
    expect(reto).not.toBeNull();

    // Simular click sobre la calle objetivo (acceso al handler privado).
    (component as any).resolverEncuentraCalle(reto);

    expect(mock.registrarProgreso).toHaveBeenCalledWith(reto!.id, true);
    expect(component.feedback()?.tipo).toBe('acierto');
  });

  it('Modo Encuentra-calle: click en otra calle registra fallo', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('ENCUENTRA_CALLE');
    fixture.detectChanges();

    const reto = component.retoCalle()!;
    const otra = component
      .calles()
      .find((c) => c.codigoExterno !== reto.codigoExterno)!;

    (component as any).resolverEncuentraCalle(otra);

    expect(mock.registrarProgreso).toHaveBeenCalledWith(reto.id, false);
    expect(component.feedback()?.tipo).toBe('fallo');
  });

  it('Modo ¿Qué calle es?: genera 4 opciones (1 correcta + 3 distractores reales)', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('QUE_CALLE_ES');
    fixture.detectChanges();

    const reto = component.retoCalle();
    const opciones = component.opcionesQuiz();
    expect(reto).not.toBeNull();
    expect(opciones.length).toBe(4);
    // La correcta está entre las opciones.
    expect(opciones.some((o) => o.calleId === reto!.id)).toBe(true);
    // Todos los distractores son calles reales de la zona.
    const idsZona = new Set(component.calles().map((c) => c.id));
    expect(opciones.every((o) => idsZona.has(o.calleId))).toBe(true);
  });

  it('Modo ¿Qué calle es?: responder la opción correcta registra acierto', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('QUE_CALLE_ES');
    fixture.detectChanges();

    const reto = component.retoCalle()!;
    const correcta = component
      .opcionesQuiz()
      .find((o) => o.calleId === reto.id)!;

    component.responderQuiz(correcta);

    expect(mock.registrarProgreso).toHaveBeenCalledWith(reto.id, true);
    expect(component.feedback()?.tipo).toBe('acierto');
  });

  it('Modo Mapa mudo: el toggle alterna el estado de revelado', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('MAPA_MUDO');
    fixture.detectChanges();

    expect(component.mudoRevelado()).toBe(false);
    component.toggleRevelarMudo();
    expect(component.mudoRevelado()).toBe(true);
    component.toggleRevelarMudo();
    expect(component.mudoRevelado()).toBe(false);
  });

  it('Modo Ubicar POI: click cercano acierta, lejano falla', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('UBICAR_POI');
    fixture.detectChanges();

    const poi = component.retoPoi();
    expect(poi).not.toBeNull();

    // Click exactamente sobre el POI → acierto.
    (component as any).resolverUbicarPoi(
      L.latLng(poi!.lat, poi!.lng),
      poi,
    );
    expect(component.feedback()?.tipo).toBe('acierto');

    // Click lejano (~1km) → fallo.
    (component as any).resolverUbicarPoi(
      L.latLng(poi!.lat + 0.01, poi!.lng + 0.01),
      poi,
    );
    expect(component.feedback()?.tipo).toBe('fallo');
  });

  it('tras registrar progreso refresca el panel de progreso', () => {
    component.seleccionarZona(mock._zona);
    component.cambiarModo('ENCUENTRA_CALLE');
    fixture.detectChanges();

    const reto = component.retoCalle()!;
    (component as any).resolverEncuentraCalle(reto);

    // El mock de registrarProgreso devuelve un ResumenProgreso → se aplica.
    expect(component.progreso().length).toBe(fx.zonas.length);
  });
});
