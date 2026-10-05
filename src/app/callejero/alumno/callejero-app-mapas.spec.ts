/**
 * Verifica el consumo NATIVO (Angular) de la utilidad TFMapas: la base primaria
 * y su respaldo se derivan de los proveedores compartidos, y la recuperación se
 * registra con el contenedor del mapa. No usa TestBed: solo comprueba el
 * cableado de los métodos privados de composición de bases.
 */
import * as L from 'leaflet';
import { CallejeroAppComponent } from './callejero-app.component';

type Cualquiera = Record<string, unknown>;

interface ProveedoresFalsos {
  [nombre: string]: (extra?: unknown) => { url: string; opts: Cualquiera };
}

function instalarTFMapas(tieneClave: boolean): { crearRecuperable: jest.Mock } {
  const def = (url: string) => ({ url, opts: {} });
  const proveedores: ProveedoresFalsos = {
    googleCalles: () => def('GOOGLE_CALLES'),
    googleSatelite: () => def('GOOGLE_SAT'),
    cartoVoyager: () => (tieneClave ? def('CARTO_VOYAGER?key=K') : null) as never,
    cartoVoyagerSinEtiquetas: () =>
      (tieneClave ? def('CARTO_MUDO?key=K') : null) as never,
    cartoLightSinEtiquetas: () =>
      (tieneClave ? def('CARTO_LIGHT?key=K') : null) as never,
    esriClaro: () => def('ESRI_CLARO'),
    esriSatelite: () => def('ESRI_SAT'),
    ignBaseTodo: () => def('IGN_TODO'),
    pnoa: () => def('PNOA'),
    openTopoMap: () => def('OTM'),
    ignRelieve: () => def('IDEE_RELIEVE'),
    esriTopo: () => def('ESRI_TOPO'),
    esriCalles: () => def('ESRI_CALLES'),
    esriRelieveSombreado: () => def('ESRI_REL'),
  };
  const crearRecuperable = jest.fn(() => ({
    fase: () => 'primario',
    reintentar: jest.fn(),
    establecerActivo: jest.fn(),
    destruir: jest.fn(),
    avisoElemento: null,
    errorElemento: null,
  }));
  (window as unknown as { TFMapas: unknown }).TFMapas = {
    config: { cartoKey: tieneClave ? 'K' : '' },
    tieneCarto: () => tieneClave,
    claveCarto: () => (tieneClave ? 'K' : ''),
    proveedores: () => proveedores,
    crearRecuperable,
  };
  return { crearRecuperable };
}

function componenteFalso(): Cualquiera {
  const componente = Object.create(
    CallejeroAppComponent.prototype,
  ) as unknown as Cualquiera;
  componente['recuperaciones'] = [];
  componente['map'] = {
    getContainer: () => document.createElement('div'),
    hasLayer: () => true,
  };
  return componente;
}

function capaFalsa(): Cualquiera {
  return {
    _url: 'PRIMARIO',
    options: {},
    on: jest.fn(),
    off: jest.fn(),
    setUrl: jest.fn(),
    redraw: jest.fn(),
  };
}

describe('CallejeroAppComponent — bases nativas con TFMapas', () => {
  afterEach(() => {
    delete (window as unknown as { TFMapas?: unknown }).TFMapas;
  });

  it('sin clave: calles respalda en IGNBaseTodo y mudo no tiene respaldo', () => {
    const { crearRecuperable } = instalarTFMapas(false);
    const c = componenteFalso();

    (c['activarRecuperacion'] as (k: string, l: unknown) => void)(
      'calles',
      capaFalsa(),
    );
    (c['activarRecuperacion'] as (k: string, l: unknown) => void)(
      'mudo',
      capaFalsa(),
    );
    (c['activarRecuperacion'] as (k: string, l: unknown) => void)(
      'satelite',
      capaFalsa(),
    );

    const respaldos = crearRecuperable.mock.calls.map(
      (args) => (args[2] as { respaldo: { url: string } | null }).respaldo,
    );
    expect(respaldos[0]).toMatchObject({ url: 'IGN_TODO' });
    expect(respaldos[1]).toBeNull();
    expect(respaldos[2]).toMatchObject({ url: 'ESRI_SAT' });
    // Y nunca un proveedor CARTO anónimo.
    for (const respaldo of respaldos) {
      expect(respaldo?.url ?? '').not.toContain('cartocdn.com');
    }
  });

  it('con clave: mudo usa CARTO con clave y respalda en PNOA; calles respalda en CARTO', () => {
    const { crearRecuperable } = instalarTFMapas(true);
    const c = componenteFalso();

    (c['activarRecuperacion'] as (k: string, l: unknown) => void)(
      'calles',
      capaFalsa(),
    );
    (c['activarRecuperacion'] as (k: string, l: unknown) => void)(
      'mudo',
      capaFalsa(),
    );

    const respaldos = crearRecuperable.mock.calls.map(
      (args) => (args[2] as { respaldo: { url: string } | null }).respaldo,
    );
    expect(respaldos[0]).toMatchObject({ url: 'CARTO_VOYAGER?key=K' });
    expect(respaldos[1]).toMatchObject({ url: 'PNOA' });

    const primarioMudo = (c['tileLayer'] as (k: string) => { _url: string })(
      'mudo',
    );
    expect(primarioMudo._url).toBe('CARTO_MUDO?key=K');
  });

  it('limpiarRecuperaciones destruye y vacía los controladores', () => {
    const { crearRecuperable } = instalarTFMapas(true);
    const c = componenteFalso();
    (c['activarRecuperacion'] as (k: string, l: unknown) => void)(
      'calles',
      capaFalsa(),
    );
    expect((c['recuperaciones'] as unknown[]).length).toBe(1);

    (c['limpiarRecuperaciones'] as () => void)();

    const controlador = crearRecuperable.mock.results[0].value as {
      destruir: jest.Mock;
    };
    expect(controlador.destruir).toHaveBeenCalled();
    expect((c['recuperaciones'] as unknown[]).length).toBe(0);
  });

  it('L queda disponible para la utilidad (import de leaflet intacto)', () => {
    expect(typeof L.tileLayer).toBe('function');
  });
});

export {};
