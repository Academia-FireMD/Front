import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { LeccionTestComponent } from './leccion-test.component';

describe('LeccionTestComponent', () => {
  let fixture: ComponentFixture<LeccionTestComponent>;
  let component: LeccionTestComponent;
  let httpMock: HttpTestingController;

  const LECCION: any = {
    id: 100,
    titulo: 'Test 1',
    tipo: 'TEST',
    orden: 0,
    seccionId: 5,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeccionTestComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LeccionTestComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('leccion', LECCION);
    httpMock = TestBed.inject(HttpTestingController);
    // Reset stub Router/Toast spies entre tests (provienen del COMMON_TEST_PROVIDERS).
    (TestBed.inject(Router).navigate as jest.Mock).mockClear();
    (TestBed.inject(ToastrService).error as jest.Mock).mockClear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('empezarTest redirige a /realizar-test/:id en éxito', async () => {
    const router = TestBed.inject(Router);
    const promise = component.empezarTest();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/lecciones/${LECCION.id}/iniciar-test`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({ id: 555 });
    await promise;
    expect(router.navigate).toHaveBeenCalledWith([
      '/app/test/alumno/realizar-test',
      555,
    ]);
  });

  it('422 NO_FAILED_QUESTIONS muestra screen explanatorio en lugar de redirigir', async () => {
    const router = TestBed.inject(Router);
    const promise = component.empezarTest();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/lecciones/${LECCION.id}/iniciar-test`,
    );
    req.flush(
      {
        message: 'Esta lección es de repaso.',
        leccionId: LECCION.id,
        temaId: 42,
        reason: 'NO_FAILED_QUESTIONS',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await promise;
    expect(component.noFailedQuestions()).toEqual(
      expect.objectContaining({ reason: 'NO_FAILED_QUESTIONS', temaId: 42 }),
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('403 sin acceso muestra toast y redirige al catálogo', async () => {
    const router = TestBed.inject(Router);
    const toast = TestBed.inject(ToastrService);
    const promise = component.empezarTest();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/lecciones/${LECCION.id}/iniciar-test`,
    );
    req.flush(
      { message: 'Sin acceso' },
      { status: 403, statusText: 'Forbidden' },
    );
    await promise;
    expect(toast.error).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/app/cursos']);
  });

  it('irAlTema navega con queryParams.temaId desde el payload 422', () => {
    component.noFailedQuestions.set({
      message: 'msg',
      leccionId: 100,
      temaId: 99,
      reason: 'NO_FAILED_QUESTIONS',
    });
    const router = TestBed.inject(Router);
    component.irAlTema();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/test/alumno/realizar-test'],
      { queryParams: { temaId: 99 } },
    );
  });

  it('preview=true bloquea la llamada y no hace HTTP', async () => {
    fixture.componentRef.setInput('preview', true);
    fixture.detectChanges();
    await component.empezarTest();
    httpMock.expectNone(
      `${environment.apiUrl}/lecciones/${LECCION.id}/iniciar-test`,
    );
  });
});
