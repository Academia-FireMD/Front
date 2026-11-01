import { HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import {
  AI_ASSISTANT_DOCK_CLASS,
  AI_ASSISTANT_OPEN_RESULT_EVENT,
  AiAssistantWidgetComponent,
} from './ai-assistant-widget.component';

describe('AiAssistantWidgetComponent', () => {
  let httpGet: jest.Mock;

  afterEach(() => {
    document.body.classList.remove(AI_ASSISTANT_DOCK_CLASS);
    document.getElementById('ai-assistant-dock-style')?.remove();
    document.getElementById('ai-widget-btn')?.remove();
    delete (window as any).PaidioWidget;
    jest.useRealTimers();
  });

  function setup() {
    httpGet = jest.fn();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, AiAssistantWidgetComponent],
      providers: [
        { provide: HttpClient, useValue: { get: httpGet } },
        {
          provide: AuthService,
          useValue: { decodeToken: () => ({ rol: 'ALUMNO' }) },
        },
      ],
    });
    return TestBed.createComponent(AiAssistantWidgetComponent)
      .componentInstance;
  }

  function forbidden(reason?: string, requiredTier?: string) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: 403,
          error: reason ? { reason, requiredTier } : {},
        }),
    );
  }

  it('muestra el paywall cuando el acceso se deniega por TIER_TOO_LOW', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('TIER_TOO_LOW'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.paywall()).toBe(true);
  });

  it('captura el tier requerido del 403 para el copy del paywall', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('TIER_TOO_LOW', 'PREMIUM'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.requiredTier()).toBe('PREMIUM');
    expect(cmp.requisitoTexto()).toBe('Premium');
  });

  it('NO muestra paywall con NO_SUBSCRIPTION (oculto en silencio)', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('NO_SUBSCRIPTION'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.paywall()).toBe(false);
  });

  it('NO muestra paywall con EXPIRED (oculto en silencio)', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(forbidden('EXPIRED'));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.paywall()).toBe(false);
  });

  it('NO muestra paywall cuando el token se obtiene OK', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(of({ token: 'jwt' }));

    cmp.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(cmp.paywall()).toBe(false);
    cmp.ngOnDestroy();
  });

  it('no inyecta el script si el token llega después de destruir', async () => {
    const cmp = setup();
    const respuesta = new Subject<{ token: string }>();
    httpGet.mockReturnValue(respuesta);

    cmp.ngOnInit();
    await Promise.resolve();
    cmp.ngOnDestroy();
    respuesta.next({ token: 'jwt' });
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelector('script[data-mode="floating"]')).toBeNull();
  });

  it('marca y avisa al script concreto antes de retirarlo', async () => {
    const cmp = setup();
    httpGet.mockReturnValue(of({ token: 'jwt' }));
    cmp.ngOnInit();
    await Promise.resolve();
    const script = document.querySelector(
      'script[data-mode="floating"]',
    ) as HTMLScriptElement;
    expect(script).toBeTruthy();
    const aviso = jest.fn();
    script.addEventListener('paidio:destroy', aviso);

    cmp.ngOnDestroy();

    expect(script.getAttribute('data-paidio-destroyed')).toBe('true');
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(script.isConnected).toBe(false);
  });

  describe('integración visual de Ayuda', () => {
    function crearLanzador(): HTMLButtonElement {
      const boton = document.createElement('button');
      boton.id = 'ai-widget-btn';
      boton.click = jest.fn();
      document.body.appendChild(boton);
      return boton;
    }

    it('pulsa el lanzador existente y confirma la apertura', async () => {
      const cmp = setup();
      httpGet.mockReturnValue(of({ token: 'jwt' }));
      cmp.ngOnInit();
      await Promise.resolve();
      const lanzador = crearLanzador();
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();

      expect(lanzador.click).toHaveBeenCalledTimes(1);
      expect(resultado).toHaveBeenCalledTimes(1);
      expect((resultado.mock.calls[0][0] as CustomEvent).detail).toEqual({
        abierto: true,
      });
      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
      cmp.ngOnDestroy();
    });

    it('espera al lanzador de carga tardía y lo pulsa al aparecer', async () => {
      const cmp = setup();
      httpGet.mockReturnValue(of({ token: 'jwt' }));
      cmp.ngOnInit();
      await Promise.resolve();
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();
      expect(resultado).not.toHaveBeenCalled();

      const lanzador = crearLanzador();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(lanzador.click).toHaveBeenCalledTimes(1);
      expect((resultado.mock.calls[0][0] as CustomEvent).detail).toEqual({
        abierto: true,
      });
      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
      cmp.ngOnDestroy();
    });

    it('informa de que la Ayuda no está disponible si nunca aparece', () => {
      jest.useFakeTimers();
      const cmp = setup();
      httpGet.mockReturnValue(forbidden('NO_SUBSCRIPTION'));
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();
      jest.advanceTimersByTime(3_000);

      expect(resultado).toHaveBeenCalledTimes(1);
      expect((resultado.mock.calls[0][0] as CustomEvent).detail).toEqual({
        abierto: false,
      });
      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
      cmp.ngOnDestroy();
    });

    it('prefiere la API pública PaidioWidget.open y conserva el click como fallback', async () => {
      const cmp = setup();
      httpGet.mockReturnValue(of({ token: 'jwt' }));
      cmp.ngOnInit();
      await Promise.resolve();
      const open = jest.fn();
      (window as any).PaidioWidget = { open };
      const lanzador = crearLanzador();
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();

      expect(open).toHaveBeenCalledTimes(1);
      expect(lanzador.click).not.toHaveBeenCalled();
      expect(resultado).toHaveBeenCalledTimes(1);
      expect((resultado.mock.calls[0][0] as CustomEvent).detail).toEqual({
        abierto: true,
      });
      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
      cmp.ngOnDestroy();
    });

    it('ignora la API pública obsoleta hasta que el lanzador actual está montado', async () => {
      const cmp = setup();
      httpGet.mockReturnValue(of({ token: 'jwt' }));
      cmp.ngOnInit();
      await Promise.resolve();
      const open = jest.fn();
      (window as any).PaidioWidget = { open };
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();
      expect(open).not.toHaveBeenCalled();
      expect(resultado).not.toHaveBeenCalled();

      const lanzador = crearLanzador();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(open).toHaveBeenCalledTimes(1);
      expect(lanzador.click).not.toHaveBeenCalled();
      expect(resultado).toHaveBeenCalledTimes(1);
      expect((resultado.mock.calls[0][0] as CustomEvent).detail).toEqual({
        abierto: true,
      });
      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
      cmp.ngOnDestroy();
    });

    it('abre el paywall si el 403 de tier llega después del clic y responde una sola vez', async () => {
      jest.useFakeTimers();
      const cmp = setup();
      const respuesta = new Subject<{ token: string }>();
      httpGet.mockReturnValue(respuesta);
      cmp.ngOnInit();
      await Promise.resolve();
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();
      expect(cmp.paywallOpen()).toBe(false);

      respuesta.error(
        new HttpErrorResponse({
          status: 403,
          error: { reason: 'TIER_TOO_LOW', requiredTier: 'ADVANCED' },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(cmp.paywall()).toBe(true);
      expect(cmp.paywallOpen()).toBe(true);
      expect(resultado).toHaveBeenCalledTimes(1);
      expect((resultado.mock.calls[0][0] as CustomEvent).detail).toEqual({
        abierto: true,
      });

      // El timer/observador pendiente quedó limpio: no hay un segundo
      // resultado "no disponible" después de abrir el paywall.
      jest.advanceTimersByTime(5_000);
      expect(resultado).toHaveBeenCalledTimes(1);

      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
      cmp.ngOnDestroy();
    });

    it('no emite ni abre si se destruye antes del 403 tardío', async () => {
      const cmp = setup();
      const respuesta = new Subject<{ token: string }>();
      httpGet.mockReturnValue(respuesta);
      cmp.ngOnInit();
      await Promise.resolve();
      const resultado = jest.fn();
      document.addEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);

      cmp.solicitarApertura();
      cmp.ngOnDestroy();
      respuesta.error(
        new HttpErrorResponse({
          status: 403,
          error: { reason: 'TIER_TOO_LOW', requiredTier: 'ADVANCED' },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(cmp.paywallOpen()).toBe(false);
      expect(resultado).not.toHaveBeenCalled();
      document.removeEventListener(AI_ASSISTANT_OPEN_RESULT_EVENT, resultado);
    });

    it('oculta el lanzador flotante cuando la página lo ancla', async () => {
      const cmp = setup();
      httpGet.mockReturnValue(of({ token: 'jwt' }));
      cmp.ngOnInit();
      await Promise.resolve();

      document.body.classList.add(AI_ASSISTANT_DOCK_CLASS);

      const estilo = document.getElementById('ai-assistant-dock-style');
      expect(estilo?.textContent).toContain(`body.${AI_ASSISTANT_DOCK_CLASS}`);
      expect(estilo?.textContent).toContain('#ai-widget-btn');
      cmp.ngOnDestroy();
    });
  });
});
