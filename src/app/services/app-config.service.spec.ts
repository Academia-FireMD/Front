import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../environments/environment';
import { AppConfig, EstadoModulos } from '../shared/models/app-config.model';
import { ModuloApp } from '../shared/models/modulo-app.enum';
import { AppConfigService } from './app-config.service';
import { AuthService } from './auth.service';

const CONFIG_URL = `${environment.apiUrl}/api/app-config`;
const MODULOS_URL = `${environment.apiUrl}/api/app-config/modulos`;

const sampleConfig: AppConfig = {
  appName: 'AcmeAcademy',
  logoUrl: 'https://cdn.example.com/logo.png',
  primaryColor: '#123456',
  secondaryColor: '#abcdef',
  updatedAt: '2026-05-21T10:00:00Z',
};

const sampleModulos: EstadoModulos = {
  [ModuloApp.PLANIFICACION]: true,
  [ModuloApp.SIMULACROS]: true,
  [ModuloApp.HORARIOS]: true,
  [ModuloApp.DOCUMENTACION]: true,
  [ModuloApp.CURSOS]: true,
  [ModuloApp.EXAMEN]: true,
  [ModuloApp.TEST]: false,
  [ModuloApp.FLASHCARDS]: true,
  [ModuloApp.FACTURACION]: true,
  [ModuloApp.CALLEJERO]: true,
};

function mockAuth(rol: string | null) {
  return {
    decodeToken: jest.fn(() => (rol ? { rol } : null)),
  };
}

function mockToast() {
  return {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  };
}

