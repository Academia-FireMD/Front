import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CursosAlumnoService } from './cursos-alumno.service';
import {
  HIDRAULICA_BRIDGE_TAG,
  HIDRAULICA_BRIDGE_VERSION,
  HidraulicaCallbacks,
  HidraulicaContexto,
  HidraulicaInteractivoService,
  HidraulicaSyncMensaje,
  claveCacheHidraulica,
  estadoHidraulicaFresco,
  normalizarEstadoHidraulica,
  usuarioIdDeSubject,
} from './hidraulica-interactivo.service';

const CONTEXTO: HidraulicaContexto = {
  leccionId: 77,
  bloqueId: 501,
  aplicacionCodigo: 'HIDRAULICA',
};

function estadoCon(
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...estadoHidraulicaFresco(),
    ...extra,
  };
}

function cacheKey(usuarioId: number, leccionId = CONTEXTO.leccionId): string {
  return claveCacheHidraulica({
    usuarioId,
    impersonando: false,
    leccionId,
  });
}

describe('normalizarEstadoHidraulica', () => {
  it('acepta el estado fresco exacto del contrato', () => {
    const estado = normalizarEstadoHidraulica(estadoHidraulicaFresco());
    expect(estado).toEqual(estadoHidraulicaFresco());
    expect(estado).not.toBe(estadoHidraulicaFresco());
  });

  it('conserva campos anidados reales de pref/est/Clase y limita alumno a 60', () => {
    const remoto = estadoCon({
      hist: {
        'CAT-15': {
          ok: 2,
          bad: 1,
          last: 123,
          lastOk: true,
          box: 2,
          due: 456,
          okStreak: 1,
          extra: 'se conserva',
        },
      },
      sims: [{ t: 1, n: 10, ok: 8, bad: 2, blank: 0, nota: 7.2, live: 'ABC' }],
      pref: {
        practice: { blocks: [10], n: 5, only: 'todos', modo: 'adaptativo' },
      },
      est: {
        hist: { q1: { ok: 1, bad: 0, lastOk: true } },
        cards: { q1: true },
        pref: { secs: [1, 2], tipos: ['unidad'], modo: 'test' },
        best: { score: 9, bad: 1, t: 99 },
      },
      daily: {
        goal: { p: 12, f: 18 },
        days: { '2026-10-28': { p: 2, f: 3, ok: 4, att: 5 } },
      },
      alumno: 'x'.repeat(100),
      live: { id: 'ABC123', q: ['CAT-15'], tpq: 90, pen: true, t: 1 },
    });
    const estado = normalizarEstadoHidraulica(remoto);
    expect(estado).not.toBeNull();
    expect(estado!['pref']).toEqual(remoto['pref']);
    expect(
      (estado!['hist'] as Record<string, { extra: string }>)['CAT-15'].extra,
    ).toBe('se conserva');
    expect((estado!['alumno'] as string).length).toBe(60);
    expect(estado!['live']).toEqual(remoto['live']);
  });

  it('rechaza raíces que no son v1 u objetos planos', () => {
    expect(normalizarEstadoHidraulica(null)).toBeNull();
    expect(normalizarEstadoHidraulica([])).toBeNull();
    expect(normalizarEstadoHidraulica({ v: 2 })).toBeNull();
    expect(normalizarEstadoHidraulica('x')).toBeNull();
  });

  it('no contamina el prototipo con __proto__', () => {
    const hostil = JSON.parse(
      '{"v":1,"hist":{},"sims":[],"pref":{},"est":{"hist":{},"cards":{},"pref":{}},"daily":{"goal":{"p":10,"f":15},"days":{}},"alumno":"","__proto__":{"polluted":true}}',
    );
    const estado = normalizarEstadoHidraulica(hostil);
    expect(estado).not.toBeNull();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(estado, '__proto__')).toBe(
      false,
    );
  });

  it('rechaza estados demasiado profundos y mayores de 1 MiB', () => {
    let profundo: Record<string, unknown> = { fin: true };
    for (let i = 0; i < 20; i++) profundo = { nivel: profundo };
    expect(
      normalizarEstadoHidraulica(estadoCon({ extra: profundo })),
    ).toBeNull();
    expect(
      normalizarEstadoHidraulica(
        estadoCon({ relleno: 'x'.repeat(1024 * 1024) }),
      ),
    ).toBeNull();
  });
});

