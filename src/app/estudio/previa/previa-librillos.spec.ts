import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RouterTestingHarness } from '@angular/router/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { DocumentosService } from '../../documentacion/services/documentacion.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { TemaService } from '../../services/tema.service';
import { UserService } from '../../services/user.service';
import { DocumentoTemario } from '../../shared/models/documentacion.model';
import { PreviaLibrillosPdfComponent } from './previa-librillos-pdf.component';
import { PreviaLibrillosComponent } from './previa-librillos.component';
import {
  CanDeactivateFn,
  convertToParamMap,
  DefaultUrlSerializer,
  provideRouter,
  Router,
} from '@angular/router';
import {
  parametrosPracticaLibrillo,
  parametrosVistaLibrillo,
  retornoDeEdicionInteractiva,
  retornoDePracticaLibrillo,
  temaDePracticaLibrillo,
} from './previa-librillos';

describe('Navegación de práctica desde el Librillo', () => {
  const url = new DefaultUrlSerializer();

  it('recupera el tema y documento de cualquier tema del banco', () => {
    const tema = temaDePracticaLibrillo(
      convertToParamMap({
        desdeLibrillo: '309',
        documentoLibrillo: '987',
        volver: '/externo',
      }),
      true,
    );
    expect(tema).toEqual({ id: 309, documentoId: 987 });
    expect(parametrosPracticaLibrillo(tema)).toEqual({
      desdeLibrillo: 309,
      documentoLibrillo: 987,
    });
    expect(parametrosVistaLibrillo(tema!)).toEqual({ tema: 309, doc: 987 });
  });

  it('conserva la vuelta de prácticas abiertas antes del cambio', () => {
    const resultado = url.parse(
      '/app/test/alumno/stats-test-flashcard/234?desdeLibrillo=estatutos',
    );
    expect(retornoDePracticaLibrillo(resultado, true)).toEqual({
      id: 47,
      documentoId: 145,
    });
  });

  it('permite practicar temas que todavía no tienen documento', () => {
    const resultado = url.parse(
      '/app/test/alumno/stats-test/123?desdeLibrillo=309',
    );
    expect(retornoDePracticaLibrillo(resultado, true)).toEqual({ id: 309 });
  });

  it('limita el retorno a prácticas del campus, con un tema numérico válido', () => {
    const perfil = url.parse('/app/profile?desdeLibrillo=309');
    const ruta = url.parse('/app/test/alumno/realizar-test?desdeLibrillo=309');
    expect(retornoDePracticaLibrillo(perfil, true)).toBeUndefined();
    expect(retornoDePracticaLibrillo(ruta, false)).toBeUndefined();
    expect(
      temaDePracticaLibrillo(
        convertToParamMap({ desdeLibrillo: '309/externo' }),
        true,
      ),
    ).toBeUndefined();
    expect(
      temaDePracticaLibrillo(convertToParamMap({ desdeLibrillo: '0' }), true),
    ).toBeUndefined();
  });
});

describe('Retorno de la edición interactiva R07', () => {
  it.each([undefined, 'librillos', 'mis-documentos'])(
    'vuelve a Mis documentos en staging desde el origen %s',
    (desde) => {
      const params = convertToParamMap({
        desde,
        tema: '47',
        vista: 'librillo',
        doc: '999',
      });
      expect(retornoDeEdicionInteractiva(params, '145', true)).toEqual({
        ruta: '/app/librillos',
        parametros: { tema: null, doc: null, vista: 'documentos' },
      });
    },
  );

  it('mantiene la vuelta al acordeón fuera de staging', () => {
    const legacy = convertToParamMap({ tema: '47', vista: 'librillo' });
    expect(retornoDeEdicionInteractiva(legacy, '145', false)).toEqual({
      ruta: '/app/documentacion/alumno',
      parametros: { tema: 47, doc: 145 },
    });
  });
});

jest.mock('./previa-librillos-pdf.component', () => {
  const { Component, Input } = jest.requireActual('@angular/core');

  @Component({
    selector: 'app-previa-librillos-pdf',
    standalone: true,
    template: 'Lector PDF',
  })
  class PdfPrueba {
    @Input() documento!: DocumentoTemario;
    readonly guardarAntesDeSalir = jest.fn(async () => true);
    readonly estadoGuardadoAlSalir = jest.fn(() => 'guardado');
  }

  return { PreviaLibrillosPdfComponent: PdfPrueba };
});

