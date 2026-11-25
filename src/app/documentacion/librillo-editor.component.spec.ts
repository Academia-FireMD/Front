import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
    importar: jest.fn(),
    guardar: jest.fn(),
  };
  const descargarConRevision$ = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    api.editor.mockReturnValue(of({ ...edicion, referencias: [] }));
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
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ documentoId: '19' }),
              queryParamMap: params,
            },
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
    api.abrir.mockReturnValue(
      of({
        revision: edicion.revision,
        referencias: [ref, { ...ref, id: 5, estado: 'borrador' }],
        partes: [{ pagina: 3, valor: { nota: 'Anotación privada' } }],
      }),
    );
    await editor.abrirVistaPrevia();
    fixture.detectChanges();
    expect(api.abrir).toHaveBeenCalledWith(edicion);
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

  it('explica la publicación y audiencia al abrir un PDF sin acceso editorial', async () => {
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

    expect(editor.fallo()).toMatch(/publicación y la audiencia/);
    expect(editor.accionesSuspendidas()).toBe(true);
    expect(api.abrir).not.toHaveBeenCalled();
  });

  it('explica el 404 y recupera el borrador al volver a edición', async () => {
    api.abrir.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await editor.abrirVistaPrevia();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain('publicación y la audiencia');
    expect(editor.accionesSuspendidas()).toBe(true);
    editor.volverAEdicion();
    fixture.detectChanges();
    expect(editor.accionesSuspendidas()).toBe(false);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('textarea').value).toBe(
      seleccion.fragmento,
    );
    await editor.guardar('publicada');
    expect(api.guardarReferencia).not.toHaveBeenCalled();
  });

  it('un 409 mantiene la edición suspendida hasta revalidar la revisión', async () => {
    api.abrir.mockReturnValue(
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
    expect(api.editor).toHaveBeenCalledTimes(2);
    expect(editor.accionesSuspendidas()).toBe(false);
    expect(editor.seleccion()).toEqual(seleccion);
  });
});
