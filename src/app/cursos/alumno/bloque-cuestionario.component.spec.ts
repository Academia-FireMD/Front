import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { environment } from '../../../environments/environment';
import { Bloque } from '../models/curso.model';
import { BloqueCuestionarioComponent } from './bloque-cuestionario.component';

function bloqueCuest(): Bloque {
  return {
    id: 30,
    leccionId: 1,
    orden: 0,
    tipo: 'CUESTIONARIO',
    bloquePreguntas: [
      { id: 1, bloqueId: 30, orden: 0, enunciado: 'Q1', opciones: ['a', 'b'] },
      {
        id: 2,
        bloqueId: 30,
        orden: 1,
        enunciado: 'Q2',
        opciones: ['x', 'y', 'z'],
      },
    ],
  };
}

describe('BloqueCuestionarioComponent', () => {
  let fixture: ComponentFixture<BloqueCuestionarioComponent>;
  let component: BloqueCuestionarioComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BloqueCuestionarioComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BloqueCuestionarioComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('bloque', bloqueCuest());
  });

  afterEach(() => httpMock.verify());

  it('renderiza las preguntas y opciones', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Q1');
    expect(text).toContain('Q2');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="cuest-q"]').length,
    ).toBe(2);
  });

  it('todasRespondidas es false hasta seleccionar todas', () => {
    fixture.detectChanges();
    expect(component.todasRespondidas()).toBe(false);
    component.seleccionar(1, 0);
    expect(component.todasRespondidas()).toBe(false);
    component.seleccionar(2, 1);
    expect(component.todasRespondidas()).toBe(true);
  });

  it('corregir POST con las respuestas y guarda el resultado', async () => {
    fixture.detectChanges();
    component.seleccionar(1, 0);
    component.seleccionar(2, 2);
    const promise = component.corregir();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/bloques/30/cuestionario/corregir`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      respuestas: [
        { preguntaId: 1, opcionElegida: 0 },
        { preguntaId: 2, opcionElegida: 2 },
      ],
    });
    req.flush({
      aciertos: 2,
      total: 2,
      resultados: [
        {
          preguntaId: 1,
          opcionElegida: 0,
          correcta: true,
          respuestaCorrecta: 0,
          explicacion: null,
        },
        {
          preguntaId: 2,
          opcionElegida: 2,
          correcta: true,
          respuestaCorrecta: 2,
          explicacion: 'ok',
        },
      ],
    });
    await promise;
    expect(component.corregido()).toBe(true);
    expect(component.resultado()?.aciertos).toBe(2);
  });

  it('corregir con éxito emite (completado)', async () => {
    fixture.detectChanges();
    component.seleccionar(1, 0);
    component.seleccionar(2, 0);
    const emit = jest.fn();
    component.completado.subscribe(emit);
    const promise = component.corregir();
    httpMock
      .expectOne(`${environment.apiUrl}/bloques/30/cuestionario/corregir`)
      .flush({ aciertos: 1, total: 2, resultados: [] });
    await promise;
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('corregir sin responder todas → warning, NO llama al backend', async () => {
    fixture.detectChanges();
    component.seleccionar(1, 0); // falta la 2
    await component.corregir();
    httpMock.expectNone(
      `${environment.apiUrl}/bloques/30/cuestionario/corregir`,
    );
    expect(component.corregido()).toBe(false);
  });

  it('claseOpcion marca correcta/fallada tras corregir', () => {
    fixture.detectChanges();
    component.resultado.set({
      aciertos: 0,
      total: 1,
      resultados: [
        {
          preguntaId: 1,
          opcionElegida: 1,
          correcta: false,
          respuestaCorrecta: 0,
          explicacion: null,
        },
      ],
    });
    expect(component.claseOpcion(1, 0)).toBe('opcion--correcta');
    expect(component.claseOpcion(1, 1)).toBe('opcion--fallada');
    expect(component.claseOpcion(1, 0)).not.toBe('opcion--fallada');
  });

  it('reintentar limpia resultado y selecciones', () => {
    fixture.detectChanges();
    component.seleccionar(1, 0);
    component.resultado.set({ aciertos: 1, total: 2, resultados: [] });
    component.reintentar();
    expect(component.resultado()).toBeNull();
    expect(component.selecciones()).toEqual({});
  });

  it('en preview NO llama al backend', async () => {
    fixture.componentRef.setInput('preview', true);
    fixture.detectChanges();
    component.seleccionar(1, 0);
    component.seleccionar(2, 0);
    await component.corregir();
    httpMock.expectNone(
      `${environment.apiUrl}/bloques/30/cuestionario/corregir`,
    );
  });
});