describe('Navegación del Temario', () => {
  const tema = { id: 9, numero: 9, descripcion: 'Reglamento' };
  const doc: DocumentoTemario = {
    id: 21,
    identificador: 'Material de prueba',
    fileName: 'material.pdf',
    url: '',
    esPublico: true,
    creadoPorId: 1,
    creadoEn: new Date(0),
    actualizadoEn: new Date(0),
    isNew: false,
    isDownloadable: true,
  };
  const otro = { ...doc, id: 22, identificador: 'Otro material' };
  const arbol = [
    {
      id: 1,
      nombre: 'Normativa',
      temas: [{ ...tema, documentos: [doc, otro] }],
    },
  ];
  const getAllTemas$ = jest.fn(() => of([tema]));
  const getDocumentTree$ = jest.fn(() => of(arbol));
  const warning = jest.fn();
  const ruta = '/app/librillos';

  function visor(harness: RouterTestingHarness) {
    return harness.routeDebugElement?.query(
      By.directive(PreviaLibrillosPdfComponent),
    )?.componentInstance;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    const guardar: CanDeactivateFn<PreviaLibrillosComponent> = (
      componente,
      _ruta,
      _actual,
      siguiente,
    ) => componente.guardarAntesDeSalir(siguiente.url);
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideRouter([
          {
            path: 'app/librillos',
            component: PreviaLibrillosComponent,
            canDeactivate: [guardar],
            runGuardsAndResolvers: 'paramsOrQueryParamsChange',
          },
        ]),
        { provide: TemaService, useValue: { getAllTemas$ } },
        {
          provide: DocumentosService,
          useValue: { getDocumentTree$, markAsSeen$: () => of(null) },
        },
        {
          provide: AuthService,
          useValue: {
            currentIdentity$: of(null),
            sessionSnapshot: () => ({}),
            isSessionCurrent: () => true,
          },
        },
        { provide: UserService, useValue: {} },
        {
          provide: AppConfigService,
          useValue: { isModuloHabilitado: () => false },
        },
        { provide: ToastrService, useValue: { warning } },
      ],
    });
  });

  it('abre el árbol sin selección incluso con una vista antigua', async () => {
    const harness = await RouterTestingHarness.create(ruta + '?vista=librillo');
    const root = harness.routeNativeElement!;
    expect(root.querySelector('h1')?.textContent).toContain('Mis documentos');
    expect(
      root.querySelector('[aria-label="Buscar documentos"]'),
    ).not.toBeNull();
    expect(
      root
        .querySelector('[aria-label="Normativa"]')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(visor(harness)).toBeUndefined();
  });

  it('abre el PDF y muestra el título del documento al entrar por un tema', async () => {
    const harness = await RouterTestingHarness.create(ruta + '?tema=9');
    const root = harness.routeNativeElement!;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(
      doc.identificador,
    );
    expect(
      root.querySelector('[aria-label="Volver a Mis documentos"]'),
    ).not.toBeNull();
    expect(root.querySelector('p-dropdown, [role="tablist"]')).toBeNull();
    expect(visor(harness).documento).toBe(doc);
  });

  it('abre la rama del tema en el enlace antiguo de documentos y da prioridad a un documento explícito', async () => {
    const harness = await RouterTestingHarness.create(
      ruta + '?tema=9&vista=documentos',
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(visor(harness)).toBeUndefined();
    expect(
      harness.routeNativeElement?.querySelector('#temario-doc-21'),
    ).not.toBeNull();
    const lectura =
      ruta + '?tema=9&doc=21&pagina=3&referencia=8&vista=documentos';
    await harness.navigateByUrl(lectura);
    const lector = visor(harness);
    expect(lector.documento).toBe(doc);
    expect(TestBed.inject(Router).url).toBe(lectura);

    await harness.navigateByUrl(lectura.replace('pagina=3', 'pagina=4'));
    expect(lector.guardarAntesDeSalir).not.toHaveBeenCalled();
    expect(visor(harness)).toBe(lector);
  });

  it('bloquea el cambio de documento si falla el guardado y reintenta una vez por navegación', async () => {
    const inicio = ruta + '?tema=9&doc=21&pagina=3&referencia=8';
    const harness = await RouterTestingHarness.create(inicio);
    const lector = visor(harness);
    const componente = harness.routeDebugElement!
      .componentInstance as PreviaLibrillosComponent;
    const router = TestBed.inject(Router);
    lector.guardarAntesDeSalir.mockResolvedValueOnce(false);

    const destino = ruta + '?tema=9&doc=22&vista=librillo';
    expect(await router.navigateByUrl(destino)).toBe(false);
    harness.detectChanges();
    expect(router.url).toBe(inicio);
    expect(visor(harness)).toBe(lector);
    expect(componente.salidaPendiente()).toContain('doc=22');
    expect(lector.guardarAntesDeSalir).toHaveBeenCalledTimes(1);

    lector.estadoGuardadoAlSalir.mockReturnValue('local');
    componente.reintentarSalida();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(lector.guardarAntesDeSalir).toHaveBeenCalledTimes(2);
    expect(visor(harness).documento).toBe(otro);
    expect(router.parseUrl(router.url).queryParams).toEqual({
      tema: '9',
      doc: '22',
      vista: 'librillo',
    });
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Sincronización pendiente'),
    );
  });

  it('recupera solamente el banco fallido y resuelve el PDF desde el árbol disponible', async () => {
    getAllTemas$.mockReturnValueOnce(throwError(() => new Error('Sin banco')));
    const harness = await RouterTestingHarness.create(ruta + '?doc=21');
    const componente = harness.routeDebugElement!
      .componentInstance as PreviaLibrillosComponent;
    const lector = visor(harness);
    expect(lector.documento).toBe(doc);
    expect(componente.fallos()).toEqual(['banco']);
    expect(componente.temasDePractica()).toEqual([]);

    componente.recargar('banco');
    harness.detectChanges();
    expect(componente.fallos()).toEqual([]);
    expect(componente.temasDePractica().map((tema) => tema.id)).toEqual([9]);
    expect(visor(harness)).toBe(lector);
    expect(getDocumentTree$).toHaveBeenCalledTimes(1);
  });

  it('no monta un PDF si el documento pertenece a otro tema', async () => {
    getAllTemas$.mockReturnValueOnce(
      of([tema, { id: 10, numero: 10, descripcion: 'Anexos' }]),
    );
    const harness = await RouterTestingHarness.create(ruta + '?tema=10&doc=21');
    expect(visor(harness)).toBeUndefined();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Este documento no está disponible en el tema seleccionado.',
    );
  });

  it('vuelve a la biblioteca con la búsqueda y ramas tras un fallo de guardado del lector', async () => {
    const inicio = ruta + '?vista=documentos&tema=9';
    const harness = await RouterTestingHarness.create(inicio);
    const componente = harness.routeDebugElement!
      .componentInstance as PreviaLibrillosComponent;
    const router = TestBed.inject(Router);
    expect(
      harness.routeNativeElement?.querySelector('h1')?.textContent,
    ).toContain('Mis documentos');
    expect(
      harness.routeNativeElement?.querySelector('.selector-temas'),
    ).toBeNull();

    componente.buscarEnBiblioteca('NORMÁTIVA');
    harness.detectChanges();
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>('#temario-doc-21')
      ?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.parseUrl(router.url).queryParams).toEqual({
      tema: '9',
      doc: '21',
      vista: 'librillo',
    });
    const lector = visor(harness);
    expect(lector.documento).toBe(doc);
    lector.guardarAntesDeSalir.mockResolvedValueOnce(false);
    expect(await componente.volverABiblioteca()).toBe(false);
    expect(componente.salidaPendiente()).toBe(inicio);

    componente.reintentarSalida();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe(inicio);
    expect(lector.guardarAntesDeSalir).toHaveBeenCalledTimes(2);
    expect(componente.busquedaBiblioteca()).toBe('NORMÁTIVA');
    expect(
      harness.routeNativeElement?.querySelector('#temario-doc-21'),
    ).not.toBeNull();
    expect(visor(harness)).toBeUndefined();
  });

  it('abre la rama real al volver de un documento sin historial del árbol', async () => {
    const harness = await RouterTestingHarness.create(ruta + '?doc=22');
    const componente = harness.routeDebugElement!
      .componentInstance as PreviaLibrillosComponent;
    expect(await componente.volverABiblioteca()).toBe(true);
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('#temario-doc-22'),
    ).not.toBeNull();
    expect(visor(harness)).toBeUndefined();
  });

  it('recupera el documento de una entrada de historial anterior sin URL ni ramas', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(ruta + '?doc=22', {
      state: {
        misDocumentos: {
          tema: 9,
          busqueda: '',
          scroll: 0,
          foco: 'temario-doc-22',
          ramasAbiertas: [],
          ramasCerradasConFiltro: [],
        },
      },
    });
    harness.detectChanges();
    const componente = harness.routeDebugElement!
      .componentInstance as PreviaLibrillosComponent;
    expect(await componente.volverABiblioteca()).toBe(true);
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('#temario-doc-22'),
    ).not.toBeNull();
  });

  it('distingue la biblioteca sin publicaciones de un enlace ajeno al catálogo', async () => {
    getDocumentTree$.mockReturnValueOnce(of([]));
    const harness = await RouterTestingHarness.create(
      ruta + '?vista=documentos',
    );
    expect(harness.routeNativeElement?.textContent).toContain(
      'Todavía no hay documentos publicados',
    );
    await harness.navigateByUrl(ruta + '?vista=documentos&doc=9999');
    expect(harness.routeNativeElement?.textContent).toContain(
      'Este tema o documento no está disponible',
    );
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'Todavía no hay documentos publicados',
    );
  });
});
