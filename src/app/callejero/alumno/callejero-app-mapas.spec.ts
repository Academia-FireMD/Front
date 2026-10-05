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

/**
 * Regresión de la recuperación REAL de TFMapas (sin mocks): carga
 * public/callejero-embed/mapas-config.js en un contexto aislado y ejercita
 * `crearRecuperable` con una capa falsa que imita a `L.TileLayer`.
 *
 * Cubre el fallo de la regresión CARTO→PNOA del examen mudo de Alicante:
 *  - los `tileerror` tardíos de teselas retiradas no deben contarse como fallos
 *    del respaldo;
 *  - un `tileload` tardío de una tesela retirada no debe reiniciar esos fallos;
 *  - el cambio de proveedor debe redibujar con `_setView` (zoom redondeado), no
 *    con `redraw` (que captura el zoom fraccional de un `flyTo` y genera URLs
 *    inválidas).
 */
interface CapaRecuperable {
  _url: string;
  options: Record<string, unknown>;
  _tiles: Record<string, { el: object }>;
  _map: {
    getZoom(): number;
    getCenter(): object;
    getContainer(): null;
    attributionControl?: unknown;
  };
  _handlers: Array<[string, (event?: unknown) => void]>;
  on(evento: string, fn: (event?: unknown) => void): CapaRecuperable;
  off(evento: string, fn: (event?: unknown) => void): CapaRecuperable;
  setUrl(url: string, noRedraw?: boolean): CapaRecuperable;
  redraw(): CapaRecuperable;
  _removeAllTiles(): void;
  _setView(center: object, zoom: number): void;
}

type FnRecuperable = (
  L: unknown,
  capa: CapaRecuperable,
  opciones: {
    respaldo?: { url: string; opts: Record<string, unknown> } | null;
    maxFallos?: number;
  },
) => { fase(): string; reintentar(): void };

function cargarTfMapasReal(): { crearRecuperable: FnRecuperable } {
  // La utilidad es UMD y en Node expone `module.exports`; se carga el fichero
  // REAL (no una copia) para probar la recuperación sin mocks.
  return jest.requireActual<{ crearRecuperable: FnRecuperable }>(
    '../../../../public/callejero-embed/mapas-config.js',
  );
}

function capaRecuperable(zoom = 12): CapaRecuperable {
  const capa: CapaRecuperable = {
    _url: 'PRIMARIO',
    options: { maxZoom: 20, subdomains: 'abc', attribution: 'P' },
    _tiles: {},
    _map: {
      getZoom: () => zoom,
      getCenter: () => ({ lat: 0, lng: 0 }),
      getContainer: () => null,
    },
    _handlers: [],
    on(evento, fn) {
      capa._handlers.push([evento, fn]);
      return capa;
    },
    off(evento, fn) {
      capa._handlers = capa._handlers.filter(
        ([e, f]) => e !== evento || f !== fn,
      );
      return capa;
    },
    setUrl(url) {
      capa._url = url;
      return capa;
    },
    redraw() {
      return capa;
    },
    _removeAllTiles() {
      // Como L.GridLayer: al cambiar de proveedor se retiran todas las teselas.
      capa._tiles = {};
    },
    _setView() {
      /* la capa real redondea el zoom aquí; el espía registra la llamada */
    },
  };
  return capa;
}

/** Añade una tesela "activa" a la capa y devuelve su elemento `img`. */
function teselaActiva(capa: CapaRecuperable, clave: string): object {
  const el = {};
  capa._tiles[clave] = { el };
  return el;
}

function emitirTesela(
  capa: CapaRecuperable,
  evento: 'tileerror' | 'tileload',
  tile?: object,
  coords?: object,
): void {
  for (const [e, f] of [...capa._handlers]) {
    if (e === evento) f({ tile, coords });
  }
}

