import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';

describe('UserService administrative detail', () => {
  let service: UserService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(UserService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the typed administrative detail by id', () => {
    service.getAdminUserDetail$(42).subscribe((detail) => {
      expect(detail.id).toBe(42);
      expect(detail.cantidadPlanificaciones).toBe(2);
    });
    const request = http.expectOne(`${environment.apiUrl}/user/admin/42`);
    expect(request.request.method).toBe('GET');
    request.flush({ id: 42, nombre: 'Ana', cantidadPlanificaciones: 2 });
  });
});
