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

  // ---- Slug automático (2026-07-03): el backend genera el slug server-side
  // desde `titulo`; el front ya no lo manda en la creación y solo muestra un
  // preview cosmético mientras el admin escribe. ----

  it('crear un curso NO manda slug en el payload a create()', async () => {
    component.metadataForm.patchValue({ titulo: 'Curso Nuevo' });
    serviceMock.create!.mockReturnValue(
      of(
        buildCursoFixture({
          id: 5,
          titulo: 'Curso Nuevo',
          slug: 'curso-nuevo',
        }),
      ),
    );
    await component.saveMetadata();
    expect(serviceMock.create).toHaveBeenCalled();
    const payload = serviceMock.create!.mock.calls[0][0];
    expect(payload).not.toHaveProperty('slug');
    expect(payload.titulo).toBe('Curso Nuevo');
  });

  it('el preview del slug se actualiza reactivamente cuando cambia el título', () => {
    // Nota: `slugPreview` es un `computed()` sobre `toSignal(titulo.valueChanges)`,
    // se recalcula al leerlo sin necesitar `fixture.detectChanges()` (que en
    // este spec crashea por un problema preexistente de ConfirmDialog no
    // relacionado con esta feature — ningún test de este fichero lo usa).
    component.metadataForm.controls.titulo.setValue('Título de Prueba');
    expect(component.slugPreview()).toBe('titulo-de-prueba');

    component.metadataForm.controls.titulo.setValue('Otro Título 2');
    expect(component.slugPreview()).toBe('otro-titulo-2');
  });

  it('en modo edición, el control de slug sigue mostrando el valor persistido (no lo pisa el preview)', async () => {
    component.cursoId.set(1);
    await component.loadCurso(1);
    expect(component.esNuevo()).toBe(false);
    expect(component.metadataForm.controls.slug.value).toBe('curso-x');
    // Cambiar el título en edición NO debe sobrescribir el slug persistido:
    // el effect de sync del preview solo actúa cuando esNuevo().
    component.metadataForm.controls.titulo.setValue('Nuevo título editado');
    expect(component.metadataForm.controls.slug.value).toBe('curso-x');
  });

  it('previsualizar() abre el curso real del alumno en una pestaña nueva', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    component.curso.set(buildCursoFixture());
    const slug = component.curso()!.slug;
    component.previsualizar();
    expect(openSpy).toHaveBeenCalledWith(`/app/cursos/${slug}`, '_blank');
    openSpy.mockRestore();
  });

  it('previsualizar() no hace nada si el curso aún no tiene slug', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    component.curso.set(null);
    component.previsualizar();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
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

  // ---- Presentación APLICACION (2026-10-28) ----

  const cursoConLecciones = (): CursoDetail =>
    buildCursoFixture({
      secciones: [
        {
          id: 10,
          cursoId: 1,
          titulo: 'Aplicación',
          orden: 0,
          lecciones: [
            {
              id: 95,
              seccionId: 10,
              titulo: 'Práctica',
              orden: 0,
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
            },
            {
              id: 96,
              seccionId: 10,
              titulo: 'Mixta',
              orden: 1,
              tipo: 'TEXTO',
              bloques: [
                {
                  id: 103,
                  leccionId: 96,
                  orden: 0,
                  tipo: 'TEXTO',
                  contenidoMarkdown: 'no elegible',
                },
                {
                  id: 104,
                  leccionId: 96,
                  orden: 1,
                  tipo: 'INTERACTIVO',
                  aplicacionCodigo: 'HIDRAULICA',
                },
              ],
            },
          ],
        },
      ],
    });

  it('leccionesElegibles solo incluye lecciones guardadas con pila INTERACTIVO homogénea', () => {
    component.curso.set(cursoConLecciones());
    expect(component.leccionesElegibles()).toEqual([
      { label: 'Aplicación · Práctica', value: 95 },
    ]);
  });

  it('cambiar a ESTANDAR limpia la entrada; APLICACION conserva la elegible', () => {
    component.curso.set(cursoConLecciones());
    component.metadataForm.patchValue({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
    });
    component.onModoPresentacionChange('APLICACION');
    expect(component.metadataForm.controls.leccionAplicacionId.value).toBe(95);
    component.onModoPresentacionChange('ESTANDAR');
    expect(
      component.metadataForm.controls.leccionAplicacionId.value,
    ).toBeNull();
  });

  it('APLICACION sin entrada no puede publicar (borrador sí guarda incompleto)', async () => {
    component.cursoId.set(1);
    component.curso.set(cursoConLecciones());
    component.metadataForm.patchValue({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: null,
      titulo: 'Curso X',
      slug: 'curso-x',
    });
    expect(component.puedePublicar()).toBe(false);
    serviceMock.update!.mockReturnValue(
      of(
        buildCursoFixture({
          modoPresentacion: 'APLICACION',
          leccionAplicacionId: null,
        }),
      ),
    );
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        modoPresentacion: 'APLICACION',
        leccionAplicacionId: null,
      }),
    );
    expect(component.puedePublicar()).toBe(false);
    expect(component.motivoPublicacionBloqueada()).toContain(
      'Selecciona una lección de aplicación válida',
    );
  });

  it('APLICACION con entrada elegible NO publica antes de guardar; tras guardar limpio sí', async () => {
    component.cursoId.set(1);
    component.curso.set(cursoConLecciones());
    component.metadataForm.patchValue({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
      titulo: 'Curso X',
      slug: 'curso-x',
    });
    component.metadataForm.markAsDirty();
    expect(component.puedePublicar()).toBe(false);
    expect(component.motivoPublicacionBloqueada()).toContain(
      'Guarda los cambios antes de publicar',
    );
    serviceMock.update!.mockReturnValue(
      of({
        id: 1,
        titulo: 'Curso X',
        slug: 'curso-x',
        estado: 'BORRADOR',
        updatedAt: '2026-05-25T13:00:00.000Z',
        modoPresentacion: 'APLICACION',
        leccionAplicacionId: 95,
      }),
    );
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        modoPresentacion: 'APLICACION',
        leccionAplicacionId: 95,
        updatedAt: '2026-05-25T12:00:00.000Z',
      }),
    );
    expect(component.metadataForm.dirty).toBe(false);
    expect(component.puedePublicar()).toBe(true);
    await component.publicar();
    expect(serviceMock.publicar).toHaveBeenCalledWith(1);
  });

  it('persistedESTANDAR + local APLICACION/entrada: Publicar bloqueado y no llama al backend', async () => {
    component.cursoId.set(1);
    component.curso.set(cursoConLecciones());
    component.metadataForm.patchValue({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
      titulo: 'Curso X',
      slug: 'curso-x',
    });
    component.metadataForm.markAsDirty();
    expect(component.curso()!.modoPresentacion).toBeUndefined();
    expect(component.puedePublicar()).toBe(false);
    expect(component.motivoPublicacionBloqueada()).toBe(
      'Guarda los cambios antes de publicar.',
    );
    await component.publicar();
    expect(serviceMock.publicar).not.toHaveBeenCalled();
  });

  it('persistedAPLICACION sin entrada + entrada local elegible: bloqueado hasta guardar', async () => {
    component.cursoId.set(1);
    component.curso.set(
      buildCursoFixture({
        modoPresentacion: 'APLICACION',
        leccionAplicacionId: null,
        secciones: cursoConLecciones().secciones,
      }),
    );
    component.metadataForm.patchValue({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
      titulo: 'Curso X',
      slug: 'curso-x',
    });
    component.metadataForm.markAsDirty();
    expect(component.puedePublicar()).toBe(false);
    expect(component.motivoPublicacionBloqueada()).toBe(
      'Guarda los cambios antes de publicar.',
    );
    await component.publicar();
    expect(serviceMock.publicar).not.toHaveBeenCalled();
  });

  it('dirty solo por título: guarda reactiva impide publicar', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture());
    component.metadataForm.patchValue({
      titulo: 'Título cambiado',
      slug: 'curso-x',
    });
    component.metadataForm.markAsDirty();
    expect(component.puedePublicar()).toBe(false);
    expect(component.motivoPublicacionBloqueada()).toBe(
      'Guarda los cambios antes de publicar.',
    );
    await component.publicar();
    expect(serviceMock.publicar).not.toHaveBeenCalled();
  });

  it('guardado fallido conserva dirty y no permite publicar', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture());
    component.metadataForm.patchValue({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
      titulo: 'Curso X',
      slug: 'curso-x',
    });
    component.metadataForm.markAsDirty();
    serviceMock.update!.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 500, error: { message: 'boom' } }),
      ),
    );
    await component.saveMetadata();
    expect(component.metadataForm.dirty).toBe(true);
    expect(component.puedePublicar()).toBe(false);
    await component.publicar();
    expect(serviceMock.publicar).not.toHaveBeenCalled();
  });

  it('ESTANDAR envía entrada null explícita y queda publicable tras guardar', async () => {
    component.cursoId.set(1);
    component.curso.set(
      buildCursoFixture({
        modoPresentacion: 'APLICACION',
        leccionAplicacionId: 95,
      }),
    );
    component.metadataForm.patchValue({
      modoPresentacion: 'ESTANDAR',
      leccionAplicacionId: null,
      titulo: 'Curso X',
      slug: 'curso-x',
    });
    serviceMock.update!.mockReturnValue(of(buildCursoFixture()));
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        modoPresentacion: 'ESTANDAR',
        leccionAplicacionId: null,
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

  // ---- Clase grabada (2026-06-29) ----

  it('saveMetadata persiste esClaseGrabada=true y desvincula wooProductId', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture());
    component.metadataForm.patchValue({
      titulo: 'Clase Continua',
      slug: 'curso-x',
      wooProductId: 99,
      // p-inputSwitch escribe el control ANTES de emitir (onChange); lo
      // replicamos aquí para reflejar el runtime real.
      esClaseGrabada: true,
    });
    component.onEsClaseGrabadaChange(true);
    serviceMock.update!.mockReturnValue(
      of({
        id: 1,
        titulo: 'Clase Continua',
        slug: 'curso-x',
        estado: 'BORRADOR',
        esClaseGrabada: true,
        updatedAt: '2026-06-29T13:00:00.000Z',
      }),
    );
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        esClaseGrabada: true,
        // Clase grabada no se vende → sin producto WC.
        wooProductId: null,
      }),
    );
  });

  // ---- Task C4 (feedback Raúl 2026-07-24): fechaPublicacion editable ----

  it('saveMetadata incluye fechaPublicacion en ISO cuando es clase grabada y hay fecha', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture({ esClaseGrabada: true }));
    component.metadataForm.patchValue({
      titulo: 'Clase Continua',
      slug: 'curso-x',
      esClaseGrabada: true,
      fechaPublicacion: new Date('2026-06-01T00:00:00.000Z'),
    });
    component.onEsClaseGrabadaChange(true);
    serviceMock.update!.mockReturnValue(
      of(buildCursoFixture({ esClaseGrabada: true })),
    );
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        fechaPublicacion: '2026-06-01T00:00:00.000Z',
      }),
    );
  });

  it('saveMetadata clase grabada con calendario vacío → fechaPublicacion=null (borra)', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture({ esClaseGrabada: true }));
    component.metadataForm.patchValue({
      titulo: 'Clase Continua',
      slug: 'curso-x',
      esClaseGrabada: true,
      fechaPublicacion: null,
    });
    component.onEsClaseGrabadaChange(true);
    serviceMock.update!.mockReturnValue(
      of(buildCursoFixture({ esClaseGrabada: true })),
    );
    await component.saveMetadata();
    expect(serviceMock.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ fechaPublicacion: null }),
    );
  });

  it('saveMetadata NO manda fechaPublicacion cuando el curso no es clase grabada', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture());
    component.metadataForm.patchValue({
      titulo: 'Curso Normal',
      slug: 'curso-x',
      fechaPublicacion: new Date('2026-06-01T00:00:00.000Z'),
    });
    serviceMock.update!.mockReturnValue(of(buildCursoFixture()));
    await component.saveMetadata();
    const payload = serviceMock.update!.mock.calls[0][1];
    expect(payload).not.toHaveProperty('fechaPublicacion');
  });

  it('loadCurso hidrata fechaPublicacion como Date en el form', async () => {
    serviceMock.getCurso!.mockReturnValue(
      of(
        buildCursoFixture({
          esClaseGrabada: true,
          fechaPublicacion: '2026-06-01T00:00:00.000Z',
        }),
      ),
    );
    await component.loadCurso(1);
    expect(component.metadataForm.controls.fechaPublicacion.value).toEqual(
      new Date('2026-06-01T00:00:00.000Z'),
    );
  });

  it('onEsClaseGrabadaChange(true) oculta el picker de producto WC', () => {
    expect(component.mostrarWcPicker()).toBe(true);
    component.onEsClaseGrabadaChange(true);
    expect(component.mostrarWcPicker()).toBe(false);
    expect(component.metadataForm.controls.wooProductId.value).toBeNull();
  });

  it('hint informativo: clase grabada con relevancia=[] muestra aviso (visible para todos los suscritos)', () => {
    component.updateRelevancia([]);
    component.onEsClaseGrabadaChange(true);
    // relevancia=[] = GENERAL: el hint ahora informa de visibilidad universal,
    // no de que "nadie la verá" (esa semántica quedó unificada en OposicionFilterService)
    expect(component.hintClaseGrabadaSinOposicion()).toBe(true);
  });

  it('loadCurso hidrata esClaseGrabada desde el backend', async () => {
    serviceMock.getCurso!.mockReturnValue(
      of(
        buildCursoFixture({
          esClaseGrabada: true,
          updatedAt: '2026-06-29T10:00:00.000Z',
        }),
      ),
    );
    await component.loadCurso(1);
    expect(component.esClaseGrabadaSig()).toBe(true);
    expect(component.metadataForm.controls.esClaseGrabada.value).toBe(true);
  });

  it('publicar/archivar/despublicar disparan los métodos del service', async () => {
    component.cursoId.set(1);
    component.curso.set(buildCursoFixture({ id: 1, titulo: 'X', slug: 'x' }));
    component.metadataForm.patchValue({ titulo: 'Curso X', slug: 'x' });
    component.metadataForm.markAsPristine();
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
