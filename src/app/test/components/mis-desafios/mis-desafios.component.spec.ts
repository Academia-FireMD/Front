import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DueloService, MiDuelo } from '../../../services/duelo.service';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-providers';
import { MisDesafiosComponent } from './mis-desafios.component';

function mockDuelo(overrides: Partial<MiDuelo> = {}): MiDuelo {
  return {
    codigo: 'BATALLA-X7K2',
    estado: 'ABIERTA',
    expiraEn: null,
    createdAt: '2026-07-16T00:00:00.000Z',
    esCreador: true,
    numeroPreguntas: 30,
    totalParticipantes: 2,
    miTestId: 99,
    miTestFinalizado: true,
    miNota: 8.5,
    ...overrides,
  };
}

describe('MisDesafiosComponent', () => {
  let serviceMock: Partial<Record<keyof DueloService, jest.Mock>>;
  let routerMock: { navigate: jest.Mock };

  // Se ejercita la LÓGICA del componente (carga, estado, navegación) sin
  // `detectChanges()`: el template usa `p-table`, cuyo ciclo de vida crashea en
  // jsdom (`DomHandler.csp`). Disparamos `ngOnInit()` a mano; no hace falta
  // renderizar el DOM para fijar el contrato de datos/navegación.
  const build = (
    misDuelos: jest.Mock = jest.fn(() => of([mockDuelo()])),
  ): MisDesafiosComponent => {
    serviceMock = { misDuelos$: misDuelos };
    routerMock = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      imports: [MisDesafiosComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DueloService, useValue: serviceMock },
        { provide: Router, useValue: routerMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    const fixture: ComponentFixture<MisDesafiosComponent> =
      TestBed.createComponent(MisDesafiosComponent);
    return fixture.componentInstance;
  };

  it('carga los duelos del alumno al iniciar', () => {
    const component = build();
    component.ngOnInit();
    expect(serviceMock.misDuelos$).toHaveBeenCalledTimes(1);
    expect(component.duelos().length).toBe(1);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(false);
  });

  it('marca error cuando la petición falla y deja la lista vacía', () => {
    const component = build(jest.fn(() => throwError(() => new Error('boom'))));
    component.ngOnInit();
    expect(component.error()).toBe(true);
    expect(component.duelos().length).toBe(0);
    expect(component.loading()).toBe(false);
  });

  it('esAbierto reconoce ambas grafías del estado', () => {
    const component = build();
    expect(component.esAbierto(mockDuelo({ estado: 'ABIERTA' }))).toBe(true);
    expect(component.esAbierto(mockDuelo({ estado: 'ABIERTO' }))).toBe(true);
    expect(component.esAbierto(mockDuelo({ estado: 'CERRADA' }))).toBe(false);
    expect(component.esAbierto(mockDuelo({ estado: 'CERRADO' }))).toBe(false);
  });

  it('verClasificacion navega al ranking del desafío', () => {
    const component = build();
    component.verClasificacion('BATALLA-X7K2');
    expect(routerMock.navigate).toHaveBeenCalledWith([
      '/app/test/alumno/duelo/ranking/BATALLA-X7K2',
    ]);
  });
});