describe('TFMapas — recuperación ante teselas retiradas y zoom fraccional', () => {
  it('los errores tardíos de teselas primarias retiradas no cuentan como fallos del respaldo', () => {
    const { crearRecuperable } = cargarTfMapasReal();
    const capa = capaRecuperable();
    const ctrl = crearRecuperable({}, capa, {
      respaldo: { url: 'RESPALDO', opts: { maxZoom: 19 } },
    });

    // Tres errores de teselas ACTIVAS del primario disparan la transición.
    const e1 = teselaActiva(capa, '1:1:12');
    const e2 = teselaActiva(capa, '2:1:12');
    const e3 = teselaActiva(capa, '3:1:12');
    emitirTesela(capa, 'tileerror', e1);
    emitirTesela(capa, 'tileerror', e2);
    emitirTesela(capa, 'tileerror', e3);
    expect(ctrl.fase()).toBe('respaldo');
    // `_removeAllTiles` vació las teselas primarias (retiradas).
    expect(Object.keys(capa._tiles)).toHaveLength(0);

    // Varios errores tardíos de esas teselas retiradas NO deben agotar el
    // respaldo: antes de la corrección se contaban como 3 fallos → 'fallo'.
    for (let i = 0; i < 6; i += 1) emitirTesela(capa, 'tileerror', e1);
    emitirTesela(capa, 'tileerror', e2);
    emitirTesela(capa, 'tileerror', e3);
    expect(ctrl.fase()).toBe('respaldo');
  });

  it('un tileload tardío de una tesela retirada no reinicia los fallos del respaldo', () => {
    const { crearRecuperable } = cargarTfMapasReal();
    const capa = capaRecuperable();
    const ctrl = crearRecuperable({}, capa, {
      respaldo: { url: 'RESPALDO', opts: { maxZoom: 19 } },
    });

    const primarias = ['1:1:12', '2:1:12', '3:1:12'].map((k) => {
      const el = {};
      capa._tiles[k] = { el };
      return el;
    });
    primarias.forEach((el) => emitirTesela(capa, 'tileerror', el));
    expect(ctrl.fase()).toBe('respaldo');

    // Dos fallos REALES del respaldo (teselas activas de la nueva capa).
    const r1 = teselaActiva(capa, '1:1:12');
    const r2 = teselaActiva(capa, '2:1:12');
    emitirTesela(capa, 'tileerror', r1);
    emitirTesela(capa, 'tileerror', r2);

    // Un load tardío de una tesela primaria retirada no debe poner a cero el
    // contador; si lo hiciera, el tercer fallo real quedaría en 1 y no habría 'fallo'.
    emitirTesela(capa, 'tileload', primarias[0]);

    const r3 = teselaActiva(capa, '3:1:12');
    emitirTesela(capa, 'tileerror', r3);
    expect(ctrl.fase()).toBe('fallo');
  });

  it('al cambiar de proveedor redibuja con _setView (zoom redondeado) y no con redraw', () => {
    const { crearRecuperable } = cargarTfMapasReal();
    const capa = capaRecuperable(8.99999998);
    const redrawEspia = jest.spyOn(capa, 'redraw');
    const setViewEspia = jest.spyOn(capa, '_setView');
    const ctrl = crearRecuperable({}, capa, {
      respaldo: { url: 'RESPALDO', opts: { maxZoom: 19 } },
    });

    ['1:1:9', '2:1:9', '3:1:9'].forEach((k) => {
      emitirTesela(capa, 'tileerror', teselaActiva(capa, k));
    });

    expect(ctrl.fase()).toBe('respaldo');
    expect(setViewEspia).toHaveBeenCalled();
    // `redraw()` capturaría el zoom fraccional 8.99999998 y generaría URLs con
    // tilematrix inválido (el fallo real de PNOA); no debe usarse.
    expect(redrawEspia).not.toHaveBeenCalled();
    expect(capa._url).toBe('RESPALDO');
  });

  it('los eventos sin objeto tile conservan la semántica previa', () => {
    const { crearRecuperable } = cargarTfMapasReal();
    const capa = capaRecuperable();
    const ctrl = crearRecuperable({}, capa, {
      respaldo: { url: 'RESPALDO', opts: { maxZoom: 19 } },
    });

    emitirTesela(capa, 'tileerror');
    emitirTesela(capa, 'tileerror');
    expect(ctrl.fase()).toBe('primario');
    emitirTesela(capa, 'tileerror');
    expect(ctrl.fase()).toBe('respaldo');
    // Y sin objeto tile, los fallos del respaldo también cuentan.
    emitirTesela(capa, 'tileerror');
    emitirTesela(capa, 'tileerror');
    emitirTesela(capa, 'tileerror');
    expect(ctrl.fase()).toBe('fallo');
  });
});

export {};
