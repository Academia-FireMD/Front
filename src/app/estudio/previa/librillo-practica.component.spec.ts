import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { TestModule } from '../../test/test.module';
import { LibrilloContextoPdfService } from './librillo-contexto-pdf.service';
import { LibrilloPracticaComponent } from './librillo-practica.component';
import { ResumenPracticaLibrillo } from './librillo-practica.service';

describe('Práctica del Librillo', () => {
  const temaId = 47;
  const url = environment.apiUrl + '/librillos/temas/47/practica';
  const pdf = { doc: 145, revision: 'a'.repeat(64), pagina: 3 };
  const progreso = {
    preguntas: { total: 6, vistas: 2, acertadas: 1 },
    tarjetas: { total: 4, vistas: 3, dominadas: 2 },
  };
  const resumen: ResumenPracticaLibrillo = {
    test: 6,
    flashcards: 4,
    testPagina: 2,
    flashcardsPagina: 1,
    pendientes: { test: null, flashcards: null },
    progreso,
    progresoPagina: progreso,
    referencias: [{ id: 8, pagina: 5, preguntaId: 81 }],
  };
  let fixture: ComponentFixture<LibrilloPracticaComponent>;
  let panel: LibrilloPracticaComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibrilloPracticaComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        LibrilloContextoPdfService,
      ],
    })
      .overrideComponent(LibrilloPracticaComponent, {
        remove: { imports: [TestModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(LibrilloPracticaComponent);
    panel = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('temaId', temaId);
    fixture.componentRef.setInput('documentoId', pdf.doc);
    fixture.componentRef.setInput('testActivo', true);
    fixture.componentRef.setInput('flashcardsActivas', true);
  });

  afterEach(() => http.verify());

  function cargar(datos = resumen, contexto: typeof pdf | null = pdf) {
    fixture.componentRef.setInput('pdf', contexto);
    fixture.detectChanges();
    TestBed.flushEffects();
    const request = http.expectOne((request) => request.url === url);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual(
      contexto ? ['doc', 'revision', 'pagina'] : [],
    );
    if (contexto) {
      expect(request.request.params.get('revision')).toBe(contexto.revision);
      expect(request.request.params.get('pagina')).toBe(
        String(contexto.pagina),
      );
    }
    request.flush(datos);
    fixture.detectChanges();
  }

  it('inicia un simulacro de página y consulta su resultado y el progreso al cerrar', async () => {
    cargar();
    expect(fixture.nativeElement.textContent).toContain('2/6 vistas');
    panel.alcance.set('pagina');
    panel.modo.set('simulacro');
    panel.segundosPorPregunta.set(45);
    panel.penalizacion.set(3);
    const inicio = panel.iniciar();
    const request = http.expectOne(url + '/test');
    expect(request.request.body).toEqual({
      modo: 'simulacro',
      alcance: 'pagina',
      repaso: 'todo',
      cantidad: 2,
      segundosPorPregunta: 45,
      penalizacion: 3,
      ...pdf,
    });
    const origenLibrillo = {
      temaId,
      modo: 'simulacro',
      alcance: 'pagina',
      ...pdf,
    };
    request.flush({ id: 26, origenLibrillo });
    await inicio;
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-completar-test'),
    ).toBeTruthy();

    const resultado = panel.cargarResultado(panel.intentoActual()!);
    http.expectOne((request) => request.url === url).flush(resumen);
    http.expectOne(url + '/test/26/resultado').flush({
      total: 2,
      aciertos: 1,
      fallos: 1,
      blancas: 0,
      nota: 3.33,
    });
    await resultado;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nota 3.33 / 10');
  });

  it('tras un 409 ofrece retomar con el origen registrado sin volver a crear', async () => {
    cargar();
    const origenLibrillo = {
      temaId: 49,
      modo: 'practica',
      alcance: 'pagina',
      ...pdf,
      doc: 148,
    };
    const inicio = panel.iniciar();
    http
      .expectOne(url + '/test')
      .flush(
        { codigo: 'intento_pendiente', id: 27, origenLibrillo },
        { status: 409, statusText: 'Conflict' },
      );
    await inicio;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sesión pendiente');
    const navegar = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    await panel.retomar('test', panel.pendiente('test')!);
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParamsHandling: 'merge',
        queryParams: { tema: 49, doc: 148, pagina: 3, referencia: null },
      }),
    );
    expect(TestBed.inject(LibrilloContextoPdfService).pestana()).toBe(
      'practica',
    );
    http.expectNone(url + '/test');
  });

  it('normaliza la selección de dudas si el alumno cambia a tarjetas', async () => {
    cargar();
    panel.repaso.set('dudas');
    panel.tipoElegido.set('flashcards');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '#repaso-practica option[value="dudas"]',
      ),
    ).toBeNull();
    const inicio = panel.iniciar();
    const request = http.expectOne(url + '/flashcards');
    expect(request.request.body.repaso).toBe('todo');
    request.flush({
      id: 35,
      origenLibrillo: { temaId, modo: 'practica', alcance: 'tema' },
    });
    await inicio;
  });

  it('muestra práctica de tema y el enlace de reanudación por ruta previa sin PDF', () => {
    fixture.componentRef.setInput('testActivo', false);
    cargar(
      { ...resumen, pendientes: { test: { id: 39 }, flashcards: { id: 29 } } },
      null,
    );
    const enlace = fixture.nativeElement.querySelector('a');
    expect(enlace.getAttribute('href')).toContain(
      '/realizar-flash-cards-test/29',
    );
    expect(fixture.nativeElement.querySelector('#alcance-practica')).toBeNull();
    expect(fixture.nativeElement.querySelector('#modo-practica')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Retomar test');
  });

  it('no salta a una referencia que no aporta el resumen del PDF actual', () => {
    cargar();
    const salto = jest.fn();
    panel.verEnTexto.subscribe(salto);
    panel.abrirReferencia({ id: 91, pagina: 7, preguntaId: 81 });
    expect(salto).not.toHaveBeenCalled();

    panel.abrirReferencia(panel.referencias()[0]);
    expect(salto).toHaveBeenCalledWith({ ...pdf, pagina: 5, referencia: 8 });
  });
});
