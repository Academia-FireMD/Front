import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CallejeroProgresoService } from './callejero-progreso.service';
import { CallejeroProgresoAdapterService } from './callejero-progreso-adapter.service';

describe('CallejeroProgresoAdapterService', () => {
  let adapter: CallejeroProgresoAdapterService;
  let usuario$: BehaviorSubject<{ id: number } | null>;
  let identidad$: BehaviorSubject<{
    sub: unknown;
    isImpersonating: boolean;
  } | null>;
  let identidadToken: { sub: unknown; isImpersonating: boolean } | null;
  let sesion: {
    estado$: BehaviorSubject<{ estado: 'cargando'; texto: string }>;
    cargar: jest.Mock;
    guardar: jest.Mock;
    borrar: jest.Mock;
    refrescar: jest.Mock;
    reintentar: jest.Mock;
    cancelar: jest.Mock;
  };
  let service: { crearSesion: jest.Mock };
  let contentWindow: Window & { postMessage: jest.Mock };

  beforeEach(() => {
    usuario$ = new BehaviorSubject<{ id: number } | null>({ id: 21 });
    identidadToken = { sub: 21, isImpersonating: false };
    identidad$ = new BehaviorSubject<{
      sub: unknown;
      isImpersonating: boolean;
    } | null>(identidadToken);
    sesion = {
      estado$: new BehaviorSubject({
        estado: 'cargando',
        texto: 'Cargando progreso…',
      }),
      cargar: jest.fn().mockReturnValue(
        of({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: 2,
          estado: { asked: { 'p|Hospital': 2 }, fallos: {} },
          guardado: true,
          origen: 'servidor',
        }),
      ),
      guardar: jest.fn(),
      borrar: jest.fn().mockReturnValue(
        of({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: 3,
          estado: { asked: {}, fallos: {} },
          guardado: true,
          origen: 'servidor',
        }),
      ),
      refrescar: jest.fn().mockReturnValue(of(null)),
      reintentar: jest.fn(),
      cancelar: jest.fn(),
    };
    service = { crearSesion: jest.fn().mockReturnValue(sesion) };
    TestBed.configureTestingModule({
      providers: [
        CallejeroProgresoAdapterService,
        {
          provide: AuthService,
          useValue: {
            currentUser$: usuario$.asObservable(),
            currentIdentity$: identidad$.asObservable(),
            decodeToken: () => identidadToken,
            isImpersonating: () => identidadToken?.isImpersonating ?? false,
          },
        },
        { provide: CallejeroProgresoService, useValue: service },
      ],
    });
    adapter = TestBed.inject(CallejeroProgresoAdapterService);
  });

  afterEach(() => {
    window.dispatchEvent(new Event('blur'));
  });

  function crearIframe(): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const childWindow = iframe.contentWindow!;
    Object.defineProperty(childWindow, 'postMessage', {
      value: jest.fn(),
      configurable: true,
    });
    contentWindow = childWindow as Window & { postMessage: jest.Mock };
    return iframe;
  }

  function mensaje(
    data: unknown,
    source: Window = contentWindow,
    origin = window.location.origin,
  ): void {
    window.dispatchEvent(new MessageEvent('message', { data, source, origin }));
  }

  it('solo carga progreso desde el iframe esperado, origen y contexto actuales', () => {
    const iframe = crearIframe();
    const bridge = adapter.connect(iframe, 'valencia', jest.fn());
    iframe.dispatchEvent(new Event('load'));
    const init = contentWindow.postMessage.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(init).toMatchObject({
      type: 'tf-atlas:iniciar',
      modalidad: 'valencia',
      build: '32',
    });
    expect(contentWindow.postMessage.mock.calls.at(-1)?.[1]).toBe(
      window.location.origin,
    );

    const load = {
      app: 'tf-atlas',
      version: 2,
      build: '32',
      type: 'tf-atlas:cargar',
      modalidad: 'valencia',
      contexto: init['contexto'],
      requestId: 'load-1',
      legado: { asked: {}, fallos: {} },
      almacenamientoDisponible: true,
      examenActivo: false,
    };
    mensaje(load, contentWindow, 'https://mal.example');
    mensaje(load, { postMessage: jest.fn() } as unknown as Window);
    mensaje({ ...load, contexto: 'contexto-antiguo' });
    mensaje({ ...load, modalidad: 'alicante' });
    mensaje({ ...load, intruso: true });
    expect(sesion.cargar).not.toHaveBeenCalled();

    mensaje(load);
    expect(sesion.cargar).toHaveBeenCalledWith(load.legado, true, false);
    const response = contentWindow.postMessage.mock.calls
      .map(([message]) => message as Record<string, unknown>)
      .find((message) => message['type'] === 'tf-atlas:progreso');
    expect(response).toMatchObject({
      type: 'tf-atlas:progreso',
      build: '32',
      contexto: init['contexto'],
      requestId: 'load-1',
      guardado: true,
      data: { asked: { 'p|Hospital': 2 }, fallos: {} },
    });
    bridge.destruir();
    iframe.remove();
  });

  it('ignora progreso hostil y guarda solo un estado válido de la sesión', () => {
    const iframe = crearIframe();
    const bridge = adapter.connect(iframe, 'valencia', jest.fn());
    iframe.dispatchEvent(new Event('load'));
    const init = contentWindow.postMessage.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    mensaje({
      app: 'tf-atlas',
      version: 2,
      build: '32',
      type: 'tf-atlas:cargar',
      modalidad: 'valencia',
      contexto: init['contexto'],
      requestId: 'load-before-save',
      legado: { asked: {}, fallos: {} },
      almacenamientoDisponible: true,
      examenActivo: false,
    });
    sesion.guardar.mockClear();
    const change = {
      app: 'tf-atlas',
      version: 2,
      build: '32',
      type: 'tf-atlas:progreso',
      modalidad: 'valencia',
      contexto: init['contexto'],
      requestId: 'save-1',
      data: { asked: { 'p|Hospital': 3 }, fallos: {} },
      examenActivo: false,
    };
    mensaje(change, contentWindow, 'https://otra.example');
    mensaje(change, { postMessage: jest.fn() } as unknown as Window);
    mensaje({ ...change, contexto: 'sesion-anterior' });
    mensaje({ ...change, modalidad: 'alicante' });
    mensaje({
      ...change,
      data: { asked: { __proto__: { polluted: true } }, fallos: {} },
    });
    expect(sesion.guardar).not.toHaveBeenCalled();

    mensaje(change);
    expect(sesion.guardar).toHaveBeenCalledWith({
      asked: { 'p|Hospital': 3 },
      fallos: {},
    });
    bridge.destruir();
    iframe.remove();
  });

  it('cancela al cambiar los claims del JWT sin esperar el perfil nuevo', () => {
    const iframe = crearIframe();
    const bridge = adapter.connect(iframe, 'alicante', jest.fn());
    iframe.dispatchEvent(new Event('load'));
    const firstInit = contentWindow.postMessage.mock.calls.at(
      -1,
    )?.[0] as Record<string, unknown>;

    const guard = service.crearSesion.mock.calls[0][2] as () => boolean;
    expect(guard()).toBe(true);
    identidadToken = { sub: 1, isImpersonating: false };
    identidad$.next(identidadToken);
    expect(sesion.cancelar).toHaveBeenCalledTimes(1);
    expect(guard()).toBe(false);
    // currentUser$ sigue con la identidad anterior mientras su perfil se resuelve.
    expect(usuario$.value).toEqual({ id: 21 });
    const secondSession = {
      ...sesion,
      cancelar: jest.fn(),
      estado$: new BehaviorSubject({ estado: 'cargando' as const, texto: '' }),
    };
    service.crearSesion.mockReturnValue(secondSession);
    identidadToken = { sub: 23, isImpersonating: true };
    identidad$.next(identidadToken);
    const latestInit = contentWindow.postMessage.mock.calls.at(
      -1,
    )?.[0] as Record<string, unknown>;

    expect(latestInit['contexto']).not.toBe(firstInit['contexto']);
    expect(service.crearSesion).toHaveBeenLastCalledWith(
      23,
      'alicante',
      expect.any(Function),
    );
    bridge.destruir();
    iframe.remove();
  });

  it('cancela la sesión al cerrar sesión inmediatamente desde los claims', () => {
    const iframe = crearIframe();
    const bridge = adapter.connect(iframe, 'valencia', jest.fn());
    iframe.dispatchEvent(new Event('load'));

    identidadToken = null;
    identidad$.next(null);

    expect(sesion.cancelar).toHaveBeenCalledTimes(1);
    bridge.destruir();
    iframe.remove();
  });

  it('mantiene el contexto al emitir un refresh con el mismo sujeto e impersonación', () => {
    const iframe = crearIframe();
    const bridge = adapter.connect(iframe, 'valencia', jest.fn());
    iframe.dispatchEvent(new Event('load'));
    const initialMessageCount = contentWindow.postMessage.mock.calls.length;

    identidadToken = { sub: 21, isImpersonating: false };
    identidad$.next(identidadToken);

    expect(service.crearSesion).toHaveBeenCalledTimes(1);
    expect(sesion.cancelar).not.toHaveBeenCalled();
    expect(contentWindow.postMessage).toHaveBeenCalledTimes(
      initialMessageCount,
    );
    bridge.destruir();
    iframe.remove();
  });
});
