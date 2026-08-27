import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { CallejeroEmbedComponent } from './callejero-embed.component';

describe('CallejeroEmbedComponent', () => {
  let fixture: ComponentFixture<CallejeroEmbedComponent>;
  let component: CallejeroEmbedComponent;
  let mockAuthService: {
    getToken: jest.Mock;
    refreshToken$: jest.Mock;
  };
  let postMessageSpy: jest.Mock;
  let mockContentWindow: Window;

  beforeEach(async () => {
    postMessageSpy = jest.fn();
    mockContentWindow = {
      postMessage: postMessageSpy,
    } as unknown as Window;

    mockAuthService = {
      getToken: jest.fn().mockReturnValue('mock-jwt-token'),
      refreshToken$: jest
        .fn()
        .mockReturnValue(of({ access_token: 'fresh-token' })),
    };

    await TestBed.configureTestingModule({
      imports: [CallejeroEmbedComponent],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CallejeroEmbedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const iframe = component.iframeRef.nativeElement;
    Object.defineProperty(iframe, 'contentWindow', {
      value: mockContentWindow,
      configurable: true,
    });
  });

  function mensaje(
    data: unknown,
    options: { origin?: string; source?: Window } = {},
  ): MessageEvent {
    return new MessageEvent('message', {
      origin: options.origin ?? window.location.origin,
      source: options.source ?? mockContentWindow,
      data,
    });
  }

  it('crea el componente y apunta al estático del HTML de Raúl', () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    const url = sanitizer.sanitize(4, component.src);
    expect(component).toBeTruthy();
    expect(url).toContain('/callejero-embed/valencia_27.html');
    const iframe: HTMLIFrameElement | null =
      fixture.nativeElement.querySelector(
        '[data-testid=callejero-embed-iframe]',
      );
    expect(iframe).toBeTruthy();
    expect(iframe!.getAttribute('allow')).toContain('geolocation');
  });

  it('no envía credenciales espontáneamente al cargar el componente', () => {
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('responde non-force con requestId, token y apiBase del build', () => {
    component.onMessage(
      mensaje({
        type: 'tf-callejero-auth-request',
        requestId: 'request-1',
        forceRefresh: false,
      }),
    );

    expect(mockAuthService.refreshToken$).not.toHaveBeenCalled();
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: 'tf-callejero-auth',
        requestId: 'request-1',
        forceRefresh: false,
        token: 'mock-jwt-token',
        apiBase: environment.apiUrl,
      },
      window.location.origin,
    );
  });

  it('force solicita refresh y responde el token actualizado', () => {
    mockAuthService.getToken.mockReturnValue('fresh-token');

    component.onMessage(
      mensaje({
        type: 'tf-callejero-auth-request',
        requestId: 'request-force',
        forceRefresh: true,
      }),
    );

    expect(mockAuthService.refreshToken$).toHaveBeenCalledTimes(1);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tf-callejero-auth',
        requestId: 'request-force',
        forceRefresh: true,
        token: 'fresh-token',
        apiBase: environment.apiUrl,
      }),
      window.location.origin,
    );
  });

  it('ignora source u origin ajenos', () => {
    const wrongWindow = { postMessage: jest.fn() } as unknown as Window;
    const data = {
      type: 'tf-callejero-auth-request',
      requestId: 'request-1',
      forceRefresh: false,
    };

    component.onMessage(mensaje(data, { origin: 'https://evil.example.com' }));
    component.onMessage(mensaje(data, { source: wrongWindow }));

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('ignora payloads con forma incorrecta o requestId fuera de límites', () => {
    const base = {
      type: 'tf-callejero-auth-request',
      requestId: 'request-1',
      forceRefresh: false,
    };
    const invalidos = [
      { type: base.type, forceRefresh: false },
      { ...base, forceRefresh: 'false' },
      { ...base, requestId: '' },
      { ...base, requestId: 'x'.repeat(129) },
      { ...base, extra: true },
    ];

    for (const data of invalidos) component.onMessage(mensaje(data));

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('responde token null si el refresh force falla', () => {
    mockAuthService.refreshToken$.mockReturnValueOnce(
      throwError(() => new Error('refresh failed')),
    );

    component.onMessage(
      mensaje({
        type: 'tf-callejero-auth-request',
        requestId: 'request-error',
        forceRefresh: true,
      }),
    );

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'request-error',
        token: null,
      }),
      window.location.origin,
    );
  });
});
