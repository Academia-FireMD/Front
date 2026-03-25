import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { of, switchMap, throwError, timer } from 'rxjs';
import { TestService } from '../../../services/test.service';
import { EstadoPregunta } from '../../../shared/models/test.model';
import { COMMON_TEST_PROVIDERS, createMockRespuesta, createMockTest } from '../../../testing';
import { CompletarTestComponent } from './completar-test.component';

function buildTestServiceMock(overrides: Partial<Record<keyof TestService, jest.Mock>> = {}) {
  return {
    getTestById: jest.fn(() => of(createMockTest())),
    actualizarProgresoTest: jest.fn(() =>
      of({ ...createMockRespuesta(), pregunta: { respuestaCorrectaIndex: 0 } })
    ),
    finalizarTest: jest.fn(() => of({})),
    sendFeedback: jest.fn(() => of({})),
    ...overrides,
  };
}

describe('CompletarTestComponent — integration', () => {
  let component: CompletarTestComponent;
  let fixture: ComponentFixture<CompletarTestComponent>;
  let testServiceMock: ReturnType<typeof buildTestServiceMock>;

  beforeEach(async () => {
    testServiceMock = buildTestServiceMock();

    await TestBed.configureTestingModule({
      declarations: [CompletarTestComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: TestService, useValue: testServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CompletarTestComponent);
    component = fixture.componentInstance;
  });

  it('debería crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  describe('Carga del test', () => {
    it('carga el test por @Input testId en ngOnInit', async () => {
      component.testId = 123;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(testServiceMock.getTestById).toHaveBeenCalledWith(123);
      expect(component.lastLoadedTest).toBeDefined();
      expect(component.lastLoadedTest.preguntas).toHaveLength(3);
    });

    it('inicia en la primera pregunta (indicePregunta = 0)', async () => {
      component.testId = 123;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.indicePregunta()).toBe(0);
    });
  });

  describe('Responder preguntas', () => {
    beforeEach(fakeAsync(() => {
      component.testId = 123;
      fixture.detectChanges();
      tick(200);
    }));

    it('clickedAnswer llama a actualizarProgresoTest con los datos correctos', fakeAsync(() => {
      component.clickedAnswer(0);
      tick(200);

      expect(testServiceMock.actualizarProgresoTest).toHaveBeenCalledWith(
        expect.objectContaining({
          testId: 123,
          preguntaId: component.lastLoadedTest.preguntas[0].id,
          respuestaDada: 0,
          indicePregunta: 0,
        })
      );
    }));

    it('clickedAnswer en pregunta ya respondida NO llama al servicio de nuevo (idempotencia)', fakeAsync(() => {
      component.lastLoadedTest.respuestas = [
        createMockRespuesta({ indicePregunta: 0, estado: EstadoPregunta.RESPONDIDA, respuestaDada: 0 }),
      ];

      component.clickedAnswer(1);
      tick(200);

      expect(testServiceMock.actualizarProgresoTest).not.toHaveBeenCalled();
    }));

    it('processAnswer en modo omitir llama a actualizarProgresoTest con omitida: true', fakeAsync(() => {
      component.processAnswer(undefined, 'omitir');
      tick(200);

      expect(testServiceMock.actualizarProgresoTest).toHaveBeenCalledWith(
        expect.objectContaining({ omitida: true })
      );
    }));

    it('comunicating es false después de procesar la respuesta', async () => {
      component.clickedAnswer(0);
      await fixture.whenStable();

      expect(component.comunicating).toBe(false);
    });

    it('error de servicio: comunicating vuelve a false (no se bloquea la UI)', fakeAsync(() => {
      // mockImplementation (sync throw) keeps the error entirely within processAnswer's
      // try/catch/finally — no ZoneAwarePromise rejection, no Zone.js scheduler corruption.
      testServiceMock.actualizarProgresoTest.mockImplementation(() => {
        throw new Error('Server error');
      });

      component.clickedAnswer(0);
      // The entire processAnswer runs synchronously (throw before first await),
      // so comunicating is already false without tick().
      tick(0);

      expect(component.comunicating).toBe(false);
    }));
  });

  describe('Navegación entre preguntas', () => {
    beforeEach(fakeAsync(() => {
      component.testId = 123;
      fixture.detectChanges();
      tick(200);
    }));

    it('atras() decrementa el indicePregunta', () => {
      component.indicePregunta.set(1);
      component.atras();
      expect(component.indicePregunta()).toBe(0);
    });

    it('adelante() incrementa el indicePregunta', () => {
      component.adelante();
      expect(component.indicePregunta()).toBe(1);
    });
  });

  describe('Finalizar test', () => {
    beforeEach(fakeAsync(() => {
      component.testId = 123;
      fixture.detectChanges();
      tick(200);
    }));

    it('finalizarTest llama a testService.finalizarTest y navega a stats', async () => {
      const routerSpy = (component as any).router;

      await component.finalizarTest();

      expect(testServiceMock.finalizarTest).toHaveBeenCalledWith(123);
      expect(routerSpy.navigate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('stats-test')])
      );
    });
  });

  describe('Vista previa y modo ver respuestas', () => {
    it('en vistaPrevia=true, respuestaCorrecta() devuelve true sin answer registrado', async () => {
      component.testId = 123;
      fixture.detectChanges();
      await fixture.whenStable();
      // Set AFTER whenStable so loadRouteData() does not override it back to false
      component.vistaPrevia = true;

      const pregunta = component.lastLoadedTest.preguntas[0];
      expect(component.respuestaCorrecta(pregunta, pregunta.respuestaCorrectaIndex)).toBe(true);
    });

    it('en modoVerRespuestas=true, respuestaIncorrecta() detecta la respuesta equivocada', async () => {
      component.testId = 123;
      component.modoVerRespuestas = true;
      fixture.detectChanges();
      await fixture.whenStable();

      const pregunta = component.lastLoadedTest.preguntas[0];
      component.lastLoadedTest.respuestas = [
        createMockRespuesta({
          preguntaId: pregunta.id,
          indicePregunta: 0,
          respuestaDada: 1, // wrong (correct is 0)
          esCorrecta: false,
          estado: EstadoPregunta.RESPONDIDA,
        }),
      ];

      expect(component.respuestaIncorrecta(pregunta, 1)).toBe(true);
      expect(component.respuestaCorrecta(pregunta, pregunta.respuestaCorrectaIndex)).toBe(true);
    });
  });
});
