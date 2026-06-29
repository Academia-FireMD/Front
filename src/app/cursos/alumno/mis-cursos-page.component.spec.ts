import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { MisCursosPageComponent } from './mis-cursos-page.component';

/**
 * CQ1 (2026-06-29): `MisCursosPageComponent` se reutiliza parametrizado por
 * `route.data.tipo` para servir tanto "Mis cursos" como "Clases grabadas". Estos
 * tests fijan el contrato de la parametrización: fuente de datos, copy y CTA.
 */
describe('MisCursosPageComponent (parametrizado tipo)', () => {
  let serviceMock: Partial<Record<keyof CursosAlumnoService, jest.Mock>>;

  const setup = (tipo: 'cursos' | 'clases-grabadas' | undefined) => {
    serviceMock = {
      listMisCursos: jest.fn().mockReturnValue(of([])),
      listClasesGrabadas: jest.fn().mockReturnValue(of([])),
    };

    TestBed.configureTestingModule({
      imports: [MisCursosPageComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: serviceMock },
        // Se provee DESPUÉS de COMMON_TEST_PROVIDERS para ganar la resolución
        // de DI y poder inyectar el `tipo` por `snapshot.data`.
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: tipo ? { tipo } : {}, params: {} },
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    const fixture: ComponentFixture<MisCursosPageComponent> =
      TestBed.createComponent(MisCursosPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('modo "clases-grabadas": llama listClasesGrabadas (no listMisCursos)', () => {
    setup('clases-grabadas');
    expect(serviceMock.listClasesGrabadas).toHaveBeenCalledTimes(1);
    expect(serviceMock.listMisCursos).not.toHaveBeenCalled();
  });

  it('modo "clases-grabadas": título "Clases grabadas" en el header', () => {
    const fixture = setup('clases-grabadas');
    expect(fixture.componentInstance.esClasesGrabadas()).toBe(true);
    expect(fixture.componentInstance.pageTitle()).toBe('Clases grabadas');
    const h1: HTMLElement | null =
      fixture.nativeElement.querySelector('.page-header h1');
    expect(h1?.textContent?.trim()).toBe('Clases grabadas');
  });

  it('modo "clases-grabadas": empty-state NO enlaza al catálogo', () => {
    const fixture = setup('clases-grabadas');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // El empty-state de clases grabadas usa copy neutro y no ofrece catálogo
    // (las clases grabadas no se compran).
    expect(text).not.toContain('Explorar catálogo');
    expect(text).not.toContain('Ver catálogo');
    expect(text).toContain('No hay clases grabadas');
  });

  it('modo "cursos" (default): llama listMisCursos y muestra "Mis Cursos"', () => {
    const fixture = setup('cursos');
    expect(serviceMock.listMisCursos).toHaveBeenCalledTimes(1);
    expect(serviceMock.listClasesGrabadas).not.toHaveBeenCalled();
    expect(fixture.componentInstance.esClasesGrabadas()).toBe(false);
    expect(fixture.componentInstance.pageTitle()).toBe('Mis Cursos');
  });

  it('sin "tipo" en la ruta: default a modo "cursos"', () => {
    const fixture = setup(undefined);
    expect(serviceMock.listMisCursos).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.tipo()).toBe('cursos');
  });
});
