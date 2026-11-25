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
import { LibrilloPracticaComponent } from './librillo-practica.component';
import {
  IntentoPracticaLibrillo,
  ResumenPracticaLibrillo,
} from './librillo-practica.service';

describe('Práctica del Librillo', () => {
  const temaId = 47;
  const url = environment.apiUrl + '/librillos/temas/47/practica';
  const pdf = { doc: 145, revision: 'a'.repeat(64), pagina: 3 };
  const origen = { temaId, modo: 'practica', alcance: 'tema' } as const;
  const progreso = {
    preguntas: { total: 6, vistas: 2, acertadas: 1 },
    tarjetas: { total: 4, vistas: 3, dominadas: 2 },
  };
  const resumen: ResumenPracticaLibrillo = {
    test: 6,
    flashcards: 4,
    testPagina: 2,
    flashcardsPagina: 1,
    progreso,
    progresoPagina: progreso,
    referencias: [{ id: 8, pagina: 5, preguntaId: 81 }],
  };
  const respuestaConflicto = { status: 409, statusText: 'Conflict' };
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
    fixture.componentRef.setInput('temas', [
      { id: 49, etiqueta: 'Normativa / 6 · Prevención' },
    ]);
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

  function historial(tipo: 'test' | 'flashcards', cursor?: number) {
    return http.expectOne(
      url +
        '/historial?tipo=' +
        tipo +
        (cursor === undefined ? '' : '&cursor=' + cursor),
    );
  }

  function dialogo() {
    return document.querySelector<HTMLElement>('body [role="dialog"]');
  }

  async function abrir(
    intento: IntentoPracticaLibrillo = { id: 26, origenLibrillo: origen },
  ) {
    const inicio = panel.iniciar();
    http.expectOne(url + '/' + panel.tipo()).flush(intento);
    await inicio;
    fixture.detectChanges();
  }

  it('envía los ajustes del simulacro de página y abre su resultado aunque la nota sea nula', async () => {
    cargar();
    expect(fixture.nativeElement.textContent).toContain('2/6 vistas');
    panel.alcance.set('pagina');
    panel.modo.set('simulacro');
    panel.segundosPorPregunta.set(45);
    panel.penalizacion.set(3);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('button[type="submit"]').textContent,
    ).toContain('Hacer simulacro');

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
    expect(dialogo()?.querySelector('app-completar-test')).toBeTruthy();

    const resultado = panel.finalizar(panel.intentoActual()!, 26);
    http.expectOne((request) => request.url === url).flush(resumen);
    http.expectOne(url + '/test/26/resultado').flush({
      total: 2,
      aciertos: 1,
      fallos: 1,
      blancas: 0,
      nota: null,
    });
    await resultado;
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('Sin nota');
    expect(dialogo()?.textContent).toContain('Aciertos');
    expect(
      dialogo()?.querySelector('[aria-pressed="true"]')?.textContent,
    ).toContain('Resultado');
  });

  it('ignora los pendientes heredados del resumen y abre un conflicto coincidente con el origen guardado', async () => {
    cargar({ ...resumen, pendientes: { test: { id: 27 }, flashcards: null } });
    expect(fixture.nativeElement.textContent).not.toContain('Tienes un');
    const boton = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(boton.textContent).toContain('Hacer test');
    expect(boton.disabled).toBe(false);
    panel.modo.set('simulacro');
    panel.penalizacion.set(2);
    const origenLibrillo = { ...origen, modo: 'simulacro', penalizacion: 4 };
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate');
    const inicio = panel.iniciar();
    http.expectOne(url + '/test').flush(
      {
        codigo: 'intento_pendiente',
        id: 27,
        temas: [temaId],
        coincide: true,
        reemplazable: true,
        origenLibrillo,
      },
      respuestaConflicto,
    );
    await inicio;
    fixture.detectChanges();
    expect(dialogo()?.textContent).not.toContain('Sesión pendiente');
    expect(panel.intentoActual()).toEqual({
      id: 27,
      tipo: 'test',
      origenLibrillo,
    });
    expect(navegar).not.toHaveBeenCalled();
    http.expectNone(url + '/test');
  });

  it('repite la solicitud capturada con cada ID confirmado y permite volver a empezar tras pendiente_cambiado', async () => {
    cargar();
    panel.alcance.set('pagina');
    panel.repaso.set('fallos');
    const inicio = panel.iniciar();
    const primero = http.expectOne(url + '/test');
    const configuracion = primero.request.body;
    primero.flush(
      {
        codigo: 'intento_pendiente',
        id: 27,
        temas: [49],
        coincide: false,
        reemplazable: true,
      },
      respuestaConflicto,
    );
    await inicio;
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('Normativa / 6 · Prevención');
    expect(dialogo()?.textContent).toContain('Conservar pendiente');
    panel.modo.set('simulacro');
    panel.cantidad.set(20);
    const reemplazo = panel.confirmarReemplazo();
    const segundo = http.expectOne(url + '/test');
    expect(segundo.request.body).toEqual({
      ...configuracion,
      reemplazarPendienteId: 27,
    });
    segundo.flush(
      {
        codigo: 'intento_pendiente',
        id: 28,
        temas: [999],
        coincide: false,
        reemplazable: true,
      },
      respuestaConflicto,
    );
    await reemplazo;
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('Tema no disponible');
    expect(dialogo()?.textContent).not.toContain('Prevención');
    http.expectNone(url + '/test');

    const nuevoReemplazo = panel.confirmarReemplazo();
    const tercero = http.expectOne(url + '/test');
    expect(tercero.request.body).toEqual({
      ...configuracion,
      reemplazarPendienteId: 28,
    });
    tercero.flush({ codigo: 'pendiente_cambiado' }, respuestaConflicto);
    await nuevoReemplazo;
    fixture.detectChanges();
    expect(panel.conflictoActual()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'La sesión pendiente ha cambiado',
    );
    const reintento = panel.iniciar();
    const cuarto = http.expectOne(url + '/test');
    expect(cuarto.request.body).not.toHaveProperty('reemplazarPendienteId');
    expect(cuarto.request.body.modo).toBe('simulacro');
    cuarto.flush({
      id: 29,
      origenLibrillo: {
        ...origen,
        modo: 'simulacro',
        alcance: 'pagina',
        ...pdf,
      },
    });
    await reintento;
    expect(panel.intentoActual()?.id).toBe(29);
  });

  it('puede conservar un pendiente y los no reemplazables solo enlazan al campus', async () => {
    cargar();
    const iniciar = () => panel.iniciar();
    const pendiente = {
      codigo: 'intento_pendiente',
      id: 29,
      temas: [temaId, 49],
      coincide: false,
    };
    const primero = iniciar();
    http
      .expectOne(url + '/test')
      .flush({ ...pendiente, reemplazable: true }, respuestaConflicto);
    await primero;
    fixture.detectChanges();
    dialogo()
      ?.querySelector<HTMLButtonElement>('[data-foco-conflicto]')
      ?.click();
    fixture.detectChanges();
    expect(panel.conflictoActual()).toBeNull();
    http.expectNone(url + '/test');

    const segundo = iniciar();
    http
      .expectOne(url + '/test')
      .flush({ ...pendiente, reemplazable: false }, respuestaConflicto);
    await segundo;
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('Varios temas');
    expect(dialogo()?.textContent).not.toContain('Cancelar y empezar');
    expect(dialogo()?.querySelector('a')?.getAttribute('href')).toContain(
      '/app/test/alumno/realizar-test?',
    );
    expect(dialogo()?.querySelector('a')?.textContent).toContain(
      'Ver pendientes en el campus',
    );
    http.expectNone(url + '/test');
  });

  it('descarta el inicio de una página anterior al cambiar de selección', async () => {
    cargar();
    panel.alcance.set('pagina');
    const antiguo = panel.iniciar();
    const primero = http.expectOne(url + '/test');
    cargar(resumen, { ...pdf, pagina: 4 });
    const reciente = panel.iniciar();
    const segundo = http.expectOne(url + '/test');
    segundo.flush({
      id: 30,
      origenLibrillo: { ...origen, ...pdf, alcance: 'pagina', pagina: 4 },
    });
    await reciente;
    primero.flush({
      id: 29,
      origenLibrillo: { ...origen, alcance: 'pagina', ...pdf },
    });
    await antiguo;
    expect(panel.intentoActual()?.id).toBe(30);
  });

  it('usa las estadísticas nativas de las flashcards incluyendo las sin valorar en Para repasar', async () => {
    fixture.componentRef.setInput('testActivo', false);
    cargar(resumen, null);
    expect(fixture.nativeElement.querySelector('#alcance-practica')).toBeNull();
    expect(fixture.nativeElement.querySelector('#modo-practica')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('button[type="submit"]').textContent,
    ).toContain('Repasar flashcards');
    panel.repaso.set('dudas');
    const inicio = panel.iniciar();
    const request = http.expectOne(url + '/flashcards');
    expect(request.request.body.repaso).toBe('todo');
    request.flush({ id: 35, origenLibrillo: origen });
    await inicio;

    const resultado = panel.finalizar(panel.intentoActual()!, 35);
    http.expectOne(url).flush(resumen);
    http.expectOne(environment.apiUrl + '/flashcards/test-stats/35').flush({
      estado: { BIEN: { count: 2 }, REVISAR: { count: 3 }, MAL: { count: 1 } },
    });
    await resultado;
    fixture.detectChanges();
    const tarjetas = Array.from(dialogo()!.querySelectorAll('p-card')).map(
      (tarjeta) => [
        tarjeta.querySelector('.stats-number')?.textContent,
        tarjeta.querySelector('.stats-label')?.textContent,
      ],
    );
    expect(tarjetas).toEqual([
      ['2', 'Aprendidas'],
      ['3', 'Para repasar'],
      ['1', 'Con dificultad'],
    ]);
  });

  it('abre el historial sin crear una sesión, mantiene el progreso si falla Ver más y reintenta el cursor', async () => {
    cargar();
    panel.modo.set('simulacro');
    const carga = panel.abrirHistorial();
    const item = {
      id: 70,
      fecha: '2026-11-24T14:00:00.000Z',
      mixto: true,
      total: 2,
      aciertos: 1,
      fallos: 0,
      blancas: 1,
    };
    historial('test').flush({ items: [item], siguienteCursor: 70 });
    await carga;
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('Varios temas');
    expect(dialogo()?.textContent).toContain('2 preguntas');
    expect(dialogo()?.textContent).toContain('Ver más');
    expect(dialogo()?.textContent).toContain('2/6 vistas');

    const pagina = panel.cargarHistorial('test', 70);
    historial('test', 70).flush({}, { status: 500, statusText: 'Error' });
    await pagina;
    fixture.detectChanges();
    expect(dialogo()?.textContent).toContain('No se pudo cargar el historial');
    expect(dialogo()?.textContent).toContain('Varios temas');
    expect(dialogo()?.textContent).toContain('2/6 vistas');

    const reintento = panel.cargarHistorial('test', 70);
    historial('test', 70).flush({
      items: [{ ...item, id: 65, mixto: false }],
      siguienteCursor: null,
    });
    await reintento;
    fixture.detectChanges();
    expect(dialogo()?.querySelectorAll('li')).toHaveLength(2);
    expect(dialogo()?.textContent).not.toContain('Ver más');
    expect(panel.modo()).toBe('simulacro');
    http.expectNone(url + '/test');
  });

  it('muestra el filtro elegido al llegar después una respuesta anterior del historial', async () => {
    cargar();
    const primera = panel.abrirHistorial();
    const anterior = historial('test');
    const segunda = panel.cambiarFiltro('flashcards');
    historial('flashcards').flush({ items: [], siguienteCursor: null });
    await segunda;
    anterior.flush({ items: [], siguienteCursor: 70 });
    await primera;
    fixture.detectChanges();
    expect(
      dialogo()?.querySelector('[aria-pressed="true"]')?.textContent,
    ).toContain('Flashcards');
    expect(dialogo()?.textContent).toContain('Aún no hay sesiones finalizadas');
    expect(dialogo()?.textContent).not.toContain('Ver más');
  });

  it('suspende solo al navegar a una referencia del PDF actual y recupera el mismo intento', async () => {
    cargar();
    await abrir();
    const salto = jest.fn();
    panel.verEnTexto.subscribe(salto);
    panel.abrirReferencia({ id: 91, pagina: 7, preguntaId: 81 });
    expect(salto).not.toHaveBeenCalled();
    expect(panel.dialogoVisible()).toBe(true);

    panel.abrirReferencia(panel.referencias()[0]);
    expect(salto).toHaveBeenCalledWith({ ...pdf, pagina: 5, referencia: 8 });
    expect(panel.regreso()).toBe('Volver al test');
    expect(panel.dialogoVisible()).toBe(false);
    panel.volverAlIntento();
    expect(panel.dialogoVisible()).toBe(true);
    expect(panel.intentoActual()?.id).toBe(26);
    http.expectNone(url + '/test');
  });
});
