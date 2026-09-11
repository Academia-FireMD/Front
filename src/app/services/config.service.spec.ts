import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ConfigService],
    });
    service = TestBed.inject(ConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carga el permiso explícito de hard delete', async () => {
    const promise = service.load();
    http.expectOne(`${environment.apiUrl}/api/config`).flush({
      verifactuEnabled: false,
      hardDeleteFacturasEnabled: true,
    });
    await promise;

    expect(service.hardDeleteFacturasEnabled()).toBe(true);
  });

  it('mantiene el hard delete oculto si falla la configuración', async () => {
    const promise = service.load();
    http
      .expectOne(`${environment.apiUrl}/api/config`)
      .flush('down', { status: 503, statusText: 'Unavailable' });
    await promise;

    expect(service.hardDeleteFacturasEnabled()).toBe(false);
  });
});
