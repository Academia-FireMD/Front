import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  LibrilloPdfApiService,
  ReferenciaPdf,
} from '../estudio/previa/librillo-pdf-api.service';
import { PreviaLibrillosPdfComponent } from '../estudio/previa/previa-librillos-pdf.component';
import { AuthService } from '../services/auth.service';
import { COMMON_TEST_PROVIDERS } from '../testing';
import { LibrilloEditorComponent } from './librillo-editor.component';
import { DocumentosService } from './services/documentacion.service';

jest.mock('../estudio/previa/previa-librillos-pdf.component-worker', () => ({
  crearWorkerPdf: jest.fn(),
}));

describe('Vista previa en el editor del Librillo', () => {
  const edicion = { doc: 19, revision: '1'.repeat(64) };
  const seleccion = {
    pagina: 3,
    fragmento: 'Borrador de prueba',
    rectangulos: [],
  };
  let fixture: ComponentFixture<LibrilloEditorComponent>;
  let editor: LibrilloEditorComponent;
  let visor: PreviaLibrillosPdfComponent;
  const api = {
    abrir: jest.fn(),
    editor: jest.fn(),
    guardarReferencia: jest.fn(),
    sugerir: jest.fn(),
    importar: jest.fn(),
    guardar: jest.fn(),
  };
  const descargarConRevision$ = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    api.editor.mockReset().mockReturnValue(of({ ...edicion, referencias: [] }));
    const params = convertToParamMap({
      skip: '20',
      isLocked: 'false',
      pagina: '3',
      referencia: '12',
    });
    await TestBed.configureTestingModule({
      imports: [LibrilloEditorComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ documentoId: '19' }),
              queryParamMap: params,
            },
            paramMap: of(convertToParamMap({ documentoId: '19' })),
            queryParamMap: of(params),
          },
        },
        {
          provide: AuthService,
          useValue: { sessionSnapshot: () => ({ sub: '17' }) },
        },
        { provide: LibrilloPdfApiService, useValue: api },
        {
          provide: DocumentosService,
          useValue: {
            descargarConRevision$,
            getDocumentosPublicos$: () =>
              of({
                data: [
                  {
                    id: 19,
                    identificador: 'Documento',
                    temaId: 9,
                    fileName: 'tema.pdf',
                    esPublico: true,
                    isPublicado: false,
                  },
                ],
              }),
          },
        },
      ],
    })
      .overrideComponent(PreviaLibrillosPdfComponent, { set: { template: '' } })
      .compileComponents();
    jest
      .spyOn(PreviaLibrillosPdfComponent.prototype, 'ngAfterViewInit')
      .mockImplementation(() => {});
    fixture = TestBed.createComponent(LibrilloEditorComponent);
    editor = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
    visor = fixture.debugElement.query(
      By.directive(PreviaLibrillosPdfComponent),
    ).componentInstance;
    visor.edicion.set(edicion);
    visor.pagina.set(3);
    visor.edicionCargada.emit(edicion);
    await fixture.whenStable();
    visor.fragmentoEditorial.emit(seleccion);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  it('en la vista previa solo entrega referencias publicadas y conserva el visor y el formulario', async () => {
    const ref: ReferenciaPdf = {
      id: 4,
      revision: edicion.revision,
      pagina: 3,
      rectangulos: [],
      tipo: 'DATO',
      estado: 'publicada',
    };
    api.editor.mockReturnValueOnce(
      of({
        revision: edicion.revision,
        referencias: [
          ref,
          { ...ref, id: 5, estado: 'borrador' },
          { ...ref, id: 6, tipo: 'SUGERIDO' },
        ],
        partes: [{ pagina: 3, valor: { nota: 'Anotación privada' } }],
      }),
    );
    await editor.abrirVistaPrevia();
    fixture.detectChanges();
    expect(api.editor).toHaveBeenLastCalledWith(edicion, 'alumno');
    expect(api.abrir).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Vista previa privada');
    expect(fixture.nativeElement.textContent).toContain('Sin publicar');
    expect(fixture.nativeElement.textContent).toContain('Volver a edición');
    expect(visor.referencias()).toEqual([ref]);
    expect(visor.anotaciones()).toEqual({});
    expect(fixture.nativeElement.querySelector('aside')).toBeNull();

    editor.volverAEdicion();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.directive(PreviaLibrillosPdfComponent))
        .componentInstance,
    ).toBe(visor);
    expect(visor.pagina()).toBe(3);
    expect(visor.edicion()).toBe(edicion);
    expect(editor.seleccion()).toEqual(seleccion);
    expect(editor.parametrosLista).toEqual({ skip: '20', isLocked: 'false' });
    expect(descargarConRevision$).not.toHaveBeenCalled();
    expect(api.importar).not.toHaveBeenCalled();
    expect(api.guardar).not.toHaveBeenCalled();
  });

  it('explica un PDF que ya no se puede gestionar desde Documentación', async () => {
    api.editor.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { message: 'Librillo PDF no disponible' },
          }),
      ),
    );

    await editor.abrirEdicion(edicion);

    expect(editor.fallo()).toMatch(
      /disponible para edición desde Documentación/,
    );
    expect(editor.accionesSuspendidas()).toBe(true);
    expect(api.abrir).not.toHaveBeenCalled();
  });

  it('explica el 404 y recupera el borrador al volver a edición', async () => {
    api.editor.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await editor.abrirVistaPrevia();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain('disponible para edición desde Documentación');
    expect(editor.accionesSuspendidas()).toBe(true);
    editor.volverAEdicion();
    fixture.detectChanges();
    expect(editor.accionesSuspendidas()).toBe(false);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('textarea').value).toBe(
      seleccion.fragmento,
    );
    expect(api.guardarReferencia).not.toHaveBeenCalled();
  });

  it('un 409 mantiene la edición suspendida hasta revalidar la revisión', async () => {
    api.editor.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await editor.abrirVistaPrevia();
    editor.volverAEdicion();
    expect(editor.accionesSuspendidas()).toBe(true);
    await editor.guardar('borrador');
    expect(api.guardarReferencia).not.toHaveBeenCalled();
    jest
      .spyOn(visor, 'abrir')
      .mockImplementation(async () => visor.edicionCargada.emit(edicion));
    await editor.recargarRevision();
    await fixture.whenStable();
    expect(api.editor).toHaveBeenCalledTimes(3);
    expect(editor.accionesSuspendidas()).toBe(false);
    expect(editor.seleccion()).toEqual(seleccion);
  });

  it('protege el texto y área al sustituir una selección y solo continúa si guarda el borrador', async () => {
    editor.texto.set('Texto editado');
    const nueva = { ...seleccion, pagina: 2 };
    const seguir = editor.seleccionar(nueva);
    expect(editor.confirmarCambios()).toBe(true);
    editor.resolverCambios(false);
    await seguir;
    expect(editor.seleccion()).toEqual(seleccion);
    expect(editor.texto()).toBe('Texto editado');

    api.guardarReferencia.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );
    const fallo = editor.seleccionar(nueva);
    await editor.guardarYContinuar();
    await fallo;
    expect(editor.seleccion()).toEqual(seleccion);
    expect(editor.texto()).toBe('Texto editado');

    api.guardarReferencia.mockReturnValueOnce(
      of({ ...edicion, id: 6, estado: 'borrador', tipo: 'DATO', ...seleccion }),
    );
    const guardada = editor.seleccionar(nueva);
    await editor.guardarYContinuar();
    await guardada;
    expect(api.guardarReferencia).toHaveBeenLastCalledWith(
      edicion,
      expect.objectContaining({
        estado: 'borrador',
        texto: 'Texto editado',
        pagina: 3,
      }),
    );
    expect(editor.seleccion()).toEqual(nueva);
  });

  it('solo pregunta por cambios reales en una referencia publicada y actualiza con consentimiento explícito', async () => {
    const ref: ReferenciaPdf = {
      id: 13,
      revision: edicion.revision,
      pagina: 3,
      rectangulos: [],
      tipo: 'DATO',
      estado: 'publicada',
      texto: 'Versión publicada',
    };
    const editar = editor.editar(ref);
    editor.resolverCambios(true);
    await editar;
    editor.buscar.set('filtro');
    editor.texto.set('Versión publicada ');
    expect(await editor.confirmarSalida()).toBe(true);
    expect(editor.confirmarCambios()).toBe(false);

    editor.texto.set('Cambio editorial');
    const salida = editor.confirmarSalida();
    expect(editor.confirmarSalida()).toBe(salida);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Actualizar referencia publicada');
    expect(dialog.textContent).not.toContain('Guardar borrador');
    expect(await editor.guardar('borrador')).toBe(false);
    expect(api.guardarReferencia).not.toHaveBeenCalled();

    api.guardarReferencia.mockReturnValueOnce(
      of({ ...ref, texto: 'Cambio editorial' }),
    );
    await editor.guardarYContinuar();
    expect(await salida).toBe(true);
    expect(api.guardarReferencia).toHaveBeenCalledWith(
      edicion,
      expect.objectContaining({
        id: ref.id,
        texto: 'Cambio editorial',
        estado: 'publicada',
      }),
    );
  });

  it('retiene los cambios y bloquea su guardado si el visor carga otra revisión', async () => {
    editor.texto.set('Texto de la revisión anterior');
    const nueva = { ...edicion, revision: '2'.repeat(64) };
    api.editor.mockReturnValueOnce(of({ ...nueva, referencias: [] }));
    await editor.abrirEdicion(nueva);
    expect(editor.edicionValidada()).toBe(true);
    expect(editor.formularioVigente()).toBe(false);
    expect(editor.texto()).toBe('Texto de la revisión anterior');
    expect(editor.seleccion()).toEqual(seleccion);
    expect(await editor.guardar('borrador')).toBe(false);
    expect(api.guardarReferencia).not.toHaveBeenCalled();

    const siguiente = { ...seleccion, pagina: 1 };
    const reemplazo = editor.seleccionar(siguiente);
    expect(editor.confirmarCambios()).toBe(true);
    editor.resolverCambios(true);
    await reemplazo;
    expect(editor.formularioVigente()).toBe(true);
    expect(editor.seleccion()).toEqual(siguiente);
  });

  it('una coincidencia ambigua conserva la selección y la revisión editables', async () => {
    api.sugerir.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              message: 'El fragmento coincide con varios ítems del banco',
            },
          }),
      ),
    );
    await editor.sugerir();
    expect(editor.revisionCaducada()).toBe(false);
    expect(editor.fallo()).toContain('varios ítems');
    expect(editor.seleccion()).toEqual(seleccion);
  });
});
