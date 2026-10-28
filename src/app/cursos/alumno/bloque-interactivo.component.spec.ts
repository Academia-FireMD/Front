import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DomSanitizer, ɵDomSanitizerImpl } from '@angular/platform-browser';
import { delay, of, throwError } from 'rxjs';
import { Bloque } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import {
  ControlHidraulicaInteractivo,
  HidraulicaInteractivoService,
} from '../services/hidraulica-interactivo.service';
import { BloqueInteractivoComponent } from './bloque-interactivo.component';

describe('BloqueInteractivoComponent', () => {
  let fixture: ComponentFixture<BloqueInteractivoComponent>;
  let component: BloqueInteractivoComponent;
  let cursoService: { descargarAplicacionInteractiva: jest.Mock };
  let puente: { connect: jest.Mock };
  let control: jest.Mocked<ControlHidraulicaInteractivo>;
  let createObjectURL: jest.Mock;
  let revokeObjectURL: jest.Mock;

  beforeEach(async () => {
    cursoService = { descargarAplicacionInteractiva: jest.fn() };
    control = { destruir: jest.fn(), reintentar: jest.fn() };
    puente = { connect: jest.fn(() => control) };
    createObjectURL = jest.fn(() => 'blob:hidraulica');
    revokeObjectURL = jest.fn();
    (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL =
      createObjectURL;
    (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
      revokeObjectURL;

    await TestBed.configureTestingModule({
      imports: [BloqueInteractivoComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAlumnoService, useValue: cursoService },
        { provide: HidraulicaInteractivoService, useValue: puente },
        { provide: DomSanitizer, useClass: ɵDomSanitizerImpl },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BloqueInteractivoComponent);
    component = fixture.componentInstance;
  });

  function setBloque(extra: Partial<Bloque> = {}): void {
    fixture.componentRef.setInput('bloque', {
      id: 501,
      leccionId: 77,
      orden: 0,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'HIDRAULICA',
      ...extra,
    } as Bloque);
  }

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('preview: muestra placeholder sin descargar HTML ni conectar puente', async () => {
    setBloque();
    fixture.componentRef.setInput('preview', true);
    await render();

    expect(cursoService.descargarAplicacionInteractiva).not.toHaveBeenCalled();
    expect(puente.connect).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Vista previa');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="interactivo-preview"]',
      ),
    ).not.toBeNull();
  });

  it('carga el blob protegido, pinta el iframe y conecta el puente', async () => {
    cursoService.descargarAplicacionInteractiva.mockReturnValue(
      of(new Blob(['<html></html>'], { type: 'text/html' })),
    );
    setBloque();
    await render();

    expect(cursoService.descargarAplicacionInteractiva).toHaveBeenCalledWith(
      501,
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(puente.connect).toHaveBeenCalledTimes(1);
    expect(puente.connect.mock.calls[0][1]).toEqual({
      leccionId: 77,
      bloqueId: 501,
      aplicacionCodigo: 'HIDRAULICA',
    });
    expect(
      fixture.nativeElement.querySelector(
        'iframe[data-testid="hidraulica-iframe"]',
      ),
    ).not.toBeNull();
    expect(component.frameUrl()).toBeTruthy();
  });

  it('refleja loading/saving/saved/pending/error y altura del puente', async () => {
    cursoService.descargarAplicacionInteractiva.mockReturnValue(
      of(new Blob(['<html></html>'], { type: 'text/html' })),
    );
    setBloque();
    await render();
    const callbacks = puente.connect.mock.calls[0][2];

    callbacks.publicarEstado({ estado: 'saving', texto: 'Guardando…' });
    callbacks.publicarAltura(1300);
    fixture.detectChanges();
    expect(component.estado()).toBe('saving');
    expect(component.altura()).toBe(1300);

    callbacks.publicarEstado({ estado: 'saved', texto: 'Guardado' });
    callbacks.publicarEstado({ estado: 'pending', texto: 'Pendiente' });
    callbacks.publicarEstado({ estado: 'error', texto: 'Error' });
    fixture.detectChanges();
    expect(component.estado()).toBe('error');
    expect(component.puedeReintentar()).toBe(true);
  });

  it('reintentar() delega en el puente cuando el HTML ya está cargado', async () => {
    cursoService.descargarAplicacionInteractiva.mockReturnValue(
      of(new Blob(['<html></html>'], { type: 'text/html' })),
    );
    setBloque();
    await render();
    component.reintentar();
    expect(control.reintentar).toHaveBeenCalledTimes(1);
    expect(cursoService.descargarAplicacionInteractiva).toHaveBeenCalledTimes(
      1,
    );
  });

  it('error de descarga: muestra error y reintentar vuelve a pedir el HTML', async () => {
    cursoService.descargarAplicacionInteractiva
      .mockReturnValueOnce(throwError(() => new Error('403')).pipe(delay(0)))
      .mockReturnValueOnce(
        of(new Blob(['<html></html>'], { type: 'text/html' })),
      );
    setBloque();
    await render();

    expect(component.falloHtml()).toBe(true);
    expect(component.estado()).toBe('error');
    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo cargar la aplicación interactiva',
    );

    component.reintentar();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cursoService.descargarAplicacionInteractiva).toHaveBeenCalledTimes(
      2,
    );
    expect(puente.connect).toHaveBeenCalledTimes(1);
  });

  it('código de aplicación no permitido: no descarga ni conecta', async () => {
    setBloque({ aplicacionCodigo: 'OTRA' });
    await render();
    expect(cursoService.descargarAplicacionInteractiva).not.toHaveBeenCalled();
    expect(puente.connect).not.toHaveBeenCalled();
    expect(component.estado()).toBe('error');
  });

  it('cambiar de bloque destruye el contexto anterior y recarga el nuevo', async () => {
    cursoService.descargarAplicacionInteractiva.mockReturnValue(
      of(new Blob(['<html></html>'], { type: 'text/html' })),
    );
    setBloque();
    await render();
    const primerControl = control;
    const primerUrl = createObjectURL.mock.results[0].value;

    const segundoControl = { destruir: jest.fn(), reintentar: jest.fn() };
    puente.connect.mockReturnValueOnce(segundoControl);
    fixture.componentRef.setInput('bloque', {
      id: 502,
      leccionId: 77,
      orden: 1,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'HIDRAULICA',
    } as Bloque);
    await render();

    expect(primerControl.destruir).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith(primerUrl);
    expect(
      cursoService.descargarAplicacionInteractiva,
    ).toHaveBeenLastCalledWith(502);
    expect(puente.connect).toHaveBeenCalledTimes(2);
    expect(segundoControl.destruir).not.toHaveBeenCalled();
  });

  it('al destruir revoca el objectURL y destruye el contexto del puente', async () => {
    cursoService.descargarAplicacionInteractiva.mockReturnValue(
      of(new Blob(['<html></html>'], { type: 'text/html' })),
    );
    setBloque();
    await render();
    fixture.destroy();
    expect(control.destruir).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:hidraulica');
  });
});
