import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { Bloque } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { BloqueDocumentoComponent } from './bloque-documento.component';

describe('BloqueDocumentoComponent', () => {
  let fixture: ComponentFixture<BloqueDocumentoComponent>;
  let component: BloqueDocumentoComponent;
  let service: { descargarDocumento: jest.Mock };

  beforeEach(async () => {
    service = { descargarDocumento: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [BloqueDocumentoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: service },
        {
          provide: ToastrService,
          useValue: {
            error: jest.fn(),
            success: jest.fn(),
            warning: jest.fn(),
          },
        },
        {
          provide: DomSanitizer,
          useValue: {
            bypassSecurityTrustResourceUrl: (url: string) => url,
            sanitize: (_: unknown, v: unknown) => v,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BloqueDocumentoComponent);
    component = fixture.componentInstance;
  });

  function setBloque(b: Partial<Bloque>): void {
    fixture.componentRef.setInput('bloque', {
      id: 11,
      leccionId: 1,
      orden: 0,
      tipo: 'DOCUMENTO',
      ...b,
    } as Bloque);
  }

  it('detecta PDF por el MIME', () => {
    setBloque({ documentoMime: 'application/pdf' });
    expect(component.esPdf()).toBe(true);
    setBloque({ documentoMime: 'image/png' });
    expect(component.esPdf()).toBe(false);
  });

  it('tamaño legible', () => {
    setBloque({ documentoTamanoBytes: 1536 });
    expect(component.tamanoLegible()).toBe('1.5 KB');
    setBloque({ documentoTamanoBytes: null });
    expect(component.tamanoLegible()).toBe('');
  });

  it('descargar() pide el blob protegido al backend', async () => {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    service.descargarDocumento.mockReturnValue(of(blob));
    // jsdom no implementa createObjectURL: lo stubeamos.
    (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest
      .fn()
      .mockReturnValue('blob:fake');
    (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
      jest.fn();
    setBloque({ documentoNombre: 'x.pdf', documentoMime: 'application/pdf' });
    await component.descargar();
    expect(service.descargarDocumento).toHaveBeenCalledWith(11);
  });

  it('preview=true no descarga del backend', async () => {
    setBloque({ documentoMime: 'application/pdf' });
    fixture.componentRef.setInput('preview', true);
    await component.descargar();
    expect(service.descargarDocumento).not.toHaveBeenCalled();
  });

  it('verEnVisor() carga el blob del PDF para el visor inline', async () => {
    const blob = new Blob(['x'], { type: 'application/pdf' });
    service.descargarDocumento.mockReturnValue(of(blob));
    (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest
      .fn()
      .mockReturnValue('blob:fake');
    (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
      jest.fn();
    setBloque({ documentoMime: 'application/pdf' });
    await component.verEnVisor();
    expect(service.descargarDocumento).toHaveBeenCalledWith(11);
    expect(component.safePdfUrl()).not.toBeNull();
  });
});
