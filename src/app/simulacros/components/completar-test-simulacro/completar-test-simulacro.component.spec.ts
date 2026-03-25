import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TestService } from '../../../services/test.service';
import { COMMON_TEST_PROVIDERS, createMockTest } from '../../../testing';
import { CompletarTestSimulacroComponent } from './completar-test-simulacro.component';

describe('CompletarTestSimulacroComponent — integration', () => {
  let component: CompletarTestSimulacroComponent;
  let fixture: ComponentFixture<CompletarTestSimulacroComponent>;
  let testServiceMock: { getTestById: jest.Mock };
  let routerMock: { navigate: jest.Mock };
  let toastrMock: { error: jest.Mock; success: jest.Mock };
  let activatedRouteMock: { params: unknown };

  function buildComponent(params: { idExamen?: string; idTest?: string } = { idExamen: '5', idTest: '42' }) {
    activatedRouteMock = { params: of(params) };

    testServiceMock = {
      getTestById: jest.fn(() => of(createMockTest({ id: Number(params.idTest ?? 42) }))),
    };

    return TestBed.configureTestingModule({
      declarations: [CompletarTestSimulacroComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: TestService, useValue: testServiceMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  }

  it('debería crearse correctamente', async () => {
    await buildComponent();
    fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
    component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  describe('Carga desde parámetros de ruta', () => {
    beforeEach(async () => {
      await buildComponent({ idExamen: '5', idTest: '42' });
      fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
      component = fixture.componentInstance;
      routerMock = (component as any).router;
      toastrMock = (component as any).toastr;
      fixture.detectChanges();
      // Give async ngOnInit time to complete
      await new Promise((r) => setTimeout(r, 50));
    });

    it('asigna idExamen e idTest correctamente desde los params', () => {
      expect(component.idExamen).toBe(5);
      expect(component.idTest).toBe(42);
    });

    it('llama a getTestById con el idTest correcto', () => {
      expect(testServiceMock.getTestById).toHaveBeenCalledWith(42);
    });

    it('loading es false después de cargar exitosamente', () => {
      expect(component.loading).toBe(false);
      expect(component.error).toBe(false);
    });
  });

  describe('Parámetros inválidos', () => {
    it('error=true y toast.error cuando faltan parámetros de ruta', async () => {
      await buildComponent({ idExamen: undefined, idTest: undefined });
      fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
      component = fixture.componentInstance;
      toastrMock = (component as any).toastr;
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 50));

      expect(component.error).toBe(true);
      expect(component.loading).toBe(false);
      expect(toastrMock.error).toHaveBeenCalled();
    });

    it('error=true cuando getTestById falla', async () => {
      await buildComponent({ idExamen: '5', idTest: '42' });
      // Override to throw
      (TestBed.inject(TestService) as any).getTestById = jest.fn(() =>
        throwError(() => new Error('Not found'))
      );

      fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
      component = fixture.componentInstance;
      toastrMock = (component as any).toastr;
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 50));

      expect(component.error).toBe(true);
      expect(component.loading).toBe(false);
      expect(toastrMock.error).toHaveBeenCalled();
    });
  });

  describe('Completar simulacro', () => {
    beforeEach(async () => {
      await buildComponent({ idExamen: '5', idTest: '42' });
      fixture = TestBed.createComponent(CompletarTestSimulacroComponent);
      component = fixture.componentInstance;
      routerMock = (component as any).router;
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 50));
    });

    it('onTestCompleted() navega a la ruta de resultados con los IDs correctos', () => {
      component.onTestCompleted({});

      expect(routerMock.navigate).toHaveBeenCalledWith([
        '/simulacros/resultado',
        5,
        42,
      ]);
    });
  });
});
