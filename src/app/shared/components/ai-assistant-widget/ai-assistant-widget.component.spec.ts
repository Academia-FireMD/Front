import { HttpErrorResponse } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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