describe('AppConfigService', () => {
  let service: AppConfigService;
  let httpMock: HttpTestingController;
  let auth: ReturnType<typeof mockAuth>;

  beforeEach(() => {
    auth = mockAuth(null);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AppConfigService,
        { provide: AuthService, useValue: auth },
        { provide: ToastrService, useValue: mockToast() },
      ],
    });
    service = TestBed.inject(AppConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('load() popula signals con respuestas exitosas', async () => {
    const promise = service.load();
    httpMock.expectOne(CONFIG_URL).flush(sampleConfig);
    httpMock.expectOne(MODULOS_URL).flush(sampleModulos);
    await promise;

    expect(service.appConfig().appName).toBe('AcmeAcademy');
    expect(service.estadoModulos()[ModuloApp.TEST]).toBe(false);
    expect(service.isLoaded()).toBe(true);
    expect(service.modulosFailedToLoad()).toBe(false);
  });

  it('load() falla → fallback defaults + isLoaded=true', async () => {
    const promise = service.load();
    httpMock
      .expectOne(CONFIG_URL)
      .error(new ProgressEvent('error'), { status: 500, statusText: 'err' });
    httpMock
      .expectOne(MODULOS_URL)
      .error(new ProgressEvent('error'), { status: 500, statusText: 'err' });

    // dejar pasar los await timer(1000) — usamos waitFor del backend de tests
    await new Promise((r) => setTimeout(r, 1100));

    httpMock
      .expectOne(CONFIG_URL)
      .error(new ProgressEvent('error'), { status: 500, statusText: 'err' });
    httpMock
      .expectOne(MODULOS_URL)
      .error(new ProgressEvent('error'), { status: 500, statusText: 'err' });

    await promise;
    expect(service.appConfig().appName).toBe('TecnikaFire');
    expect(service.isLoaded()).toBe(true);
    // Fail-open (incidente 2026-06-04): si los módulos no cargan NO se ocultan al
    // alumno — quedan todos true (el backend ModuloGuard impone el gating real).
    expect(service.estadoModulos()[ModuloApp.PLANIFICACION]).toBe(true);
    expect(service.estadoModulos()[ModuloApp.DOCUMENTACION]).toBe(true);
    expect(service.modulosFailedToLoad()).toBe(false);
  }, 10_000);

  it('load() retry path (T2): primer GET 500, retry succeed popula signal', async () => {
    const promise = service.load();
    httpMock
      .expectOne(CONFIG_URL)
      .error(new ProgressEvent('error'), { status: 500, statusText: 'err' });
    httpMock.expectOne(MODULOS_URL).flush(sampleModulos);

    await new Promise((r) => setTimeout(r, 1100));
    httpMock.expectOne(CONFIG_URL).flush(sampleConfig);

    await promise;
    expect(service.appConfig().appName).toBe('AcmeAcademy');
  }, 10_000);

  it('updateConfig 409 dispara reload y devuelve STALE_CONFIG', async () => {
    // initial load
    const init = service.load();
    httpMock.expectOne(CONFIG_URL).flush(sampleConfig);
    httpMock.expectOne(MODULOS_URL).flush(sampleModulos);
    await init;

    const updatePromise = service.updateConfig(
      { appName: 'Nuevo' },
      '2026-05-21T10:00:00Z',
    );
    const putReq = httpMock.expectOne(CONFIG_URL);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush(
      { code: 'STALE_CONFIG', latestUpdatedAt: '2026-05-21T11:00:00Z' },
      { status: 409, statusText: 'Conflict' },
    );

    // dejar drenar microtask (catch → await load → http.get)
    await Promise.resolve();
    await Promise.resolve();

    // triggered reload
    httpMock
      .expectOne(CONFIG_URL)
      .flush({ ...sampleConfig, updatedAt: '2026-05-21T11:00:00Z' });
    httpMock.expectOne(MODULOS_URL).flush(sampleModulos);

    const res = await updatePromise;
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('STALE_CONFIG');
  });

  it('toggleModulo PUT correcto + actualiza signal local', async () => {
    const init = service.load();
    httpMock.expectOne(CONFIG_URL).flush(sampleConfig);
    httpMock.expectOne(MODULOS_URL).flush(sampleModulos);
    await init;

    const togglePromise = service.toggleModulo(ModuloApp.SIMULACROS, false);
    const req = httpMock.expectOne(`${MODULOS_URL}/SIMULACROS`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ habilitado: false });
    req.flush({});
    const ok = await togglePromise;
    expect(ok).toBe(true);
    expect(service.estadoModulos()[ModuloApp.SIMULACROS]).toBe(false);
  });

  it('uploadLogo envía FormData con campo "logo"', async () => {
    const file = new File(['fake'], 'logo.png', { type: 'image/png' });
    const promise = service.uploadLogo(file);
    const req = httpMock.expectOne(`${CONFIG_URL}/logo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const fd = req.request.body as FormData;
    expect(fd.get('logo')).toBeInstanceOf(File);
    req.flush({
      logoUrl: 'https://cdn/new-logo.png',
      updatedAt: '2026-05-21T12:00:00Z',
    });
    const url = await promise;
    expect(url).toBe('https://cdn/new-logo.png');
    expect(service.appConfig().logoUrl).toBe('https://cdn/new-logo.png');
  });

  it('applyCssVars setea --primary-color y --secondary-color en :root', async () => {
    const init = service.load();
    httpMock.expectOne(CONFIG_URL).flush(sampleConfig);
    httpMock.expectOne(MODULOS_URL).flush(sampleModulos);
    await init;
    expect(
      document.documentElement.style.getPropertyValue('--primary-color'),
    ).toBe('#123456');
    expect(
      document.documentElement.style.getPropertyValue('--secondary-color'),
    ).toBe('#abcdef');
  });

  it('sanitizeAppName edge cases T4', () => {
    expect(service.sanitizeAppName('')).toBe('TecnikaFire');
    expect(service.sanitizeAppName('   ')).toBe('TecnikaFire');
    expect(service.sanitizeAppName(null)).toBe('TecnikaFire');
    expect(service.sanitizeAppName('A'.repeat(200))).toHaveLength(60);
    expect(service.sanitizeAppName('<script>evil</script>Acme')).toBe(
      'evilAcme',
    );
    expect(service.sanitizeAppName('  My App  ')).toBe('My App');
  });
});
