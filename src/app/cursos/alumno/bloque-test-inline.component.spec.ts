import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { environment } from '../../../environments/environment';
import { BloqueTestInlineComponent } from './bloque-test-inline.component';
import { TestModule } from '../../test/test.module';

// Stub de app-completar-test para no compilar TestModule en el unit test.
@Component({
  selector: 'app-completar-test',
  standalone: true,
  template: '<span data-testid="stub-completar-test"></span>',
})
class StubCompletarTestComponent {
  readonly embedded = input<boolean>();
  readonly testId = input<number | null>();
  readonly finalizado = output<{ testId: number }>();
}

describe('BloqueTestInlineComponent', () => {
  let fixture: ComponentFixture<BloqueTestInlineComponent>;
  let component: BloqueTestInlineComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BloqueTestInlineComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(BloqueTestInlineComponent, {
        remove: { imports: [TestModule] },
        add: { imports: [StubCompletarTestComponent] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(BloqueTestInlineComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('bloqueId', 7);
    fixture.componentRef.setInput('numPreguntas', 12);
  });

  afterEach(() => httpMock.verify());

  it('arranca mostrando la tarjeta "Iniciar test" (sin test embebido)', () => {
    fixture.detectChanges();
    expect(component.startedTestId()).toBeNull();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('12 preguntas');
    expect(text).toContain('Iniciar test');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="stub-completar-test"]',
      ),
    ).toBeNull();
  });

  it('iniciarTest POST /bloques/:id/iniciar-test y embebe el test al responder', async () => {
    fixture.detectChanges();
    const promise = component.iniciarTest();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/bloques/7/iniciar-test`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({ id: 99 });
    await promise;
    fixture.detectChanges();
    expect(component.startedTestId()).toBe(99);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="stub-completar-test"]',
      ),
    ).not.toBeNull();
  });

  it('422 NO_FAILED_QUESTIONS muestra aviso y NO embebe', async () => {
    fixture.detectChanges();
    const promise = component.iniciarTest();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/bloques/7/iniciar-test`,
    );
    req.flush(
      {
        message: 'No tienes fallos en este tema.',
        reason: 'NO_FAILED_QUESTIONS',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await promise;
    fixture.detectChanges();
    expect(component.startedTestId()).toBeNull();
    expect(component.noFailedQuestions()?.reason).toBe('NO_FAILED_QUESTIONS');
    expect(fixture.nativeElement.textContent).toContain('No tienes fallos');
  });

  it('onFinalizado marca completado, emite (completado) y muestra el resumen', async () => {
    fixture.detectChanges();
    const promise = component.iniciarTest();
    httpMock
      .expectOne(`${environment.apiUrl}/bloques/7/iniciar-test`)
      .flush({ id: 50 });
    await promise;
    const emit = jest.fn();
    component.completado.subscribe(emit);
    component.onFinalizado();
    fixture.detectChanges();
    expect(component.completed()).toBe(true);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="bloque-test-done"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Test completado');
  });

  it('en preview, onFinalizado NO emite (completado)', () => {
    fixture.componentRef.setInput('preview', true);
    fixture.detectChanges();
    const emit = jest.fn();
    component.completado.subscribe(emit);
    component.onFinalizado();
    expect(emit).not.toHaveBeenCalled();
  });

  it('en preview NO llama al backend', async () => {
    fixture.componentRef.setInput('preview', true);
    fixture.detectChanges();
    await component.iniciarTest();
    httpMock.expectNone(`${environment.apiUrl}/bloques/7/iniciar-test`);
    expect(component.startedTestId()).toBeNull();
  });

  it('repetir() reinicia y vuelve a pedir un test', async () => {
    fixture.detectChanges();
    const p1 = component.iniciarTest();
    httpMock
      .expectOne(`${environment.apiUrl}/bloques/7/iniciar-test`)
      .flush({ id: 50 });
    await p1;
    component.onFinalizado();
    expect(component.completed()).toBe(true);

    const p2 = component.repetir();
    const req2 = httpMock.expectOne(
      `${environment.apiUrl}/bloques/7/iniciar-test`,
    );
    req2.flush({ id: 51 });
    await p2;
    expect(component.completed()).toBe(false);
    expect(component.startedTestId()).toBe(51);
  });
});
