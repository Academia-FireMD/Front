import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  ParamMap,
  Router,
} from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import {
  CursoSlugResponse,
  Leccion,
  LeccionResponse,
} from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { AulaInmersivaService } from '../ui/aula-inmersiva.service';
import { LeccionPageComponent } from './leccion-page.component';

const APP: Leccion = {
  id: 95,
  seccionId: 1,
  titulo: 'Aplicación',
  orden: 1,
  tipo: 'TEXTO',
  bloques: [
    {
      id: 102,
      leccionId: 95,
      orden: 0,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'HIDRAULICA',
    },
  ],
};

const INTRO: Leccion = {
  id: 94,
  seccionId: 1,
  titulo: 'Introducción',
  orden: 0,
  tipo: 'TEXTO',
};

function curso(
  overrides: Partial<CursoSlugResponse['curso']> = {},
): CursoSlugResponse {
  return {
    curso: {
      id: 32,
      titulo: 'Hidráulica',
      slug: 'hidraulica',
      estado: 'PUBLICADO',
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
      secciones: [
        {
          id: 1,
          cursoId: 32,
          titulo: 'Sección',
          orden: 0,
          lecciones: [APP, INTRO],
        },
      ],
      ...overrides,
    },
    tieneAcceso: true,
    progreso: [],
  };
}

function leccionResponse(leccion: Leccion): LeccionResponse {
  return { leccion, playbackUrls: {} };
}

describe('LeccionPageComponent — carreras de carga de ruta', () => {
  let fixture: ComponentFixture<LeccionPageComponent>;
  let component: LeccionPageComponent;
  let params$: Subject<ParamMap>;
  let getLeccion: jest.Mock;
  let getCurso: jest.Mock;
  let inmersiva: { activar: jest.Mock; desactivar: jest.Mock };
  let loadedSlug: () => string | null;

  beforeEach(async () => {
    params$ = new Subject<ParamMap>();
    getLeccion = jest.fn();
    getCurso = jest.fn(() => of(curso()));
    inmersiva = { activar: jest.fn(), desactivar: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LeccionPageComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: { getLeccion, getCurso } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ slug: 'hidraulica', id: '95' }),
            },
            paramMap: params$.asObservable(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentIdentity$: of({ sub: 1, isImpersonating: false }),
          },
        },
        { provide: AulaInmersivaService, useValue: inmersiva },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LeccionPageComponent);
    component = fixture.componentInstance;
    loadedSlug = (): string | null =>
      (component as unknown as { loadedSlug: string | null }).loadedSlug;
    fixture.detectChanges();
  });

  it('APP95→intro94: la respuesta vieja APP que llega al final no pisa la intro ni reactiva inmersivo', () => {
    const oldApp$ = new Subject<LeccionResponse>();
    const newIntro$ = of(leccionResponse(INTRO));
    getLeccion.mockReturnValueOnce(oldApp$).mockReturnValueOnce(newIntro$);

    params$.next(convertToParamMap({ slug: 'hidraulica', id: '95' }));
    params$.next(convertToParamMap({ slug: 'hidraulica', id: '94' }));

    expect(component.leccionData()?.leccion.id).toBe(94);
    expect(component.loading()).toBe(false);
    expect(component.esAplicacionInmersiva()).toBe(false);
    expect(oldApp$.observed).toBe(false);

    oldApp$.next(leccionResponse(APP));
    oldApp$.complete();

    expect(component.leccionData()?.leccion.id).toBe(94);
    expect(loadedSlug()).toBe('hidraulica');
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(false);
    expect(component.esAplicacionInmersiva()).toBe(false);
    expect(inmersiva.activar).not.toHaveBeenCalled();
  });

  it('respuesta vieja con error tardío tampoco pisa ni marca error', () => {
    const oldApp$ = new Subject<LeccionResponse>();
    const newIntro$ = of(leccionResponse(INTRO));
    getLeccion.mockReturnValueOnce(oldApp$).mockReturnValueOnce(newIntro$);

    params$.next(convertToParamMap({ slug: 'hidraulica', id: '95' }));
    params$.next(convertToParamMap({ slug: 'hidraulica', id: '94' }));

    oldApp$.error(new HttpErrorResponse({ status: 500 }));

    expect(component.leccionData()?.leccion.id).toBe(94);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(false);
    expect(component.esAplicacionInmersiva()).toBe(false);
  });

  it('cross-slug: la respuesta vieja de A no pisa árbol/lección/loadedSlug de B', () => {
    const oldLeccion$ = new Subject<LeccionResponse>();
    const oldCurso$ = new Subject<CursoSlugResponse>();
    const newLeccion$ = of(
      leccionResponse({ ...INTRO, id: 194, titulo: 'Intro B' }),
    );
    getCurso.mockReturnValueOnce(oldCurso$).mockReturnValueOnce(
      of(
        curso({
          id: 99,
          slug: 'otro-curso',
          modoPresentacion: 'ESTANDAR',
          leccionAplicacionId: null,
        }),
      ),
    );
    getLeccion
      .mockReturnValueOnce(oldLeccion$)
      .mockReturnValueOnce(newLeccion$);

    params$.next(convertToParamMap({ slug: 'hidraulica', id: '95' }));
    params$.next(convertToParamMap({ slug: 'otro-curso', id: '194' }));

    expect(component.leccionData()?.leccion.id).toBe(194);
    expect(component.cursoData()?.curso.slug).toBe('otro-curso');
    expect(loadedSlug()).toBe('otro-curso');

    oldCurso$.next(curso());
    oldLeccion$.next(leccionResponse(APP));

    expect(component.leccionData()?.leccion.id).toBe(194);
    expect(component.cursoData()?.curso.slug).toBe('otro-curso');
    expect(loadedSlug()).toBe('otro-curso');
    expect(component.esAplicacionInmersiva()).toBe(false);
  });

  it('params inválidos cancelan la carga previa y no permiten que su late response pinte', () => {
    const oldApp$ = new Subject<LeccionResponse>();
    getLeccion.mockReturnValueOnce(oldApp$);

    params$.next(convertToParamMap({ slug: 'hidraulica', id: '95' }));
    params$.next(convertToParamMap({ slug: 'hidraulica', id: 'no-es-id' }));

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe(true);
    expect(oldApp$.observed).toBe(false);

    oldApp$.next(leccionResponse(APP));
    expect(component.leccionData()).toBeNull();
    expect(component.error()).toBe(true);
  });

  it('destroy cancela la carga y una respuesta tardía no escribe estado', () => {
    const oldApp$ = new Subject<LeccionResponse>();
    getLeccion.mockReturnValueOnce(oldApp$);

    params$.next(convertToParamMap({ slug: 'hidraulica', id: '95' }));
    fixture.destroy();
    oldApp$.next(leccionResponse(APP));

    expect(component.leccionData()).toBeNull();
    expect(component.error()).toBe(false);
    expect(inmersiva.desactivar).toHaveBeenCalled();
  });
});
