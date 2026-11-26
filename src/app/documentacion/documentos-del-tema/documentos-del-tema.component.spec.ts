import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { UserService } from '../../services/user.service';
import { DocumentoTemario } from '../../shared/models/documentacion.model';
import { DocumentosService } from '../services/documentacion.service';
import { DocumentosDelTemaComponent } from './documentos-del-tema.component';

describe('Documentos del tema', () => {
  let fixture: ComponentFixture<DocumentosDelTemaComponent>;
  let documento: DocumentoTemario;
  const documentos = {
    markAsSeen$: jest.fn(() => of(null)),
    downloadWithWatermark$: jest.fn(() => of(new Blob())),
  };
  const usuarios = { getCurrentUser$: jest.fn() };
  const toast = {
    warning: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [DocumentosDelTemaComponent],
      providers: [
        provideRouter([]),
        { provide: DocumentosService, useValue: documentos },
        { provide: UserService, useValue: usuarios },
        { provide: ToastrService, useValue: toast },
      ],
    });
    documento = {
      id: 145,
      identificador: 'Título del módulo',
      fileName: 'recurso.pdf',
      url: '/recurso-no-usado.pdf',
      esPublico: true,
      creadoPorId: 1,
      creadoEn: new Date(0),
      actualizadoEn: new Date(0),
      isNew: true,
      isDownloadable: true,
      librillo: { edicion: 'R07', titulo: 'Edición revisada' },
    };
    fixture = TestBed.createComponent(DocumentosDelTemaComponent);
    fixture.componentRef.setInput('temaId', 47);
    fixture.componentRef.setInput('documentos', [documento]);
    fixture.componentRef.setInput('librillosActivos', true);
  });

  it('mantiene el enlace al acordeón legacy y añade el origen solo desde Temario', () => {
    fixture.detectChanges();
    const enlace = fixture.nativeElement.querySelector(
      '#librillo-doc-145',
    ) as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toBe(
      '/app/documentacion/alumno/librillo/145?tema=47',
    );

    fixture.componentRef.setInput('modoTemario', true);
    fixture.detectChanges();
    expect(enlace.getAttribute('href')).toBe(
      '/app/documentacion/alumno/librillo/145?tema=47&desde=librillos&vista=documentos',
    );
  });

  it('solo abre PDF del tema con permiso y actualiza NEW tras el acuse', async () => {
    documento.isLocked = true;
    const word = { ...documento, id: 146, fileName: 'ficha.DOCX' };
    const bloqueado = { ...documento, id: 147, isDownloadable: false };
    fixture.componentRef.setInput('documentos', [documento, word, bloqueado]);
    fixture.componentRef.setInput('modoTemario', true);
    fixture.detectChanges();
    const accion = jest.fn();
    fixture.componentInstance.abrirPdf.subscribe(accion);
    const botones = fixture.nativeElement.querySelectorAll(
      'button[aria-label="Abrir en Librillo"], button[label="Abrir en Librillo"]',
    );
    expect(botones).toHaveLength(1);

    await fixture.componentInstance.abrir(word);
    await fixture.componentInstance.abrir(bloqueado);
    await fixture.componentInstance.abrir({ ...documento, id: 148 });
    expect(accion).not.toHaveBeenCalled();

    await fixture.componentInstance.abrir(documento);
    expect(accion).toHaveBeenCalledWith(145);
    expect(documentos.markAsSeen$).toHaveBeenCalledWith(145);
    expect(documento.isNew).toBe(false);
  });

  it('abre el PDF pulsando su título y registra la lectura; Word conserva el comportamiento anterior', async () => {
    const word = { ...documento, id: 146, fileName: 'ficha.docx' };
    fixture.componentRef.setInput('documentos', [documento, word]);
    fixture.componentRef.setInput('modoTemario', true);
    fixture.detectChanges();
    const abrir = jest.fn();
    fixture.componentInstance.abrirPdf.subscribe(abrir);
    const titulos = fixture.nativeElement.querySelectorAll('.doc-info');
    titulos[0].click();
    await fixture.whenStable();
    expect(abrir).toHaveBeenCalledWith(145);
    expect(documentos.markAsSeen$).toHaveBeenCalledWith(145);
    titulos[1].click();
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(documentos.markAsSeen$).toHaveBeenCalledWith(146);
  });

  it('descarga el blob autorizado con el nombre del tema y actualiza el acuse', async () => {
    documento.fileName = 'original.docx';
    const crear = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revocar = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const crearUrl = jest.fn(() => 'blob:temario');
    const revocarUrl = jest.fn();
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('Título del módulo.docx');
        expect(this.href).toBe('blob:temario');
      });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: crearUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revocarUrl,
    });
    try {
      await fixture.componentInstance.descargarDocumentoAlumno(documento);
      expect(documentos.markAsSeen$).toHaveBeenCalledWith(145);
      expect(documentos.downloadWithWatermark$).toHaveBeenCalledWith(145);
      expect(crearUrl).toHaveBeenCalledWith(expect.any(Blob));
      expect(click).toHaveBeenCalledTimes(1);
      expect(revocarUrl).toHaveBeenCalledWith('blob:temario');
      expect(documento.isNew).toBe(false);
    } finally {
      click.mockRestore();
      if (crear) Object.defineProperty(URL, 'createObjectURL', crear);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (revocar) Object.defineProperty(URL, 'revokeObjectURL', revocar);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('exige nombre, apellidos y DNI antes de descargar un archivo con marca', async () => {
    documento.requireWatermark = true;
    usuarios.getCurrentUser$.mockReturnValue(
      of({ nombre: 'Ana', apellidos: 'López' }),
    );
    await fixture.componentInstance.descargarDocumentoAlumno(documento);
    expect(toast.error).toHaveBeenCalled();
    expect(documentos.markAsSeen$).not.toHaveBeenCalled();
    expect(documentos.downloadWithWatermark$).not.toHaveBeenCalled();
  });
});
