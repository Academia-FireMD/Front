import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { Store } from '@ngrx/store';
import { HttpErrorResponse } from '@angular/common/http';
import { SimuladorNotaSnapshot } from './models/simulador-nota.model';
import { SimuladorNotaService } from './services/simulador-nota.service';
import { SimuladorNotaComponent } from './simulador-nota.component';
import {
  sanitizeSimuladorSnapshot,
  SIMULADOR_NOTA_CHANNEL,
} from './simulador-nota-bridge';
import {
  makeValidSnapshot,
  makeValidWireState,
} from './testing/simulador-nota-fixtures';

const EMPTY_SNAPSHOT: SimuladorNotaSnapshot = {
  v: 1,
  actual: null,
  guardadas: [],
  tab: null,
  plazas: {},
};

describe('SimuladorNotaComponent', () => {
  let fixture: ComponentFixture<SimuladorNotaComponent>;
  let component: SimuladorNotaComponent;
  let user$: BehaviorSubject<{ id: number } | null>;
  let service: {
    cargar: jest.Mock;
    guardar: jest.Mock;
    borrar: jest.Mock;
  };

  beforeEach(async () => {
    user$ = new BehaviorSubject<{ id: number } | null>({ id: 17 });
    service = {
      cargar: jest
        .fn()
        .mockReturnValue(
          of({ revision: 4, estado: null, actualizadoEn: null }),
        ),
      guardar: jest.fn(),
      borrar: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [SimuladorNotaComponent],
      providers: [
        { provide: SimuladorNotaService, useValue: service },
        { provide: Store, useValue: { select: jest.fn(() => user$) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(SimuladorNotaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  it('no muestra el iframe hasta cargar el estado y lo hidrata con revisión CAS', () => {
    expect(service.cargar).toHaveBeenCalledTimes(1);
    const iframe: HTMLIFrameElement | null =
      fixture.nativeElement.querySelector('iframe');
    expect(iframe).toBeTruthy();

    const postMessage = jest.spyOn(iframe!.contentWindow!, 'postMessage');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe!.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);

    expect(postMessage).toHaveBeenCalledWith(
      {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'hydrate',
        revision: 4,
        estado: null,
      },
      window.location.origin,
    );
    expect(component.hydrated).toBe(true);
  });

  it('ignora cambios del iframe antes de completar la hidratación', () => {
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'change',
        estado: EMPTY_SNAPSHOT,
      },
    } as MessageEvent);

    expect(service.guardar).not.toHaveBeenCalled();
  });

  it('no inicializa un estado vacío ni monta iframe si falla la carga', () => {
    service.cargar.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    user$.next({ id: 18 });
    fixture.detectChanges();

    expect(component.loadError).toBe(true);
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('al cambiar de usuario invalida la sesión iframe anterior', () => {
    user$.next({ id: 18 });

    expect(service.cargar).toHaveBeenCalledTimes(2);
    expect(component.hydrated).toBe(false);
  });

  it('serializa el guardado con la revisión cargada y no persiste antes del debounce', async () => {
    jest.useFakeTimers();
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);
    service.guardar.mockReturnValue(
      of({ revision: 5, estado: EMPTY_SNAPSHOT, actualizadoEn: null }),
    );

    const draft: SimuladorNotaSnapshot = makeValidSnapshot();
    draft.actual = makeValidWireState('cv', 'consorcio');
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'change', estado: draft },
    } as MessageEvent);

    expect(service.guardar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.guardar).toHaveBeenCalledWith(
      4,
      sanitizeSimuladorSnapshot(draft),
    );
    expect(component.statusMessage).toBe('Cambios privados guardados.');
  });

  it('un 409 conserva el borrador y bloquea sobrescrituras automáticas', async () => {
    jest.useFakeTimers();
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);
    service.guardar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    const draft: SimuladorNotaSnapshot = makeValidSnapshot();
    draft.actual = makeValidWireState('madrid');
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'change', estado: draft },
    } as MessageEvent);
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.hasConflict).toBe(true);
    expect(service.guardar).toHaveBeenCalledTimes(1);
    expect(component.statusMessage).toContain('Tu borrador sigue visible');
  });

  it('guarda la última edición hecha durante el conflicto al confirmar sobrescritura', async () => {
    jest.useFakeTimers();
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);

    const staleDraft = makeValidSnapshot();
    staleDraft.actual = makeValidWireState('madrid');
    const latestDraft = makeValidSnapshot();
    latestDraft.actual = makeValidWireState('madrid');
    latestDraft.actual!['nombre'] = 'Última edición durante conflicto';

    service.guardar
      .mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 409 })),
      )
      .mockReturnValueOnce(
        of({ revision: 6, estado: latestDraft, actualizadoEn: null }),
      );
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'change',
        estado: staleDraft,
      },
    } as MessageEvent);
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.hasConflict).toBe(true);

    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'change',
        estado: latestDraft,
      },
    } as MessageEvent);
    service.cargar.mockReturnValueOnce(
      of({ revision: 5, estado: staleDraft, actualizadoEn: null }),
    );
    component.guardarBorradorSobreRemoto();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.guardar).toHaveBeenNthCalledWith(
      2,
      5,
      sanitizeSimuladorSnapshot(latestDraft),
    );
  });

  it('conserva un borrado recibido durante el conflicto y solo lo aplica al confirmarlo', async () => {
    jest.useFakeTimers();
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);
    service.guardar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );

    const draft = makeValidSnapshot();
    draft.actual = makeValidWireState('madrid');
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'change', estado: draft },
    } as MessageEvent);
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.hasConflict).toBe(true);

    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'delete' },
    } as MessageEvent);
    fixture.detectChanges();

    expect(component.pendingDelete).toBe(true);
    expect(component.hasPendingDraft).toBe(false);
    expect(service.borrar).not.toHaveBeenCalled();
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll(
          'button',
        ) as NodeListOf<HTMLButtonElement>,
      ).some((button) =>
        button.textContent?.includes('Confirmar borrado remoto'),
      ),
    ).toBe(true);

    service.cargar.mockReturnValueOnce(
      of({ revision: 5, estado: draft, actualizadoEn: null }),
    );
    service.borrar.mockReturnValue(
      of({ revision: 6, estado: null, actualizadoEn: null }),
    );
    component.confirmarBorradoRemoto();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.borrar).toHaveBeenCalledWith(5);
  });

  it('no pierde una edición en vuelo mientras consulta la revisión para resolver el conflicto', async () => {
    jest.useFakeTimers();
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);
    service.guardar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    const firstDraft = makeValidSnapshot();
    firstDraft.actual = makeValidWireState('madrid');
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'change',
        estado: firstDraft,
      },
    } as MessageEvent);
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();
    expect(component.hasConflict).toBe(true);

    const remote = new Subject<{
      revision: number;
      estado: SimuladorNotaSnapshot;
      actualizadoEn: null;
    }>();
    service.cargar.mockReturnValueOnce(remote);
    component.guardarBorradorSobreRemoto();
    fixture.detectChanges();
    expect(iframe.hasAttribute('inert')).toBe(true);

    const inFlightDraft = makeValidSnapshot();
    inFlightDraft.actual = makeValidWireState('madrid');
    inFlightDraft.actual!['nombre'] = 'Edición que llegó durante la consulta';
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'change',
        estado: inFlightDraft,
      },
    } as MessageEvent);
    remote.next({ revision: 5, estado: firstDraft, actualizadoEn: null });
    remote.complete();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(service.guardar).toHaveBeenCalledTimes(1);
    expect(component.hasConflict).toBe(true);
    expect(component.hasPendingDraft).toBe(true);
    expect(component.loadingRemote).toBe(false);
    expect(iframe.hasAttribute('inert')).toBe(false);
  });

  it('el mensaje delete usa DELETE CAS y nunca un PUT vacío', async () => {
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);
    service.borrar.mockReturnValue(
      of({ revision: 5, estado: null, actualizadoEn: null }),
    );

    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'delete' },
    } as MessageEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.borrar).toHaveBeenCalledWith(4);
    expect(service.guardar).not.toHaveBeenCalled();
    expect(component.pendingDelete).toBe(false);
  });

  it('muestra una acción de reintento cuando falla DELETE', async () => {
    const iframe: HTMLIFrameElement =
      fixture.nativeElement.querySelector('iframe');
    component.onIframeLoad();
    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
    } as MessageEvent);
    service.borrar.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );

    component.onWindowMessage({
      origin: window.location.origin,
      source: iframe.contentWindow,
      data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'delete' },
    } as MessageEvent);
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.pendingDelete).toBe(true);
    const retry = Array.from(
      fixture.nativeElement.querySelectorAll(
        'button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) =>
      (button.textContent ?? '').includes('Reintentar borrado'),
    );
    expect(retry).toBeTruthy();

    service.borrar.mockReturnValue(
      of({ revision: 5, estado: null, actualizadoEn: null }),
    );
    (retry as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.borrar).toHaveBeenCalledTimes(2);
    expect(component.pendingDelete).toBe(false);
  });

  it.each([0, 500])(
    'conserva y guarda una sola vez los cambios durante DELETE tras %i ms',
    async (delay) => {
      jest.useFakeTimers();
      const iframe: HTMLIFrameElement =
        fixture.nativeElement.querySelector('iframe');
      const postMessage = jest.spyOn(iframe.contentWindow!, 'postMessage');
      component.onIframeLoad();
      component.onWindowMessage({
        origin: window.location.origin,
        source: iframe.contentWindow,
        data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' },
      } as MessageEvent);

      const deletion = new Subject<{
        revision: number;
        estado: null;
        actualizadoEn: null;
      }>();
      service.borrar.mockReturnValue(deletion);
      component.onWindowMessage({
        origin: window.location.origin,
        source: iframe.contentWindow,
        data: { channel: SIMULADOR_NOTA_CHANNEL, type: 'delete' },
      } as MessageEvent);
      await Promise.resolve();

      const newerDraft = makeValidSnapshot();
      newerDraft.actual = makeValidWireState('cv', 'consorcio');
      service.guardar.mockReturnValue(
        of({ revision: 6, estado: newerDraft, actualizadoEn: null }),
      );
      component.onWindowMessage({
        origin: window.location.origin,
        source: iframe.contentWindow,
        data: {
          channel: SIMULADOR_NOTA_CHANNEL,
          type: 'change',
          estado: newerDraft,
        },
      } as MessageEvent);
      jest.advanceTimersByTime(delay);
      deletion.next({ revision: 5, estado: null, actualizadoEn: null });
      deletion.complete();
      await jest.runAllTimersAsync();
      fixture.detectChanges();

      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(component.pendingDelete).toBe(false);
      expect(service.guardar).toHaveBeenCalledTimes(1);
      expect(service.guardar).toHaveBeenCalledWith(5, newerDraft);
      expect(component.statusMessage).toBe('Cambios privados guardados.');
    },
  );
});
