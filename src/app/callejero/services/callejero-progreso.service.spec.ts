import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  CallejeroProgresoService,
  normalizarEstadoEmbed,
} from './callejero-progreso.service';

const EMPTY_VALENCIA = { asked: {}, fallos: {} };
const EMPTY_ALICANTE = {
  v: 2,
  t: 0,
  cats: {},
  hist: [],
  best: 0,
  streak: 0,
  items: {},
  fallos: {},
  superados: {},
  ciclo: {},
};

describe('CallejeroProgresoService', () => {
  let http: HttpTestingController;
  let service: CallejeroProgresoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CallejeroProgresoService);
  });

  afterEach(() => {
    http.verify();
  });

  it('usa el progreso remoto existente incluso si la caché del navegador difiere', (done) => {
    const remoto = {
      asked: { 'p|Hospital La Fe': 3 },
      fallos: {},
    };
    localStorage.setItem(
      'tf_hist_v1',
      JSON.stringify({
        asked: { 'p|Progreso de otra sesión': 99 },
        fallos: {},
      }),
    );
    const sesion = service.crearSesion(41, 'valencia');

    sesion.cargar(EMPTY_VALENCIA, true, false).subscribe((resultado) => {
      expect(resultado).toMatchObject({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 4,
        estado: remoto,
        guardado: true,
        origen: 'servidor',
      });
      expect(localStorage.getItem('tf_hist_v1')).toContain(
        'Progreso de otra sesión',
      );
      sesion.cancelar();
      done();
    });

    const req = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/valencia`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush({
      modalidad: 'valencia',
      versionFormato: 1,
      revision: 4,
      estado: remoto,
      actualizadoEn: '2026-10-24T09:00:00.000Z',
    });
  });

  it('reserva la cuenta antes de importar Alicante legado y solo lo marca tras el ack', (done) => {
    const legacy = {
      cats: { muni: { ok: 4, tot: 7 } },
      hist: [{ d: '2026-10-23 09:40', lv: 'medio', ok: 7, tot: 10, pct: 70 }],
      best: 70,
      streak: 4,
    };
    const sesion = service.crearSesion(52, 'alicante');
    let resultadoFinalizado = false;

    sesion.cargar(legacy, true, false).subscribe((resultado) => {
      resultadoFinalizado = true;
      expect(resultado.origen).toBe('importado');
      expect(resultado.guardado).toBe(true);
      expect(resultado.estado).toEqual({
        ...EMPTY_ALICANTE,
        cats: legacy.cats,
        hist: legacy.hist,
        best: 70,
        streak: 4,
      });
      expect(
        (resultado.estado['hist'] as Array<Record<string, unknown>>)[0],
      ).not.toHaveProperty('mode');
      sesion.cancelar();
      done();
    });

    const get = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/alicante`,
    );
    get.flush({
      modalidad: 'alicante',
      versionFormato: 2,
      revision: 0,
      estado: null,
      actualizadoEn: null,
    });

    const importar = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    expect(importar.request.method).toBe('POST');
    expect(importar.request.body).toEqual({
      versionFormato: 2,
      estado: {
        ...EMPTY_ALICANTE,
        cats: legacy.cats,
        hist: legacy.hist,
        best: 70,
        streak: 4,
      },
    });
    expect(resultadoFinalizado).toBe(false);
    importar.flush({
      modalidad: 'alicante',
      versionFormato: 2,
      revision: 1,
      estado: importar.request.body.estado,
      actualizadoEn: '2026-10-24T09:00:00.000Z',
      importado: true,
    });
  });

  it('reserva el legado vacío para la primera cuenta y no importa después el estado que esa cuenta guardó localmente', (done) => {
    const primera = service.crearSesion(61, 'valencia');
    primera.cargar(null, true, false).subscribe((inicial) => {
      expect(inicial.origen).toBe('nuevo');
      primera.cancelar();

      const legadoEscritoPorPrimeraCuenta = {
        asked: { 'p|Progreso privado de cuenta 61': 1 },
        fallos: {},
      };
      const segunda = service.crearSesion(62, 'valencia');
      segunda
        .cargar(legadoEscritoPorPrimeraCuenta, true, false)
        .subscribe((resultado) => {
          expect(resultado.origen).toBe('nuevo');
          expect(resultado.estado).toEqual(EMPTY_VALENCIA);
          segunda.cancelar();
          done();
        });
      http
        .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
        .flush({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: 0,
          estado: null,
          actualizadoEn: null,
        });
    });
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 0,
        estado: null,
        actualizadoEn: null,
      });
  });

  it('asigna el legado de solo lectura al primer dueño remoto sin importarlo en otra cuenta', (done) => {
    const legado = { asked: { 'p|Legado privado': 3 }, fallos: {} };
    const primera = service.crearSesion(71, 'valencia');
    primera.cargar(legado, true, false).subscribe((resultadoPrimera) => {
      expect(resultadoPrimera.origen).toBe('servidor');
      primera.cancelar();
      expect(
        localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:valencia'),
      ).toContain('"usuarioId":71');

      const segunda = service.crearSesion(72, 'valencia');
      segunda.cargar(legado, true, false).subscribe((resultadoSegunda) => {
        expect(resultadoSegunda.origen).toBe('nuevo');
        expect(resultadoSegunda.estado).toEqual(EMPTY_VALENCIA);
        segunda.cancelar();
        done();
      });
      http
        .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
        .flush({
          modalidad: 'valencia',
          versionFormato: 1,
          revision: 0,
          estado: null,
          actualizadoEn: null,
        });
    });
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 4,
        estado: { asked: { 'p|Progreso remoto': 2 }, fallos: {} },
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });
  });

  it('mantiene separadas la modalidad y la identidad al leer la caché offline', (done) => {
    expect(
      normalizarEstadoEmbed('alicante', { ...EMPTY_ALICANTE, best: 91 }),
    ).not.toBeNull();
    localStorage.setItem(
      'tf_callejero_progreso_v1:7:valencia',
      JSON.stringify({
        versionFormato: 1,
        estado: { asked: { 'p|A': 1 }, fallos: {} },
      }),
    );
    localStorage.setItem(
      'tf_callejero_progreso_v1:8:alicante',
      JSON.stringify({
        versionFormato: 2,
        estado: { ...EMPTY_ALICANTE, best: 91 },
        pendiente: false,
      }),
    );

    const sesion = service.crearSesion(8, 'alicante');
    sesion.cargar(null, true, false).subscribe({
      next: (resultado) => {
        expect(resultado).toMatchObject({
          modalidad: 'alicante',
          estado: { ...EMPTY_ALICANTE, best: 91 },
          origen: 'cache',
        });
        sesion.cancelar();
        done();
      },
      error: done.fail,
    });
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({ message: 'offline' }, { status: 503, statusText: 'Offline' });
  });

  it('rechaza JSON peligroso, formato intercambiado y estados mayores de 5 MiB', () => {
    const envenenado = JSON.parse(
      '{"asked":{"__proto__":{"polluted":true}},"fallos":{}}',
    );
    expect(normalizarEstadoEmbed('valencia', envenenado)).toBeNull();
    expect(normalizarEstadoEmbed('valencia', EMPTY_ALICANTE)).toBeNull();
    expect(
      normalizarEstadoEmbed('valencia', {
        asked: { 'p|x': 1 },
        fallos: {},
        nota: 'x'.repeat(5 * 1024 * 1024),
      }),
    ).toBeNull();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('rechaza estructuras anidadas de Alicante inválidas antes de preparar el estado', () => {
    const falloValido = {
      id: 'muni:Benidorm',
      t: 'zona',
      n: 'Benidorm',
      c: 'muni',
      ko: 1,
      ok: 0,
      f: 10,
      u: 11,
      p: '¿A qué zona pertenece?',
      r: 'Marina Baja',
    };
    const invalidos = [
      { ...EMPTY_ALICANTE, cats: { muni: null } },
      { ...EMPTY_ALICANTE, cats: { desconocida: { ok: 1, tot: 2 } } },
      { ...EMPTY_ALICANTE, cats: { muni: { ok: '1', tot: 2 } } },
      {
        ...EMPTY_ALICANTE,
        hist: [{ d: '2026-10-24', lv: 'otro', ok: 1, tot: 2, pct: 50 }],
      },
      {
        ...EMPTY_ALICANTE,
        hist: [{ d: '2026-10-24', lv: 'medio', ok: 2, tot: 1, pct: 50 }],
      },
      {
        ...EMPTY_ALICANTE,
        hist: [
          {
            d: '2026-10-24',
            lv: 'medio',
            ok: 1,
            tot: 2,
            pct: 50,
            mode: 'script',
          },
        ],
      },
      { ...EMPTY_ALICANTE, items: { 'muni:Benidorm': [1, 2, 10] } },
      { ...EMPTY_ALICANTE, items: { 'muni:Benidorm': [1, '1', 10] } },
      {
        ...EMPTY_ALICANTE,
        fallos: { 'muni:Benidorm|zona': { ...falloValido, t: 'otro' } },
      },
      {
        ...EMPTY_ALICANTE,
        fallos: { 'muni:Benidorm|zona': { ...falloValido, ok: 5 } },
      },
      {
        ...EMPTY_ALICANTE,
        superados: {
          'muni:Benidorm|zona': { ...falloValido, p: undefined, r: undefined },
        },
      },
      { ...EMPTY_ALICANTE, ciclo: { facil: 'muni:Benidorm' } },
      { ...EMPTY_ALICANTE, ciclo: { otro: ['muni:Benidorm'] } },
    ];

    for (const estado of invalidos) {
      expect(normalizarEstadoEmbed('alicante', estado)).toBeNull();
    }
  });

  it('conserva el esquema Alicante legado sin mode, ciclo parcial y textos largos válidos', () => {
    const nombreLargo = 'Benidorm '.repeat(1000);
    const clave = `muni:${nombreLargo}`;
    const fechaLarga = 'd'.repeat(5 * 1024 * 1024 - 256 * 1024);
    const estado = {
      ...EMPTY_ALICANTE,
      cats: { muni: { ok: 2, tot: 3 } },
      hist: [{ d: fechaLarga, lv: 'medio', ok: 2, tot: 3, pct: 67 }],
      items: { [clave]: [3, 2, 1234] },
      fallos: {
        [`${clave}|zona`]: {
          id: clave,
          t: 'zona',
          n: nombreLargo,
          c: 'muni',
          ko: 2,
          ok: 3,
          f: 1000,
          u: 1234,
          p: nombreLargo,
          r: 'Zona Marina Baja',
        },
      },
      ciclo: { medio: [clave] },
    };

    const normalizado = normalizarEstadoEmbed('alicante', estado);

    expect(normalizado).not.toBeNull();
    expect(
      (normalizado?.['hist'] as Array<Record<string, unknown>>)[0],
    ).toEqual({
      d: fechaLarga,
      lv: 'medio',
      ok: 2,
      tot: 3,
      pct: 67,
    });
    expect(
      (normalizado?.['fallos'] as Record<string, Record<string, unknown>>)[
        `${clave}|zona`
      ]['n'],
    ).toBe(nombreLargo);
    expect(normalizado?.['ciclo']).toEqual({ medio: [clave] });
  });

  it.each([400, 413])(
    'no prepara ni reintenta automáticamente una importación rechazada con HTTP %s',
    (status) => {
      const legado = { ...EMPTY_ALICANTE, best: 70 };
      const sesion = service.crearSesion(110, 'alicante');
      let preparado = false;
      let error: unknown;

      sesion.cargar(legado, true, false).subscribe({
        next: () => (preparado = true),
        error: (value) => (error = value),
      });
      http
        .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
        .flush({
          modalidad: 'alicante',
          versionFormato: 2,
          revision: 0,
          estado: null,
          actualizadoEn: null,
        });
      http
        .expectOne(
          `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
        )
        .flush(
          { message: 'payload too large' },
          {
            status,
            statusText: status === 413 ? 'Payload Too Large' : 'Bad Request',
          },
        );

      expect(preparado).toBe(false);
      expect(error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining(`HTTP ${status}`),
        }),
      );
      expect(
        localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:alicante'),
      ).not.toContain('importado');
      sesion.reintentar();
      http.expectNone(
        `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
      );
      sesion.cancelar();
    },
  );

  it('no reintenta una escritura PUT tras un rechazo permanente del servidor', () => {
    const sesion = service.crearSesion(112, 'valencia');
    const estados: string[] = [];
    sesion.estado$.subscribe((estado) => estados.push(estado.estado));
    sesion.cargar(null, true, false).subscribe();
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 2,
        estado: EMPTY_VALENCIA,
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });

    jest.useFakeTimers();
    sesion.guardar({ asked: { 'p|No aceptar PUT': 1 }, fallos: {} });
    jest.advanceTimersByTime(500);
    http
      .expectOne({
        method: 'PUT',
        url: `${environment.apiUrl}/callejero/mi-progreso/valencia`,
      })
      .flush(
        { message: 'invalid' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(estados.at(-1)).toBe('error');
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:112:valencia') ?? '{}',
      ),
    ).toMatchObject({ pendiente: true, accionPendiente: 'put' });
    sesion.reintentar();
    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/valencia`,
    });
    jest.useRealTimers();
    sesion.cancelar();
  });

  it('rechaza una respuesta de importación con Alicante anidado inválido sin preparar ni marcar ACK', () => {
    const legado = { ...EMPTY_ALICANTE, best: 70 };
    const sesion = service.crearSesion(111, 'alicante');
    const estados: string[] = [];
    let preparado = false;
    let error: unknown;
    sesion.estado$.subscribe((estado) => estados.push(estado.estado));
    sesion.cargar(legado, true, false).subscribe({
      next: () => (preparado = true),
      error: (value) => (error = value),
    });
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 0,
        estado: null,
        actualizadoEn: null,
      });
    http
      .expectOne(
        `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
      )
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 1,
        estado: { ...EMPTY_ALICANTE, cats: { muni: null } },
        actualizadoEn: '2026-10-24T09:00:01.000Z',
        importado: true,
      });

    expect(preparado).toBe(false);
    expect(error).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('formato inválido'),
      }),
    );
    expect(estados.at(-1)).toBe('error');
    expect(
      localStorage.getItem('tf_callejero_progreso_v1:111:alicante'),
    ).toBeNull();
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:alicante'),
    ).not.toContain('importado');
    sesion.reintentar();
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    sesion.cancelar();
  });

  it('borra en la API la modalidad actual sin tocar la copia legado', (done) => {
    const sesion = service.crearSesion(33, 'alicante');
    localStorage.setItem(
      'tf_atlas_qz',
      JSON.stringify({ ...EMPTY_ALICANTE, best: 80 }),
    );
    sesion
      .cargar({ ...EMPTY_ALICANTE, best: 80 }, true, false)
      .subscribe(() => {
        sesion.borrar().subscribe((estado) => {
          expect(estado.estado).toEqual(EMPTY_ALICANTE);
          expect(localStorage.getItem('tf_atlas_qz')).toContain('"best":80');
          expect(
            localStorage.getItem('tf_callejero_progreso_v1:33:alicante'),
          ).toContain('"best":0');
          expect(
            JSON.parse(
              localStorage.getItem(
                'tf_callejero_progreso_legacy_owner_v1:alicante',
              ) ?? '{}',
            ).estado,
          ).toBe('importado');
          sesion.cancelar();
          done();
        });
        const borrar = http.expectOne(
          `${environment.apiUrl}/callejero/mi-progreso/alicante`,
        );
        expect(borrar.request.method).toBe('DELETE');
        borrar.flush({
          modalidad: 'alicante',
          versionFormato: 2,
          revision: 2,
          estado: null,
          actualizadoEn: '2026-10-24T09:01:00.000Z',
        });
      });
    const get = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/alicante`,
    );
    get.flush({
      modalidad: 'alicante',
      versionFormato: 2,
      revision: 1,
      estado: { ...EMPTY_ALICANTE, best: 80 },
      actualizadoEn: '2026-10-24T09:00:00.000Z',
    });
  });

  it('conserva una escritura fallida para reintentar sin repetirla inmediatamente', () => {
    const sesion = service.crearSesion(34, 'alicante');
    sesion.cargar(null, true, false).subscribe();
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 1,
        estado: { ...EMPTY_ALICANTE, best: 80 },
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });

    sesion.borrar().subscribe();
    http
      .expectOne({
        method: 'DELETE',
        url: `${environment.apiUrl}/callejero/mi-progreso/alicante`,
      })
      .flush({ message: 'offline' }, { status: 503, statusText: 'Offline' });

    expect(
      http.match({
        method: 'DELETE',
        url: `${environment.apiUrl}/callejero/mi-progreso/alicante`,
      }),
    ).toHaveLength(0);
    expect(sesion.hayPendientes).toBe(true);
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:34:alicante') ?? '{}',
      ).accionPendiente,
    ).toBe('delete');
    sesion.cancelar();
  });

  it('no aplica una respuesta de refresco que llega después de un cambio local', () => {
    const sesion = service.crearSesion(88, 'valencia');
    let inicial: unknown;
    sesion
      .cargar(EMPTY_VALENCIA, true, false)
      .subscribe((value) => (inicial = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 3,
        estado: { asked: { 'p|Remoto inicial': 1 }, fallos: {} },
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });
    expect(inicial).toBeTruthy();

    let refrescado: { estado: Record<string, unknown> } | undefined;
    sesion.refrescar(false).subscribe((value) => (refrescado = value));
    const request = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/valencia`,
    );
    const local = { asked: { 'p|Cambio reciente local': 2 }, fallos: {} };
    sesion.guardar(local);
    request.flush({
      modalidad: 'valencia',
      versionFormato: 1,
      revision: 3,
      estado: { asked: { 'p|Respuesta remota tardía': 99 }, fallos: {} },
      actualizadoEn: '2026-10-24T08:59:00.000Z',
    });

    expect(refrescado?.estado).toEqual(local);
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:88:valencia') ?? '{}',
      ).pendiente,
    ).toBe(true);
    sesion.cancelar();
  });

  it('no envía una escritura debounceada si los claims dejan de coincidir con la sesión', () => {
    let sujetoActual = 41;
    const crearSesionProtegida = Reflect.get(service, 'crearSesion') as (
      usuarioId: number,
      modalidad: 'valencia',
      identidadVigente: () => boolean,
    ) => ReturnType<typeof service.crearSesion>;
    const sesion = crearSesionProtegida.call(
      service,
      41,
      'valencia',
      () => sujetoActual === 41,
    );
    sesion.cargar(null, true, false).subscribe();
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 1,
        estado: EMPTY_VALENCIA,
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });

    jest.useFakeTimers();
    sesion.guardar({ asked: { 'p|A': 1 }, fallos: {} });
    sujetoActual = 42;
    jest.advanceTimersByTime(500);

    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/valencia`,
    });
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:41:valencia') ?? '{}',
      ),
    ).toMatchObject({ pendiente: true, accionPendiente: 'put' });
    jest.useRealTimers();
    sesion.cancelar();
  });

  it('ignora el ACK de una escritura si cambia la identidad mientras está en vuelo', () => {
    let identidadActual = true;
    const sesion = service.crearSesion(42, 'valencia', () => identidadActual);
    const estados: string[] = [];
    sesion.estado$.subscribe((estado) => estados.push(estado.estado));
    sesion.cargar(null, true, false).subscribe();
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 2,
        estado: EMPTY_VALENCIA,
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });

    jest.useFakeTimers();
    sesion.guardar({ asked: { 'p|Escritura de A': 1 }, fallos: {} });
    jest.advanceTimersByTime(500);
    const put = http.expectOne({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/valencia`,
    });
    identidadActual = false;
    put.flush({
      modalidad: 'valencia',
      versionFormato: 1,
      revision: 3,
      estado: { asked: { 'p|ACK tardío': 9 }, fallos: {} },
      actualizadoEn: '2026-10-24T09:00:01.000Z',
    });

    expect(estados.at(-1)).toBe('guardando');
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:42:valencia') ?? '{}',
      ),
    ).toMatchObject({ pendiente: true, accionPendiente: 'put' });
    jest.useRealTimers();
    sesion.cancelar();
  });

  it('persiste el tipo importar y no pisa un remoto distinto tras perder el ACK', (done) => {
    const legado = { asked: { 'p|Legado pendiente': 1 }, fallos: {} };
    const primera = service.crearSesion(91, 'valencia');
    primera.cargar(legado, true, false).subscribe();
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 0,
        estado: null,
        actualizadoEn: null,
      });
    http
      .expectOne(
        `${environment.apiUrl}/callejero/mi-progreso/valencia/importar`,
      )
      .flush(
        { message: 'respuesta perdida' },
        { status: 503, statusText: 'Offline' },
      );
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:91:valencia') ?? '{}',
      ).accionPendiente,
    ).toBe('importar');
    primera.cancelar();

    const remoto = { asked: { 'p|Otra sesión guardada': 7 }, fallos: {} };
    const remotoAlResponder = {
      asked: { 'p|Cambio remoto concurrente': 8 },
      fallos: {},
    };
    const segunda = service.crearSesion(91, 'valencia');
    let resultado: { estado: Record<string, unknown> } | undefined;
    segunda
      .cargar(legado, true, false)
      .subscribe((value) => (resultado = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 8,
        estado: remoto,
        actualizadoEn: '2026-10-24T09:05:00.000Z',
      });
    expect(resultado?.estado).toEqual(remoto);
    const reintento = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/valencia/importar`,
    );
    expect(reintento.request.method).toBe('POST');
    expect(reintento.request.body.estado).toEqual(legado);
    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/valencia`,
    });
    reintento.flush({
      modalidad: 'valencia',
      versionFormato: 1,
      revision: 8,
      estado: remotoAlResponder,
      actualizadoEn: '2026-10-24T09:05:00.000Z',
      importado: false,
    });
    let refrescado: { estado: Record<string, unknown> } | undefined;
    segunda.refrescar(false).subscribe((value) => (refrescado = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/valencia`)
      .flush({
        modalidad: 'valencia',
        versionFormato: 1,
        revision: 0,
        estado: null,
        actualizadoEn: null,
      });
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:91:valencia') ?? '{}',
      ).estado,
    ).toEqual(remotoAlResponder);
    expect(refrescado?.estado).toEqual(remotoAlResponder);
    segunda.cancelar();
    done();
  });

  it('no reintenta una caché de importación durante impersonación si GET indica ausencia', () => {
    const legado = { ...EMPTY_ALICANTE, best: 55 };
    const cacheJson = JSON.stringify({
      versionFormato: 2,
      estado: legado,
      pendiente: true,
      accionPendiente: 'importar',
    });
    const markerJson = JSON.stringify({ usuarioId: 105, estado: 'pendiente' });
    const backupJson = JSON.stringify(legado);
    localStorage.setItem('tf_callejero_progreso_v1:105:alicante', cacheJson);
    localStorage.setItem(
      'tf_callejero_progreso_legacy_owner_v1:alicante',
      markerJson,
    );
    localStorage.setItem(
      'tf_callejero_progreso_legacy_v1:105:alicante',
      backupJson,
    );
    const sesion = service.crearSesion(105, 'alicante');
    let resultado: { estado: Record<string, unknown> } | undefined;

    sesion.cargar(legado, true, true).subscribe((value) => (resultado = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 0,
        estado: null,
        actualizadoEn: null,
      });

    expect(resultado?.estado).toEqual(EMPTY_ALICANTE);
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/alicante`,
    });
    sesion.reintentar();
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    expect(localStorage.getItem('tf_callejero_progreso_v1:105:alicante')).toBe(
      cacheJson,
    );
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:alicante'),
    ).toBe(markerJson);
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_v1:105:alicante'),
    ).toBe(backupJson);
    sesion.cancelar();
  });

  it('lee la fila remota en impersonación sin reanudar la importación local', () => {
    const legado = { ...EMPTY_ALICANTE, best: 55 };
    const cacheJson = JSON.stringify({
      versionFormato: 2,
      estado: legado,
      pendiente: true,
      accionPendiente: 'importar',
    });
    const markerJson = JSON.stringify({ usuarioId: 106, estado: 'pendiente' });
    const backupJson = JSON.stringify(legado);
    localStorage.setItem('tf_callejero_progreso_v1:106:alicante', cacheJson);
    localStorage.setItem(
      'tf_callejero_progreso_legacy_owner_v1:alicante',
      markerJson,
    );
    localStorage.setItem(
      'tf_callejero_progreso_legacy_v1:106:alicante',
      backupJson,
    );
    const remote = { ...EMPTY_ALICANTE, best: 82 };
    const sesion = service.crearSesion(106, 'alicante');
    let resultado: { estado: Record<string, unknown> } | undefined;

    sesion.cargar(legado, true, true).subscribe((value) => (resultado = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 4,
        estado: remote,
        actualizadoEn: '2026-10-24T09:00:00.000Z',
      });

    expect(resultado?.estado).toEqual(remote);
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    expect(localStorage.getItem('tf_callejero_progreso_v1:106:alicante')).toBe(
      cacheJson,
    );
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:alicante'),
    ).toBe(markerJson);
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_v1:106:alicante'),
    ).toBe(backupJson);
    sesion.cancelar();
  });

  it('no adopta el respaldo reservado en impersonación cuando GET indica ausencia', () => {
    const legado = { ...EMPTY_ALICANTE, best: 63 };
    const markerJson = JSON.stringify({ usuarioId: 107, estado: 'pendiente' });
    const backupJson = JSON.stringify(legado);
    localStorage.setItem(
      'tf_callejero_progreso_legacy_owner_v1:alicante',
      markerJson,
    );
    localStorage.setItem(
      'tf_callejero_progreso_legacy_v1:107:alicante',
      backupJson,
    );
    const sesion = service.crearSesion(107, 'alicante');
    let resultado: { estado: Record<string, unknown> } | undefined;

    sesion.cargar(legado, true, true).subscribe((value) => (resultado = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 0,
        estado: null,
        actualizadoEn: null,
      });

    expect(resultado?.estado).toEqual(EMPTY_ALICANTE);
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/alicante`,
    });
    sesion.reintentar();
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:alicante'),
    ).toBe(markerJson);
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_v1:107:alicante'),
    ).toBe(backupJson);
    sesion.cancelar();
  });

  it('no prepara ni convierte un respaldo reservado tras error GET durante impersonación', () => {
    const legado = { ...EMPTY_ALICANTE, best: 63 };
    const markerJson = JSON.stringify({ usuarioId: 108, estado: 'pendiente' });
    const backupJson = JSON.stringify(legado);
    localStorage.setItem(
      'tf_callejero_progreso_legacy_owner_v1:alicante',
      markerJson,
    );
    localStorage.setItem(
      'tf_callejero_progreso_legacy_v1:108:alicante',
      backupJson,
    );
    const sesion = service.crearSesion(108, 'alicante');
    let preparado = false;
    let error: unknown;

    sesion.cargar(legado, true, true).subscribe({
      next: () => (preparado = true),
      error: (value) => (error = value),
    });
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({ message: 'offline' }, { status: 503, statusText: 'Offline' });

    expect(preparado).toBe(false);
    expect(error).toBeDefined();
    http.expectNone(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/alicante`,
    });
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_owner_v1:alicante'),
    ).toBe(markerJson);
    expect(
      localStorage.getItem('tf_callejero_progreso_legacy_v1:108:alicante'),
    ).toBe(backupJson);
    expect(
      localStorage.getItem('tf_callejero_progreso_v1:108:alicante'),
    ).toBeNull();
    sesion.cancelar();
  });

  it('restaura la acción importar desde reserva+backup y respeta un tombstone remoto al reabrir', () => {
    const legado = { ...EMPTY_ALICANTE, best: 63 };
    const markerJson = JSON.stringify({ usuarioId: 109, estado: 'pendiente' });
    const backupJson = JSON.stringify(legado);
    localStorage.setItem(
      'tf_callejero_progreso_legacy_owner_v1:alicante',
      markerJson,
    );
    localStorage.setItem(
      'tf_callejero_progreso_legacy_v1:109:alicante',
      backupJson,
    );

    const primera = service.crearSesion(109, 'alicante');
    primera.cargar(legado, true, false).subscribe();
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({ message: 'offline' }, { status: 503, statusText: 'Offline' });
    const cacheDespuesDeError = JSON.parse(
      localStorage.getItem('tf_callejero_progreso_v1:109:alicante') ?? '{}',
    );
    expect(cacheDespuesDeError.accionPendiente).toBe('importar');
    expect(cacheDespuesDeError.pendiente).toBe(true);
    primera.cancelar();

    const segunda = service.crearSesion(109, 'alicante');
    let resultado: { estado: Record<string, unknown> } | undefined;
    segunda
      .cargar(legado, true, false)
      .subscribe((value) => (resultado = value));
    http
      .expectOne(`${environment.apiUrl}/callejero/mi-progreso/alicante`)
      .flush({
        modalidad: 'alicante',
        versionFormato: 2,
        revision: 7,
        estado: null,
        actualizadoEn: '2026-10-24T09:15:00.000Z',
      });
    const importar = http.expectOne(
      `${environment.apiUrl}/callejero/mi-progreso/alicante/importar`,
    );
    expect(importar.request.method).toBe('POST');
    expect(importar.request.body.estado).toEqual(legado);
    http.expectNone({
      method: 'PUT',
      url: `${environment.apiUrl}/callejero/mi-progreso/alicante`,
    });
    importar.flush({
      modalidad: 'alicante',
      versionFormato: 2,
      revision: 7,
      estado: EMPTY_ALICANTE,
      actualizadoEn: '2026-10-24T09:15:00.000Z',
      importado: false,
    });

    expect(resultado?.estado).toEqual(EMPTY_ALICANTE);
    expect(
      JSON.parse(
        localStorage.getItem('tf_callejero_progreso_v1:109:alicante') ?? '{}',
      ),
    ).toMatchObject({
      estado: EMPTY_ALICANTE,
      pendiente: false,
    });
    expect(
      JSON.parse(
        localStorage.getItem(
          'tf_callejero_progreso_legacy_owner_v1:alicante',
        ) ?? '{}',
      ),
    ).toEqual({
      usuarioId: 109,
      estado: 'importado',
    });
    segunda.cancelar();
  });
});
