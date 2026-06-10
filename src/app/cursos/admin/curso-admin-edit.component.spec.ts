import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { CursoDetail } from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { CursoAdminEditComponent } from './curso-admin-edit.component';

describe('CursoAdminEditComponent', () => {
  let fixture: ComponentFixture<CursoAdminEditComponent>;
  let component: CursoAdminEditComponent;
  let serviceMock: Partial<Record<keyof CursosAdminService, jest.Mock>>;

  // HIGH-3 (codex review): factory tipada para fixtures de Curso. Reemplaza
  // los `as any` previos que escondían drift de DTO. Si el shape de
  // CursoDetail cambia, este factory marca compile-time errors en cada
  // sitio donde lo usamos.
  const buildCursoFixture = (
    overrides: Partial<CursoDetail> = {},
  ): CursoDetail => ({
    id: 1,
    titulo: 'Curso X',
    slug: 'curso-x',
    estado: 'BORRADOR',
    updatedAt: '2026-05-25T12:00:00.000Z',
    secciones: [],
    ...overrides,
  });

  beforeEach(async () => {
    serviceMock = {
      getCurso: jest.fn().mockReturnValue(
        of({
          id: 1,
          titulo: 'Curso X',
          slug: 'curso-x',
          estado: 'BORRADOR',
          updatedAt: '2026-05-25T12:00:00.000Z',
          secciones: [],
        }),
      ),
      update: jest.fn(),
      create: jest.fn(),
      publicar: jest.fn().mockReturnValue(of({ estado: 'PUBLICADO' })),
      archivar: jest.fn().mockReturnValue(of({ estado: 'ARCHIVADO' })),
      despublicar: jest.fn().mockReturnValue(of({ estado: 'BORRADOR' })),
      getWooProductsCursos: jest.fn().mockReturnValue(of([])),
      reorderSecciones: jest.fn().mockReturnValue(of({ ok: true })),
      reorderLecciones: jest.fn().mockReturnValue(of({ ok: true })),
    };

    await TestBed.configureTestingModule({
      imports: [CursoAdminEditComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        ConfirmationService,
        { provide: CursosAdminService, useValue: serviceMock },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(CursoAdminEditComponent);
    component = fixture.componentInstance;
    // Reset Toast/Router spies entre tests (provienen del COMMON_TEST_PROVIDERS).
    const toast = TestBed.inject(ToastrService);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
    (toast.warning as jest.Mock).mockClear();
    (toast.info as jest.Mock).mockClear();
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('form NO incluye campo precio editable (refactor 2026-05-25)', () => {
    const controls = Object.keys(component.metadataForm.controls);
    expect(controls).not.toContain('precio');
    expect(controls).toContain('wooProductId');
  });

  it('previewMode toggleado renderiza preview (no HTTP)', () => {
    component.previewMode.set(true);
    component.curso.set(buildCursoFixture());
    expect(component.previewMode()).toBe(true);
    const preview = component.previewSlugResponse();
    expect(preview).not.toBeNull();
    expect(preview!.tieneAcceso).toBe(true);
  });

  it('saveMetadata envía updatedAt en el payload PUT (optimistic locking)', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture());
    component.metadataForm.patchValue({
      titulo: 'Curso Editado',
      slug: 'curso-x',
    });
    serviceMock.update!.mockReturnValue(
      of({
        id: 1,
        titulo: 'Curso Editado',
        slug: 'curso-x',
        estado: 'BORRADOR',
        updatedAt: '2026-05-25T13:00:00.000Z',
      }),
    );
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        updatedAt: '2026-05-25T12:00:00.000Z',
        titulo: 'Curso Editado',
      }),
    );
  });

  it('PUT 409 (stale) recarga curso + toast warning', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture());
    component.metadataForm.patchValue({ titulo: 'Editado', slug: 'curso-x' });
    const toast = TestBed.inject(ToastrService);
    serviceMock.update!.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'Curso modificado' },
          }),
      ),
    );
    await component.saveMetadata();
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Otro admin'),
    );
    expect(serviceMock.getCurso).toHaveBeenCalledWith(1);
  });

  it('onWooProductSelected sin texto previo aplica titulo sin preguntar', () => {
    // ConfirmationService está provisto a nivel componente (providers:
    // [ConfirmationService]) — accedemos al instance vía el componente.
    // El service `confirmation` es privado; accedemos vía cast estrecho en
    // lugar de `as any` para mantener compile-time safety si el campo se
    // renombra.
    const localConfirmation = (
      component as unknown as { confirmation: ConfirmationService }
    ).confirmation;
    const spy = jest.spyOn(localConfirmation, 'confirm');
    component.metadataForm.patchValue({
      titulo: '',
      descripcion: '',
      thumbnailUrl: '',
    });
    component.onWooProductSelected({
      id: 1,
      name: 'Curso del WC',
      sku: 'C1',
      price: '49.00',
      regular_price: '49.00',
      sale_price: null,
      status: 'publish',
    });
    expect(spy).not.toHaveBeenCalled();
    expect(component.metadataForm.controls.titulo.value).toBe('Curso del WC');
  });

  it('onWooProductSelected con texto previo pregunta confirmación', () => {
    // El service `confirmation` es privado; accedemos vía cast estrecho en
    // lugar de `as any` para mantener compile-time safety si el campo se
    // renombra.
    const localConfirmation = (
      component as unknown as { confirmation: ConfirmationService }
    ).confirmation;
    const spy = jest.spyOn(localConfirmation, 'confirm');
    component.metadataForm.patchValue({ titulo: 'Manual', descripcion: '' });
    component.onWooProductSelected({
      id: 1,
      name: 'WC name',
      sku: null,
      price: null,
      regular_price: null,
      sale_price: null,
      status: 'publish',
    });
    expect(spy).toHaveBeenCalled();
  });

  it('publicar/archivar/despublicar disparan los métodos del service', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture({ id: 1, titulo: 'X', slug: 'x' }));
    await component.publicar();
    expect(serviceMock.publicar).toHaveBeenCalledWith(1);
    await component.archivar();
    expect(serviceMock.archivar).toHaveBeenCalledWith(1);
    await component.despublicar();
    expect(serviceMock.despublicar).toHaveBeenCalledWith(1);
  });

  // ---- Drag & drop (CDK) ----
  // Solo se leen previousIndex/currentIndex; el resto del evento CDK no se usa.
  const dragEvent = <T>(previousIndex: number, currentIndex: number) =>
    ({ previousIndex, currentIndex }) as unknown as CdkDragDrop<T[]>;

  it('dropSeccion reordena las secciones y persiste el nuevo orden', async () => {
    component.curso.set(
      buildCursoFixture({
        secciones: [
          { id: 10, cursoId: 1, titulo: 'A', orden: 0, lecciones: [] },
          { id: 11, cursoId: 1, titulo: 'B', orden: 1, lecciones: [] },
          { id: 12, cursoId: 1, titulo: 'C', orden: 2, lecciones: [] },
        ],
      }),
    );
    await component.dropSeccion(dragEvent(0, 2)); // A al final
    const ids = component.curso()!.secciones.map((s) => s.id);
    expect(ids).toEqual([11, 12, 10]);
    expect(serviceMock.reorderSecciones).toHaveBeenCalledWith([
      { id: 11, orden: 0 },
      { id: 12, orden: 1 },
      { id: 10, orden: 2 },
    ]);
  });

  it('dropSeccion sin cambio de índice no persiste', async () => {
    component.curso.set(
      buildCursoFixture({
        secciones: [
          { id: 10, cursoId: 1, titulo: 'A', orden: 0, lecciones: [] },
        ],
      }),
    );
    await component.dropSeccion(dragEvent(0, 0));
    expect(serviceMock.reorderSecciones).not.toHaveBeenCalled();
  });

  it('dropLeccion reordena lecciones DENTRO de la sección y persiste', async () => {
    const seccion = {
      id: 10,
      cursoId: 1,
      titulo: 'A',
      orden: 0,
      lecciones: [
        {
          id: 100,
          seccionId: 10,
          titulo: 'L1',
          orden: 0,
          tipo: 'TEXTO' as const,
        },
        {
          id: 101,
          seccionId: 10,
          titulo: 'L2',
          orden: 1,
          tipo: 'VIDEO' as const,
        },
      ],
    };
    component.curso.set(buildCursoFixture({ secciones: [seccion] }));
    await component.dropLeccion(dragEvent(1, 0), seccion); // L2 al principio
    const ids = component.curso()!.secciones[0].lecciones.map((l) => l.id);
    expect(ids).toEqual([101, 100]);
    expect(serviceMock.reorderLecciones).toHaveBeenCalledWith([
      { id: 101, orden: 0 },
      { id: 100, orden: 1 },
    ]);
  });

  it('dropSeccion revierte el estado si el reorder falla', async () => {
    const secciones = [
      { id: 10, cursoId: 1, titulo: 'A', orden: 0, lecciones: [] },
      { id: 11, cursoId: 1, titulo: 'B', orden: 1, lecciones: [] },
    ];
    component.curso.set(buildCursoFixture({ secciones }));
    serviceMock.reorderSecciones!.mockReturnValue(
      throwError(() => new Error('boom')),
    );
    await component.dropSeccion(dragEvent(0, 1));
    // Tras el fallo, el orden vuelve al original.
    expect(component.curso()!.secciones.map((s) => s.id)).toEqual([10, 11]);
  });
});
