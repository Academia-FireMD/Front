import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { CursoSlugResponse } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CursoDetailPageComponent } from './curso-detail-page.component';

/**
 * Cobertura HIGH-4 (codex review):
 *  - `previewData` solo activa el bypass cuando `previewMode=true`.
 *  - Sin `previewMode`, el componente hace fetch HTTP (AccesoCurso check).
 */
describe('CursoDetailPageComponent (HIGH-4 preview guard)', () => {
  let fixture: ComponentFixture<CursoDetailPageComponent>;
  let component: CursoDetailPageComponent;
  let serviceMock: { getCurso: jest.Mock };

  const PREVIEW: CursoSlugResponse = {
    curso: {
      id: 0,
      titulo: 'Borrador admin',
      slug: 'preview',
      estado: 'BORRADOR',
      secciones: [],
    },
    tieneAcceso: true,
  };

  beforeEach(async () => {
    serviceMock = { getCurso: jest.fn().mockReturnValue(of(PREVIEW)) };
    await TestBed.configureTestingModule({
      imports: [CursoDetailPageComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: serviceMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(CursoDetailPageComponent);
    component = fixture.componentInstance;
  });

  it('previewMode=true + previewData → NO fetch HTTP, usa previewData', () => {
    fixture.componentRef.setInput('previewMode', true);
    fixture.componentRef.setInput('previewData', PREVIEW);
    fixture.detectChanges();
    expect(serviceMock.getCurso).not.toHaveBeenCalled();
    expect(component.isPreview()).toBe(true);
    expect(component.cursoData()).toEqual(PREVIEW);
  });

  it('Solo previewData sin previewMode=true → HTTP fetch normal (no bypass)', () => {
    // HIGH-4: si un consumer accidental olvida previewMode, NO debe activar
    // el bypass de AccesoCurso. Debe correr la ruta HTTP normal.
    fixture.componentRef.setInput('previewData', PREVIEW);
    // previewMode queda en su default (false)
    fixture.detectChanges();
    expect(serviceMock.getCurso).toHaveBeenCalled();
    expect(component.isPreview()).toBe(false);
  });

  it('Sin previewData ni previewMode → fetch HTTP normal', () => {
    fixture.detectChanges();
    expect(serviceMock.getCurso).toHaveBeenCalled();
    expect(component.isPreview()).toBe(false);
  });
});