describe('usuarioIdDeSubject', () => {
  it('acepta números y strings numéricos positivos', () => {
    expect(usuarioIdDeSubject(3)).toBe(3);
    expect(usuarioIdDeSubject('42')).toBe(42);
  });

  it('rechaza valores no seguros', () => {
    expect(usuarioIdDeSubject(null)).toBeNull();
    expect(usuarioIdDeSubject(0)).toBeNull();
    expect(usuarioIdDeSubject('-1')).toBeNull();
    expect(usuarioIdDeSubject('abc')).toBeNull();
    expect(usuarioIdDeSubject(1.5)).toBeNull();
  });
});

describe('HidraulicaInteractivoService (puente)', () => {
  let adapter: HidraulicaInteractivoService;
  let identidad: BehaviorSubject<{
    sub: unknown;
    isImpersonating: boolean;
  } | null>;
  let getProgreso: jest.Mock;
  let guardarProgreso: jest.Mock;
  let postMessage: jest.Mock;
  let callbacks: HidraulicaCallbacks;
  let estados: HidraulicaSyncMensaje[];
  let alturas: number[];
  let control: { destruir(): void; reintentar(): void } | null;
  let iframe: HTMLIFrameElement;
  let frameWindow: { postMessage: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    identidad = new BehaviorSubject<{
      sub: unknown;
      isImpersonating: boolean;
    } | null>({ sub: 1, isImpersonating: false });
    getProgreso = jest.fn(() => of({ estado: null, revision: 0 }));
    guardarProgreso = jest.fn(() => of({ estado: estadoCon(), revision: 1 }));
    postMessage = jest.fn();
    frameWindow = { postMessage };
    iframe = {
      contentWindow: frameWindow,
      scrollIntoView: jest.fn(),
    } as unknown as HTMLIFrameElement;

    TestBed.configureTestingModule({
      providers: [
        HidraulicaInteractivoService,
        {
          provide: AuthService,
          useValue: { currentIdentity$: identidad.asObservable() },
        },
        {
          provide: CursosAlumnoService,
          useValue: {
            getProgresoInteractivo: getProgreso,
            guardarProgresoInteractivo: guardarProgreso,
          },
        },
      ],
    });
    adapter = TestBed.inject(HidraulicaInteractivoService);
    estados = [];
    alturas = [];
    callbacks = {
      publicarEstado: (mensaje) => estados.push(mensaje),
      publicarAltura: (px) => alturas.push(px),
    };
    control = null;
  });

  afterEach(() => {
    control?.destruir();
    control = null;
    localStorage.clear();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function conectar(): void {
    control = adapter.connect(iframe, CONTEXTO, callbacks);
  }

  function emitirMensaje(
    data: unknown,
    opciones: {
      source?: unknown;
      origin?: string;
    } = {},
  ): void {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: opciones.origin ?? window.location.origin,
        source: (opciones.source ?? frameWindow) as MessageEventSource,
      }),
    );
  }

  function ready(): void {
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'ready',
    });
  }

  function mensajes(tipo: string): Record<string, unknown>[] {
    return postMessage.mock.calls
      .map(([mensaje]) => mensaje as Record<string, unknown>)
      .filter((mensaje) => mensaje['type'] === tipo);
  }

  function ultimoInit(): Record<string, unknown> {
    const inits = mensajes('init');
    return inits[inits.length - 1];
  }

  function snapshot(
    contexto: string | null,
    requestId: string,
    estado: unknown,
  ): void {
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'snapshot',
      contextId: contexto,
      requestId,
      estado,
    });
  }

  it('carga primero del servidor y publica init sin PUT ni token', () => {
    const remoto = estadoCon({ alumno: 'Alumno' });
    getProgreso.mockReturnValue(of({ estado: remoto, revision: 4 }));
    conectar();
    ready();

    expect(getProgreso).toHaveBeenCalledWith(CONTEXTO.leccionId);
    expect(guardarProgreso).not.toHaveBeenCalled();
    const init = ultimoInit();
    expect(init['estado']).toEqual(remoto);
    expect(init['revision']).toBe(4);
    expect(init['startAllowed']).toBe(true);
    expect(estados.at(-1)?.estado).toBe('saved');

    const serializado = JSON.stringify(postMessage.mock.calls);
    expect(serializado).not.toContain('Bearer');
    for (const [, target] of postMessage.mock.calls) {
      expect(target).toBe(window.location.origin);
      expect(target).not.toBe('*');
    }
  });

  it('servidor sin estado: init fresh, no PUT al abrir', () => {
    conectar();
    ready();

    expect(guardarProgreso).not.toHaveBeenCalled();
    const init = ultimoInit();
    expect(init['estado']).toBeNull();
    expect(init['startAllowed']).toBe(true);
    expect(estados.at(-1)?.estado).toBe('saved');
  });

  it('coalesce 500 ms y solo marca saved tras el ACK remoto', () => {
    const put = new Subject<{
      estado: Record<string, unknown>;
      revision: number;
    }>();
    guardarProgreso.mockReturnValue(put.asObservable());
    conectar();
    ready();
    const contexto = ultimoInit()['contextId'] as string;

    const primero = estadoCon({ alumno: 'uno' });
    const segundo = estadoCon({ alumno: 'dos' });
    snapshot(contexto, 's1', primero);
    expect(localStorage.getItem(cacheKey(1))).not.toBeNull();
    snapshot(contexto, 's2', segundo);
    expect(guardarProgreso).not.toHaveBeenCalled();

    jest.advanceTimersByTime(499);
    expect(guardarProgreso).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(guardarProgreso).toHaveBeenCalledTimes(1);
    expect(guardarProgreso.mock.calls[0][1]).toEqual(segundo);
    expect(mensajes('ack')).toHaveLength(0);
    expect(estados.at(-1)?.estado).toBe('saving');

    put.next({ estado: segundo, revision: 3 });
    put.complete();
    expect(mensajes('ack')).toHaveLength(1);
    expect(mensajes('ack')[0]['requestId']).toBe('s2');
    expect(estados.at(-1)?.estado).toBe('saved');
    const cache = JSON.parse(localStorage.getItem(cacheKey(1))!);
    expect(cache.pending).toBe(false);
    expect(cache.revision).toBe(3);
  });

  it('ACK intermedio no marca guardado ni limpia pending mientras queda un snapshot posterior', () => {
    const putA = new Subject<{
      estado: Record<string, unknown>;
      revision: number;
    }>();
    const putB = new Subject<{
      estado: Record<string, unknown>;
      revision: number;
    }>();
    guardarProgreso
      .mockReturnValueOnce(putA.asObservable())
      .mockReturnValueOnce(putB.asObservable());
    conectar();
    ready();
    const contexto = ultimoInit()['contextId'] as string;
    const estadoA = estadoCon({ alumno: 'A' });
    const estadoB = estadoCon({ alumno: 'B' });
    snapshot(contexto, 'sA', estadoA);
    jest.advanceTimersByTime(500);
    expect(guardarProgreso).toHaveBeenCalledTimes(1);
    expect(guardarProgreso.mock.calls[0][1]).toEqual(estadoA);

    snapshot(contexto, 'sB', estadoB);
    putA.next({ estado: estadoA, revision: 2 });
    putA.complete();

    expect(estados.at(-1)?.estado).not.toBe('saved');
    const cache = JSON.parse(localStorage.getItem(cacheKey(1))!);
    expect(cache.pending).toBe(true);
    expect(cache.estado.alumno).toBe('B');

    jest.advanceTimersByTime(0);
    expect(guardarProgreso).toHaveBeenCalledTimes(2);
    expect(guardarProgreso.mock.calls[1][1]).toEqual(estadoB);
    putB.next({ estado: estadoB, revision: 3 });
    putB.complete();
    expect(estados.at(-1)?.estado).toBe('saved');
    expect(JSON.parse(localStorage.getItem(cacheKey(1))!).pending).toBe(false);
  });

  it('error de GET con cache: usa cache y no sobrescribe con vacío', () => {
    const cacheEstado = estadoCon({ alumno: 'cache' });
    localStorage.setItem(
      cacheKey(1),
      JSON.stringify({
        estado: cacheEstado,
        revision: 2,
        pending: false,
        updatedAt: 1,
      }),
    );
    getProgreso.mockReturnValue(throwError(() => new Error('offline')));
    conectar();
    ready();

    expect(guardarProgreso).not.toHaveBeenCalled();
    expect(ultimoInit()['estado']).toEqual(cacheEstado);
    expect(estados.at(-1)?.estado).toBe('pending');
  });

  it('error de GET sin cache: bloquea el inicio y no envía vacío', () => {
    getProgreso.mockReturnValue(throwError(() => new Error('offline')));
    conectar();
    ready();

    expect(guardarProgreso).not.toHaveBeenCalled();
    expect(ultimoInit()['startAllowed']).toBe(false);
    expect(estados.at(-1)?.estado).toBe('error');
  });

  it('cache pending misma cuenta: reintenta el último estado al abrir', () => {
    const cacheEstado = estadoCon({ alumno: 'pendiente' });
    localStorage.setItem(
      cacheKey(1),
      JSON.stringify({
        estado: cacheEstado,
        revision: 7,
        pending: true,
        updatedAt: 1,
      }),
    );
    guardarProgreso.mockReturnValue(of({ estado: cacheEstado, revision: 8 }));
    conectar();
    ready();
    jest.advanceTimersByTime(0);

    expect(ultimoInit()['estado']).toEqual(cacheEstado);
    expect(guardarProgreso).toHaveBeenCalledTimes(1);
    expect(guardarProgreso.mock.calls[0][1]).toEqual(cacheEstado);
    expect(estados.at(-1)?.estado).toBe('saved');
  });

  it('cambio de cuenta con snapshot pendiente: cancela el envío del dueño anterior', () => {
    getProgreso
      .mockReturnValueOnce(of({ estado: null, revision: 0 }))
      .mockReturnValueOnce(of({ estado: null, revision: 0 }));
    conectar();
    ready();
    const contexto1 = ultimoInit()['contextId'] as string;
    snapshot(contexto1, 's1', estadoCon({ alumno: 'usuario1' }));

    identidad.next({ sub: 2, isImpersonating: false });
    expect(getProgreso).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(2000);

    expect(guardarProgreso).not.toHaveBeenCalled();
    const init2 = ultimoInit();
    expect(init2['contextId']).not.toBe(contexto1);
    const cache1 = JSON.parse(localStorage.getItem(cacheKey(1))!);
    expect(cache1.pending).toBe(true);
    expect(localStorage.getItem(cacheKey(2))).toBeNull();
  });

  it('ignora respuestas tardías del GET tras cambiar de cuenta', () => {
    const lento = new Subject<{
      estado: Record<string, unknown> | null;
      revision: number;
    }>();
    getProgreso.mockReturnValueOnce(lento.asObservable());
    getProgreso.mockReturnValueOnce(of({ estado: null, revision: 0 }));
    conectar();
    ready();

    identidad.next({ sub: 2, isImpersonating: false });
    lento.next({ estado: estadoCon({ alumno: 'viejo' }), revision: 9 });

    expect(ultimoInit()['estado']).toBeNull();
    expect(estados.some((e) => e.texto === 'Progreso cargado.')).toBe(false);
  });

  it('reintenta en serie el último snapshot cuando falla el PUT', () => {
    getProgreso.mockReturnValue(of({ estado: null, revision: 0 }));
    guardarProgreso.mockReturnValueOnce(throwError(() => new Error('offline')));
    guardarProgreso.mockReturnValue(
      of({ estado: estadoCon({ alumno: 'dos' }), revision: 2 }),
    );
    conectar();
    ready();
    const contexto = ultimoInit()['contextId'] as string;
    snapshot(contexto, 's1', estadoCon({ alumno: 'uno' }));
    snapshot(contexto, 's2', estadoCon({ alumno: 'dos' }));
    jest.advanceTimersByTime(500);

    expect(guardarProgreso).toHaveBeenCalledTimes(1);
    expect(estados.at(-1)?.estado).toBe('error');
    jest.advanceTimersByTime(2000);
    expect(guardarProgreso).toHaveBeenCalledTimes(2);
    expect(guardarProgreso.mock.calls[1][1]).toEqual(
      estadoCon({ alumno: 'dos' }),
    );
    expect(estados.at(-1)?.estado).toBe('saved');
  });

  it('rechaza ready/snapshot de otra ventana, origen o contexto', () => {
    conectar();
    emitirMensaje(
      {
        tf: HIDRAULICA_BRIDGE_TAG,
        v: HIDRAULICA_BRIDGE_VERSION,
        type: 'ready',
      },
      { source: { otro: true } },
    );
    emitirMensaje(
      {
        tf: HIDRAULICA_BRIDGE_TAG,
        v: HIDRAULICA_BRIDGE_VERSION,
        type: 'ready',
      },
      { origin: 'https://evil.example' },
    );
    expect(getProgreso).not.toHaveBeenCalled();

    ready();
    const contexto = ultimoInit()['contextId'] as string;
    snapshot('otro-contexto', 's1', estadoCon({ alumno: 'hostil' }));
    jest.advanceTimersByTime(1000);
    expect(guardarProgreso).not.toHaveBeenCalled();
  });

  it('ignora snapshots con estado inválido o demasiado grande', () => {
    conectar();
    ready();
    const contexto = ultimoInit()['contextId'] as string;
    snapshot(contexto, 's1', { v: 2 });
    snapshot(contexto, 's2', estadoCon({ relleno: 'x'.repeat(1024 * 1024) }));
    jest.advanceTimersByTime(1000);
    expect(guardarProgreso).not.toHaveBeenCalled();
  });

  it('destruir cancela el snapshot pendiente antes del debounce', () => {
    conectar();
    ready();
    const contexto = ultimoInit()['contextId'] as string;
    snapshot(contexto, 's1', estadoCon({ alumno: 'pendiente' }));

    control!.destruir();
    control = null;
    jest.advanceTimersByTime(2000);

    expect(guardarProgreso).not.toHaveBeenCalled();
    const cache = JSON.parse(localStorage.getItem(cacheKey(1))!);
    expect(cache.pending).toBe(true);
  });

  it('aplica altura válida y descarta alturas absurdas', () => {
    conectar();
    ready();
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'height',
      height: 1234,
    });
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'height',
      height: 999999,
    });
    expect(alturas).toEqual([1234, 30000]);
  });

  it('inmersivo: ignora height/scrollTop, conserva el scroll interno y envía presentación', () => {
    control = adapter.connect(
      iframe,
      {
        ...CONTEXTO,
        inmersivo: true,
        presentacion: {
          modo: 'INTEGRADA',
          tema: { primario: '#bb292a', fuente: 'system-ui' },
        },
      },
      callbacks,
    );
    ready();
    const init = ultimoInit();
    expect(init['presentacion']).toEqual({
      modo: 'INTEGRADA',
      tema: { primario: '#bb292a', fuente: 'system-ui' },
    });

    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'height',
      height: 4321,
    });
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'scrollTop',
      contextId: init['contextId'],
    });

    expect(alturas).toEqual([]);
    expect(iframe.scrollIntoView).not.toHaveBeenCalled();
  });

  it('estándar: conserva height/scrollTop y no envía presentación', () => {
    conectar();
    ready();
    const init = ultimoInit();
    expect(init).not.toHaveProperty('presentacion');
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'height',
      height: 4321,
    });
    emitirMensaje({
      tf: HIDRAULICA_BRIDGE_TAG,
      v: HIDRAULICA_BRIDGE_VERSION,
      type: 'scrollTop',
      contextId: init['contextId'],
    });
    expect(alturas).toEqual([4321]);
    expect(iframe.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
