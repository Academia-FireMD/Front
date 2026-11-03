import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import {
  ActivatedRoute,
  DefaultUrlSerializer,
  Router,
  UrlTree,
} from '@angular/router';
import { LocationStrategy } from '@angular/common';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { PlanificacionMensual } from '../../shared/models/planificacion.model';
import { PlanificacionAdminComponent } from './planificacion-admin.component';
import type {
  CargaSemanasPendiente,
  PreviewCargaSemanas,
  ResultadoPublicacionSemanas,
  SemanaCambiosCarga,
  VarianteCargaSemanas,
} from '../models/autoasignacion.model';
import {
  codigoPlantillaImportada,
  identidadVarianteImportada,
} from '../utils/variante-importada.util';

function varianteCarga(
  semanas: SemanaCambiosCarga[],
  overrides: Partial<VarianteCargaSemanas> = {},
): VarianteCargaSemanas {
  return {
    codigo: 'PCMI6-8H',
    oposicion: Oposicion.MADRID,
    nivel: NivelOposicion.INICIACION,
    franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    destino: { tipo: 'EXISTENTE', planificacionId: 207 },
    publicada: { identificador: 'MADRID-6-8', version: 4 },
    semanas,
    ...overrides,
  };
}

function semanaCarga(
  numero: number,
  lunes: string,
  overrides: Partial<SemanaCambiosCarga> = {},
): SemanaCambiosCarga {
  return {
    hoja: 'CMI6-8',
    numero,
    lunes,
    creados: 1,
    actualizados: 0,
    omitidos: 0,
    eliminados: 0,
    bloques: [],
    ...overrides,
  };
}

function resultadoPublicacion(
  semanas: ResultadoPublicacionSemanas['semanas'],
  overrides: Partial<ResultadoPublicacionSemanas> = {},
): ResultadoPublicacionSemanas {
  return {
    cargaId: 3,
    estado: 'PUBLICADA',
    variantes: [{ codigo: 'PCMI6-8H', planificacionId: 207 }],
    semanas,
    mensaje:
      'Semanas publicadas en las planificaciones existentes. Se conservaron sus identificadores y el progreso de los alumnos.',
    ...overrides,
  };
}

function previewCarga(
  variantes: VarianteCargaSemanas[],
  overrides: Partial<PreviewCargaSemanas> = {},
): PreviewCargaSemanas {
  return {
    puedeAplicar: true,
    previewHash: 'a'.repeat(64),
    variantes,
    ...overrides,
  };
}

function preparacionCarga(
  variantes: VarianteCargaSemanas[],
  cargaId = 9,
): PreviewCargaSemanas {
  return { ...previewCarga(variantes), cargaId };
}

function cargaPendiente(
  variantes: VarianteCargaSemanas[],
  id = 9,
  fileName = 'semanas.xlsx',
): CargaSemanasPendiente {
  return {
    id,
    fileName,
    createdAt: '2026-11-03T12:00:00Z',
    preview: { ...previewCarga(variantes), cargaId: id },
    variantes: variantes.map((variante) => ({
      codigo: variante.codigo,
      planificacionMensualId: variante.planificacionId ?? null,
    })),
  };
}

function botonPorTexto(
  host: HTMLElement,
  texto: string,
): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll('button')).find((boton) =>
    boton.textContent?.includes(texto),
  );
}

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('PlanificacionAdminComponent', () => {
  let component: PlanificacionAdminComponent;
  let fixture: ComponentFixture<PlanificacionAdminComponent>;
  let service: AutoasignacionService;
  let confirmation: ConfirmationService;
  let router: {
    navigate: jest.Mock;
    events: ReturnType<typeof of>;
    createUrlTree: jest.Mock;
    serializeUrl: jest.Mock;
  };

  beforeAll(() => {
    // PrimeNG Table/TabView requieren ResizeObserver en el entorno de test.
    (globalThis as any).ResizeObserver = ResizeObserverMock;
  });

  beforeEach(async () => {
    sessionStorage.clear();
    const serviceMock = {
      getVariantes$: jest.fn(() => of([])),
      getReglas$: jest.fn(() => of([])),
      getSinCoincidencia$: jest.fn(() => of([])),
      crearVariante$: jest.fn(() => of({})),
      actualizarVariante$: jest.fn(() => of({})),
      publicarVariante$: jest.fn(() => of({})),
      crearRegla$: jest.fn(() => of({})),
      actualizarRegla$: jest.fn(() => of({})),
      reconciliar$: jest.fn(() =>
        of({
          aplicar: false,
          previewHash: 'preview-fixture',
          totalElegibles: 0,
          aplicables: 0,
          aplicados: 0,
          noAplicables: 0,
          casos: [],
        }),
      ),
      previewImportacionPlantillas$: jest.fn(() =>
        of({
          fileName: 'madrid.xlsx',
          fileHash: 'a'.repeat(64),
          puedeAplicar: true,
          yaAplicado: false,
          requiereConfirmacionSobrescritura: false,
          sobrescrituras: [],
          totales: {
            hojas: 1,
            semanas: 2,
            bloques: 12,
            entrenamientos: 2,
            errores: 0,
          },
          hojas: [],
        }),
      ),
      applyImportacionPlantillas$: jest.fn(() =>
        of({ yaAplicado: false, version: 3, hojas: [] }),
      ),
      previewCargaSemanas$: jest.fn(),
      applyCargaSemanas$: jest.fn(),
      listarCargasPendientes$: jest.fn(() => of([])),
      publicarCargaSemanas$: jest.fn(),
      descartarCargaSemanas$: jest.fn(),
    };
    confirmation = new ConfirmationService();
    const urlSerializer = new DefaultUrlSerializer();
    router = {
      navigate: jest.fn(),
      events: of(),
      createUrlTree: jest.fn(
        (
          commands: unknown[],
          options: { queryParams?: Record<string, unknown> },
        ) => {
          const path = commands.join('/');
          const query = options.queryParams
            ? new URLSearchParams(
                Object.entries(options.queryParams).map(([clave, valor]) => [
                  clave,
                  String(valor),
                ]),
              ).toString()
            : '';
          return urlSerializer.parse(
            query ? `${path}?${query}` : path,
          ) as UrlTree;
        },
      ),
      serializeUrl: jest.fn((tree: UrlTree) => urlSerializer.serialize(tree)),
    };
    const confirmOriginal = confirmation.confirm.bind(confirmation);
    jest.spyOn(confirmation, 'confirm').mockImplementation((config) => {
      confirmOriginal(config);
      return confirmation;
    });

    await TestBed.configureTestingModule({
      imports: [PlanificacionAdminComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AutoasignacionService, useValue: serviceMock },
        {
          provide: PlanificacionesService,
          useValue: {
            getPlanificacionMensual$: jest.fn(() => of({ data: [] })),
          },
        },
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), success: jest.fn() },
        },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: Router, useValue: router },
        {
          provide: LocationStrategy,
          useValue: {
            path: () => '',
            getBaseHref: () => '/',
            prepareExternalUrl: (url: string) => url,
            pushState: () => undefined,
            replaceState: () => undefined,
            forward: () => undefined,
            back: () => undefined,
            onPopState: () => undefined,
            getState: () => null,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: {
              queryParams: {},
              queryParamMap: {
                get: jest.fn(() => null),
                getAll: jest.fn(() => []),
              },
            },
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    service = TestBed.inject(AutoasignacionService);
    fixture = TestBed.createComponent(PlanificacionAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('carga variantes y reglas sin abrir diagnósticos técnicos', () => {
    expect(service.getVariantes$).toHaveBeenCalled();
    expect(service.getReglas$).toHaveBeenCalled();
    expect(service.getSinCoincidencia$).not.toHaveBeenCalled();
  });

  it('ofrece el plan común de Valencia creando la regla compatible', async () => {
    await component.cambiarAccesoPlanComun(
      Oposicion.VALENCIA_AYUNTAMIENTO,
      true,
    );
    expect(service.crearRegla$).toHaveBeenCalledWith({
      oposicionSuscripcion: Oposicion.VALENCIA_AYUNTAMIENTO,
      oposicionPlanificacion: Oposicion.GENERAL,
      activa: true,
    });
  });

  it('restaura el control cuando el servidor rechaza quitar un acceso vigente', async () => {
    const regla = {
      id: 12,
      oposicionSuscripcion: Oposicion.ALICANTE_CPBA,
      oposicionPlanificacion: Oposicion.GENERAL,
      activa: true,
    };
    (service.getReglas$ as jest.Mock).mockReturnValue(of([regla]));
    component.reglas.set([regla]);
    (service.actualizarRegla$ as jest.Mock).mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    await component.cambiarAccesoPlanComun(Oposicion.ALICANTE_CPBA, false);
    expect(component.planComunActivo(Oposicion.ALICANTE_CPBA)).toBe(true);
    expect(TestBed.inject(ToastrService).error).toHaveBeenCalled();
  });

  it('filtra perfiles por existencia de planificación publicada', async () => {
    component.variantes.set([
      {
        id: 1,
        codigo: 'PCMI4-6H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
        planificacionMensual: {
          id: 5,
          identificador: 'Madrid',
          mes: 9,
          ano: 2026,
        },
      },
      {
        id: 2,
        codigo: 'PCMI6-8H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        activa: true,
      },
    ]);
    component.onFiltersChanged({ publicada: 'sin' });
    expect(
      (await firstValueFrom(component.fetchItems$()))?.data.map((v) => v.id),
    ).toEqual([2]);
    component.onFiltersChanged({ publicada: 'con' });
    expect(
      (await firstValueFrom(component.fetchItems$()))?.data.map((v) => v.id),
    ).toEqual([1]);
  });

  it('crea una variante nueva con el payload correcto', async () => {
    component.varianteForm.patchValue({
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
    await component.guardarVariante();

    expect(service.crearVariante$).toHaveBeenCalledWith({
      codigo: 'PGCVA4-6H',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: null,
      activa: true,
    });
  });

  it.each([
    [
      Oposicion.GENERAL,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PGCVI4-6H',
    ],
    [
      Oposicion.GENERAL,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PGCVI6-8H',
    ],
    [
      Oposicion.GENERAL,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PGCVA4-6H',
    ],
    [
      Oposicion.GENERAL,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PGCVA6-8H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCAI4-6H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCAI6-8H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCAA4-6H',
    ],
    [
      Oposicion.ALICANTE_CPBA,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCAA6-8H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PAVI4-6H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PAVI6-8H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PAVA4-6H',
    ],
    [
      Oposicion.VALENCIA_AYUNTAMIENTO,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PAVA6-8H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.INICIACION,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCMI4-6H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.INICIACION,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCMI6-8H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.AVANZADO,
      'FRANJA_CUATRO_A_SEIS_HORAS',
      'PCMA4-6H',
    ],
    [
      Oposicion.MADRID,
      NivelOposicion.AVANZADO,
      'FRANJA_SEIS_A_OCHO_HORAS',
      'PCMA6-8H',
    ],
  ])(
    'calcula el código canónico %s/%s/%s',
    (oposicion, nivel, franja, codigo) => {
      component.nuevaVariante();
      component.varianteForm.patchValue({ oposicion, nivel, franja });

      expect(component.varianteForm.controls.codigo.value).toBe(codigo);
    },
  );

  it('muestra el código calculado como solo lectura en el formulario de alta', () => {
    expect(component.dialogoVarianteVisible()).toBe(false);
    component.abrirNuevaVariante();
    fixture.detectChanges();
    const input = document.querySelector(
      '#variante-codigo',
    ) as HTMLInputElement;

    expect(input).toBeTruthy();
    expect(input.readOnly).toBe(true);
    expect(component.varianteForm.controls.codigo.enabled).toBe(true);
  });

  it('abre la edición en un diálogo y descarta el formulario al cancelar', () => {
    component.editarVariante({
      id: 7,
      codigo: 'PCMI6-8H',
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      activa: true,
    });

    expect(component.dialogoVarianteVisible()).toBe(true);
    expect(component.varianteForm.controls.id.value).toBe(7);
    component.cerrarDialogoVariante();
    expect(component.dialogoVarianteVisible()).toBe(false);
    expect(component.varianteForm.controls.id.value).toBeNull();
  });

  it('reutiliza búsqueda, filtros y paginación para las variantes', async () => {
    component.variantes.set([
      {
        id: 1,
        codigo: 'PCMI6-8H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        activa: true,
      },
      {
        id: 2,
        codigo: 'PAVI4-6H',
        oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: false,
      },
    ]);
    component.pagination.set({ skip: 0, take: 1, searchTerm: '' });

    const primeraPagina = await firstValueFrom(component.fetchItems$());
    expect(primeraPagina?.pagination.count).toBe(2);
    expect(primeraPagina?.data.map((v) => v.id)).toEqual([1]);

    component.onFiltersChanged({ activa: false });
    const filtrado = await firstValueFrom(component.fetchItems$());
    expect(filtrado?.pagination.count).toBe(1);
    expect(filtrado?.data.map((v) => v.id)).toEqual([2]);

    component.onFiltersChanged();
    component.buscarVariante({
      target: { value: 'madrid' },
    } as unknown as Event);
    const buscado = await firstValueFrom(component.fetchItems$());
    expect(buscado?.pagination.count).toBe(1);
    expect(buscado?.data.map((v) => v.id)).toEqual([1]);
  });

  it('ignora el correo autocompletado en el buscador hasta recibir foco', () => {
    fixture.detectChanges();
    const input = document.querySelector(
      'input[name="buscarVariantes"]',
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);

    input.value = 'shishi2@gmail.com';
    input.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();

    expect(input.readOnly).toBe(false);
    expect(input.value).toBe('');
    expect(component.pagination().searchTerm).toBe('');
  });

  it('actualiza una variante existente con su id', async () => {
    component.editarVariante({
      id: 7,
      codigo: 'GA6-8',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      activa: true,
    });
    expect(component.varianteForm.controls.codigo.disabled).toBe(true);
    expect(component.varianteForm.controls.oposicion.disabled).toBe(true);
    expect(component.varianteForm.controls.nivel.disabled).toBe(true);
    expect(component.varianteForm.controls.franja.disabled).toBe(true);
    component.varianteForm.patchValue({ activa: false });
    await component.guardarVariante();

    expect(service.actualizarVariante$).toHaveBeenCalledWith(7, {
      planificacionMensualId: null,
      activa: false,
    });
  });

  it('vuelve a habilitar la identidad al iniciar una variante nueva', () => {
    component.editarVariante({
      id: 7,
      codigo: 'GA6-8',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
      activa: true,
    });
    component.nuevaVariante();

    expect(component.varianteForm.controls.codigo.enabled).toBe(true);
    expect(component.varianteForm.controls.oposicion.enabled).toBe(true);
    expect(component.varianteForm.controls.nivel.enabled).toBe(true);
    expect(component.varianteForm.controls.franja.enabled).toBe(true);
  });

  it('mapea una planificación mensual canónica al guardar una variante', async () => {
    component.planificacionesMensuales.set([
      {
        id: 17,
        identificador: 'GENERAL-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.GENERAL],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      codigo: 'GA4-6',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      planificacionMensualId: 17,
      activa: true,
    });

    await component.guardarVariante();

    expect(service.crearVariante$).toHaveBeenCalledWith(
      expect.objectContaining({ planificacionMensualId: 17 }),
    );
  });

  it('no ofrece reconciliación manual en administración', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Diagnóstico');
    expect(texto).not.toContain('Aplicar reconciliación');
    expect(service.getSinCoincidencia$).not.toHaveBeenCalled();
  });

  it('filtra las planificaciones por franja y relevancia de la variante', () => {
    component.planificacionesMensuales.set([
      {
        id: 1,
        identificador: 'GENERAL-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.GENERAL],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
      {
        id: 2,
        identificador: 'GENERAL-6-8',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        relevancia: [Oposicion.GENERAL],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
      {
        id: 3,
        identificador: 'MADRID-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.MADRID],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      oposicion: Oposicion.GENERAL,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });

    expect(component.planificacionOptions).toEqual([
      {
        label: 'GENERAL-4-6 v1 · PUBLICADA (8/2026)',
        value: 1,
        estado: 'PUBLICADA',
      },
    ]);
  });

  it('limpia el plan seleccionado cuando deja de ser compatible', () => {
    component.planificacionesMensuales.set([
      {
        id: 1,
        identificador: 'MADRID-6-8',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        relevancia: [Oposicion.MADRID],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
    ]);
    component.varianteForm.patchValue({
      oposicion: Oposicion.MADRID,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      planificacionMensualId: 1,
    });
    component.varianteForm.patchValue({
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });

    expect(component.varianteForm.controls.planificacionMensualId.value).toBe(
      null,
    );
  });

  it('oculta planes ya mapeados y conserva el mapping de la variante editada', () => {
    component.planificacionesMensuales.set([
      {
        id: 17,
        identificador: 'GENERAL-4-6',
        mes: 8,
        ano: 2026,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.GENERAL],
        estado: 'PUBLICADA',
        version: 1,
      } as PlanificacionMensual,
    ]);
    component.variantes.set([
      {
        id: 7,
        codigo: 'GA4-6',
        oposicion: Oposicion.GENERAL,
        nivel: NivelOposicion.AVANZADO,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
        planificacionMensualId: 17,
      },
    ]);
    component.varianteForm.patchValue({
      id: null,
      oposicion: Oposicion.GENERAL,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });
    expect(component.planificacionOptions).toEqual([]);

    component.editarVariante(component.variantes()[0]);
    expect(component.planificacionOptions).toEqual([
      {
        label: 'GENERAL-4-6 v1 · PUBLICADA (8/2026)',
        value: 17,
        estado: 'PUBLICADA',
      },
    ]);
  });

  it('publica y asigna un borrador solo tras confirmación explícita', async () => {
    component.planificacionesMensuales.set([
      {
        id: 17,
        identificador: 'MADRID-4-6',
        mes: 9,
        ano: 2026,
        estado: 'BORRADOR',
        version: 2,
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        relevancia: [Oposicion.MADRID],
      } as PlanificacionMensual,
    ]);
    component.editarVariante({
      id: 7,
      codigo: 'MI4-6',
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      activa: false,
    });
    component.varianteForm.controls.planificacionMensualId.setValue(17);

    component.publicarPlanSeleccionado();

    expect(service.publicarVariante$).not.toHaveBeenCalled();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();
    expect(service.publicarVariante$).toHaveBeenCalledWith(7, 17);
  });

  it('previsualiza el Excel sin aplicar y conserva el hash del servidor', async () => {
    const file = new File(['xlsx'], 'madrid.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    component.archivoImportacion.set(file);

    await component.previsualizarImportacion();

    expect(service.previewImportacionPlantillas$).toHaveBeenCalledWith(file);
    expect(service.applyImportacionPlantillas$).not.toHaveBeenCalled();
    expect(component.previewImportacion()?.fileHash).toBe('a'.repeat(64));
    expect(component.puedeAplicarImportacion).toBe(true);
  });

  it('bloquea el apply con sobrescrituras hasta confirmar dos veces', async () => {
    const file = new File(['xlsx'], 'madrid.xlsx');
    component.archivoImportacion.set(file);
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'a'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: true,
      sobrescrituras: ['S012026CMI6-8H'],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 6,
        entrenamientos: 1,
        errores: 0,
      },
      hojas: [],
    });

    expect(component.puedeAplicarImportacion).toBe(false);
    component.confirmarAplicacionImportacion();
    expect(confirmation.confirm).not.toHaveBeenCalled();

    component.confirmarSobrescritura.set(true);
    component.confirmarAplicacionImportacion();
    expect(service.applyImportacionPlantillas$).not.toHaveBeenCalled();
    const config = (confirmation.confirm as jest.Mock).mock.calls[0][0];
    await config.accept();

    expect(service.applyImportacionPlantillas$).toHaveBeenCalledWith(
      file,
      'a'.repeat(64),
      true,
    );
    expect(component.previewImportacion()?.yaAplicado).toBe(true);
  });

  it('muestra subbloques independientes y no importa hasta confirmarlos', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = {
      codigo: 'PCMI4-6H',
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      destino: {
        tipo: 'CREAR' as const,
        identificador: 'Importación CMI4-6H',
      },
      candidatos: [],
      planificacionId: 17,
      primeraSemana: '2026-10-05',
      semanas: [],
    };
    const preview = previewCarga([variante], {
      requiereConfirmacion: true,
      independientes: [
        {
          hoja: 'CMI4-6H',
          semana: 40,
          dia: 'Lunes',
          filaExcel: 7,
          tema: 'Tráfico',
        },
      ],
    });
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(of(preview));
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of(preparacionCarga([variante])),
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      of(resultadoPublicacion([])),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    component.abrirImportacionSemanas();
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Tráfico');
    expect(texto).toContain('Fila 7');
    expect(texto).toContain('sin vínculo al catálogo');
    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((item) => item.textContent?.includes('Importar semanas'));
    expect(boton?.disabled).toBe(true);
    await component.importarSemanas();
    expect(service.applyCargaSemanas$).not.toHaveBeenCalled();
    component.confirmarSobrescritura.set(true);
    fixture.detectChanges();
    expect(boton?.disabled).toBe(false);
    await component.importarSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledWith(
      file,
      'a'.repeat(64),
      true,
      expect.any(String),
    );
    expect(service.publicarCargaSemanas$).toHaveBeenCalledWith(9);
    expect(component.resultadoPublicacion()).not.toBeNull();
  });

  it('importa con una sola acción: prepara y publica en orden sin navegar', async () => {
    const file = new File(['xlsx'], 'plan.xlsx');
    const variante = {
      codigo: 'PCMI4-6H',
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      publicadaId: 9,
      destino: { tipo: 'COPIAR' as const },
      candidatos: [],
      planificacionId: 17,
      primeraSemana: '2026-10-05',
      semanas: [
        {
          hoja: 'CMI4-6H',
          numero: 40,
          lunes: '2026-10-05',
          creados: 6,
          actualizados: 0,
          eliminados: 0,
          omitidos: 0,
          bloques: [],
        },
      ],
    };
    const preview = previewCarga([variante]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(of(preview));
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of(preparacionCarga([variante])),
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      of(
        resultadoPublicacion(
          [
            {
              codigo: 'PCMI4-6H',
              hoja: 'CMI4-6H',
              semana: 40,
              lunes: '2026-10-05',
              creados: 6,
              actualizados: 0,
              omitidos: 0,
              eliminados: 0,
              bloques: [],
            },
          ],
          {
            cargaId: 9,
            variantes: [{ codigo: 'PCMI4-6H', planificacionId: 17 }],
          },
        ),
      ),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    component.abrirImportacionSemanas();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(TestBed.inject(ToastrService).success).not.toHaveBeenCalled();
    expect(host.textContent).toContain(
      'Revisa las fechas y pulsa «Importar semanas».',
    );
    expect(host.textContent).toContain('Destino: Copia del plan publicado');
    expect(host.textContent).toContain('Semana 40');
    expect(host.textContent).toContain('Importar semanas');
    expect(host.textContent).not.toContain('Guardar cambios pendientes');
    expect(host.textContent).not.toContain('Previsualizar cambios');
    expect(component.previewCarga()).toEqual(preview);
    await component.importarSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledWith(9);
    expect(
      (service.applyCargaSemanas$ as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan(
      (service.publicarCargaSemanas$ as jest.Mock).mock.invocationCallOrder[0],
    );
    expect(TestBed.inject(ToastrService).success).toHaveBeenCalledWith(
      'Excel importado',
    );
    expect(component.previewCarga()).toBeNull();
    expect(component.resultadoCarga()).toBeNull();
    expect(component.resultadoPublicacion()?.cargaId).toBe(9);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('un 422 al preparar descarta el estado viejo, muestra celdas y no publica', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    const previewError = {
      fileName: 'semanas.xlsx',
      fileHash: 'f'.repeat(64),
      puedeAplicar: false,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 0,
        bloques: 0,
        entrenamientos: 0,
        errores: 1,
      },
      hojas: [
        {
          hoja: 'CMI6-8',
          valida: false,
          totalBloques: 0,
          totalEntrenamientos: 0,
          semanas: [],
          errores: [
            {
              hoja: 'CMI6-8',
              semana: 40,
              filaExcel: 12,
              celdas: ['A12', 'C12'],
              campo: 'fecha',
              mensaje: 'La fecha no es válida.',
            },
          ],
          warnings: [],
        },
      ],
    };
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'CARGA_EXCEL_INVALIDO',
              message: 'Corrige los errores localizados del Excel.',
              preview: previewError,
            },
          }),
      ),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    component.resultadoCarga.set(preparacionCarga([variante], 7));
    component.confirmarSobrescritura.set(true);

    await component.importarSemanas();
    expect(component.previewCarga()).toBeNull();
    expect(component.resultadoCarga()).toBeNull();
    expect(component.idempotencyKeyCarga).toBeNull();
    expect(component.confirmarSobrescritura()).toBe(false);
    expect(component.previewImportacion()).toEqual(previewError);
    expect(service.publicarCargaSemanas$).not.toHaveBeenCalled();
    component.abrirImportacionSemanas();
    fixture.detectChanges();
    const texto =
      (fixture.nativeElement as HTMLElement).textContent?.replace(
        /\s+/g,
        ' ',
      ) ?? '';
    expect(texto).toContain('No se ha importado nada');
    expect(texto).toContain('Fila 12');
    expect(texto).toContain('A12, C12');
    expect(texto).toContain('La fecha no es válida.');
  });

  it('reintenta la preparación con la misma clave si se pierde la respuesta', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    (service.applyCargaSemanas$ as jest.Mock)
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 0,
              error: new Error('sin respuesta'),
            }),
        ),
      )
      .mockReturnValue(of(preparacionCarga([variante])));
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      of(resultadoPublicacion([])),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    const clave = component.idempotencyKeyCarga;

    await component.importarSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).not.toHaveBeenCalled();
    expect(component.previewCarga()).not.toBeNull();
    expect(component.idempotencyKeyCarga).toBe(clave);

    await component.importarSemanas();
    const llamadas = (service.applyCargaSemanas$ as jest.Mock).mock.calls;
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0][3]).toBe(clave);
    expect(llamadas[1][3]).toBe(clave);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(component.resultadoPublicacion()).not.toBeNull();
  });

  it('un 409 al preparar descarta el estado viejo y muestra el mensaje actual', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              message:
                'Ya hay cambios pendientes para uno de estos perfiles. Publícalos o descártalos antes de subir más semanas.',
            },
          }),
      ),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    component.resultadoCarga.set(preparacionCarga([variante], 7));

    await component.importarSemanas();
    expect(component.previewCarga()).toBeNull();
    expect(component.resultadoCarga()).toBeNull();
    expect(component.idempotencyKeyCarga).toBeNull();
    expect(component.previewImportacion()).toBeNull();
    expect(component.errorCarga()).toContain('Ya hay cambios pendientes');
    expect(service.publicarCargaSemanas$).not.toHaveBeenCalled();
  });

  it('recupera una importación sin terminar y pide confirmación solo si el Excel la exige', async () => {
    component.abrirImportacionSemanas();
    component.cargasPendientes.set([
      {
        id: 3,
        fileName: 'semanas-parciales.xlsx',
        createdAt: '2026-09-30T12:00:00Z',
        preview: {
          puedeAplicar: true,
          previewHash: 'a'.repeat(64),
          requiereConfirmacion: true,
          variantes: [{ codigo: 'GI6-8' }],
        },
        variantes: [{ codigo: 'GI6-8', planificacionMensualId: 207 }],
      } as any,
    ]);
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      of({
        cargaId: 3,
        estado: 'PUBLICADA',
        variantes: [{ codigo: 'GI6-8', planificacionId: 207 }],
        semanas: [],
        mensaje: 'Publicada',
      }),
    );
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('semanas-parciales.xlsx');
    expect(texto).toContain('Importación sin terminar');
    expect(texto).toContain('Continuar importación');
    expect(texto).not.toContain('Publicar cambios');
    component.continuarCargaPendiente(3, true);
    expect(service.publicarCargaSemanas$).not.toHaveBeenCalled();
    const confirmacion = (confirmation.confirm as jest.Mock).mock.calls.at(
      -1,
    )?.[0];
    confirmacion.accept();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.publicarCargaSemanas$).toHaveBeenCalledWith(3);
    expect(service.applyCargaSemanas$).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('continúa un pendiente antiguo no destructivo con una sola acción', async () => {
    component.cargasPendientes.set([
      {
        id: 4,
        fileName: 'antigua.xlsx',
        createdAt: '2026-09-01T12:00:00Z',
        preview: {
          puedeAplicar: true,
          previewHash: 'a'.repeat(64),
          variantes: [{ codigo: 'GI6-8' }],
        },
        variantes: [{ codigo: 'GI6-8', planificacionMensualId: 207 }],
      } as any,
    ]);
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      of({
        cargaId: 4,
        estado: 'PUBLICADA',
        variantes: [{ codigo: 'GI6-8', planificacionId: 207 }],
        semanas: [],
        mensaje: 'Publicada',
      }),
    );
    component.continuarCargaPendiente(4);
    expect(confirmation.confirm).not.toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(service.publicarCargaSemanas$).toHaveBeenCalledWith(4);
    expect(service.applyCargaSemanas$).not.toHaveBeenCalled();
  });

  it('mantiene visible el pendiente si la publicación responde 409', async () => {
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    const pendiente = cargaPendiente([variante], 5, 'parcial.xlsx');
    component.cargasPendientes.set([pendiente]);
    (service.listarCargasPendientes$ as jest.Mock).mockReturnValue(
      of([pendiente]),
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { message: 'El plan cambió; previsualiza de nuevo.' },
          }),
      ),
    );
    await component.publicarCarga(5);
    expect(component.cargasPendientes()).toHaveLength(1);
    expect(component.cargasPendientes()[0].id).toBe(5);
    expect(component.errorCarga()).toContain('El plan cambió');
    component.abrirImportacionSemanas();
    await component.cargarCargasPendientes();
    fixture.detectChanges();
    const pendienteDom = document.querySelector(
      '.carga-directa__pendiente',
    ) as HTMLElement;
    expect(pendienteDom.textContent).toContain('Descarta esta importación');
    expect(
      botonPorTexto(pendienteDom, 'Continuar importación'),
    ).toBeUndefined();
  });

  it('marca un 409 de publicación como terminal y no reactiva Continuar al refrescar o reabrir', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of(preparacionCarga([variante], 9)),
    );
    (service.listarCargasPendientes$ as jest.Mock).mockReturnValue(
      of([cargaPendiente([variante], 9)]),
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              code: 'CARGA_PREVIEW_STALE',
              message: 'El plan cambió; previsualiza de nuevo.',
            },
          }),
      ),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    await component.importarSemanas();

    expect(component.cargasPendientes()).toHaveLength(1);
    expect(component.cargasPendientes()[0].id).toBe(9);
    expect(component.resultadoCarga()).toBeNull();
    expect(component.errorCarga()).toContain('El plan cambió');

    component.abrirImportacionSemanas();
    await component.cargarCargasPendientes();
    fixture.detectChanges();
    let pendiente = document.querySelector(
      '.carga-directa__pendiente',
    ) as HTMLElement;
    let texto = pendiente.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('semanas.xlsx');
    expect(texto).toContain('Comunidad de Madrid · Iniciación · 6-8 horas');
    expect(texto).toContain('05/10/2026');
    expect(texto).toContain('Descarta esta importación');
    expect(botonPorTexto(pendiente, 'Continuar importación')).toBeUndefined();
    expect(botonPorTexto(pendiente, 'Descartar')).toBeTruthy();

    await component.publicarCarga(9);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    component.continuarCargaPendiente(9);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);

    await component.cargarCargasPendientes();
    component.cambiarVisibilidadImportacion(false);
    component.abrirImportacionSemanas();
    await component.cargarCargasPendientes();
    fixture.detectChanges();
    pendiente = document.querySelector(
      '.carga-directa__pendiente',
    ) as HTMLElement;
    texto = pendiente.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('Descarta esta importación');
    expect(botonPorTexto(pendiente, 'Continuar importación')).toBeUndefined();
    expect(botonPorTexto(pendiente, 'Descartar')).toBeTruthy();
  });

  it('marca un 422 de publicación como terminal, conserva celdas y no reactiva Continuar', async () => {
    const resumenAnterior = resultadoPublicacion([
      {
        codigo: 'PCMI6-8H',
        hoja: 'CMI6-8',
        semana: 39,
        lunes: '2026-09-28',
        creados: 1,
        actualizados: 0,
        omitidos: 0,
        eliminados: 0,
        bloques: [],
      },
    ]);
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    const previewError = {
      fileName: 'semanas.xlsx',
      fileHash: 'f'.repeat(64),
      puedeAplicar: false,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 0,
        bloques: 0,
        entrenamientos: 0,
        errores: 1,
      },
      hojas: [
        {
          hoja: 'CMI6-8',
          valida: false,
          totalBloques: 0,
          totalEntrenamientos: 0,
          semanas: [],
          errores: [
            {
              hoja: 'CMI6-8',
              semana: 40,
              filaExcel: 12,
              celdas: ['A12', 'C12'],
              campo: 'fecha',
              mensaje: 'La fecha no es válida.',
            },
          ],
          warnings: [],
        },
      ],
    };
    component.resultadoPublicacion.set(resumenAnterior);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of(preparacionCarga([variante], 9)),
    );
    (service.listarCargasPendientes$ as jest.Mock).mockReturnValue(
      of([cargaPendiente([variante], 9)]),
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'CARGA_EXCEL_INVALIDO',
              message: 'Corrige los errores localizados del Excel.',
              preview: previewError,
            },
          }),
      ),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    await component.importarSemanas();

    expect(component.cargasPendientes()).toHaveLength(1);
    expect(component.cargasPendientes()[0].id).toBe(9);
    expect(component.resultadoCarga()).toBeNull();
    expect(component.previewImportacion()).toEqual(previewError);
    expect(component.resultadoPublicacion()).toEqual(resumenAnterior);

    component.abrirImportacionSemanas();
    await component.cargarCargasPendientes();
    fixture.detectChanges();
    const errores = document.querySelector(
      '.carga-directa__errores',
    ) as HTMLElement;
    let texto = errores.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('Fila 12');
    expect(texto).toContain('A12, C12');
    expect(texto).toContain('La fecha no es válida.');
    let pendiente = document.querySelector(
      '.carga-directa__pendiente',
    ) as HTMLElement;
    expect(pendiente.textContent).toContain('Descarta esta importación');
    expect(botonPorTexto(pendiente, 'Continuar importación')).toBeUndefined();
    expect(botonPorTexto(pendiente, 'Descartar')).toBeTruthy();

    await component.publicarCarga(9);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    component.continuarCargaPendiente(9);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);

    await component.cargarCargasPendientes();
    component.cambiarVisibilidadImportacion(false);
    component.abrirImportacionSemanas();
    await component.cargarCargasPendientes();
    fixture.detectChanges();
    pendiente = document.querySelector(
      '.carga-directa__pendiente',
    ) as HTMLElement;
    texto = pendiente.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('Descarta esta importación');
    expect(botonPorTexto(pendiente, 'Continuar importación')).toBeUndefined();
    expect(botonPorTexto(pendiente, 'Descartar')).toBeTruthy();
  });

  it('conserva el detalle del 422 al publicar e invalida la carga preparada sin borrar el éxito anterior', async () => {
    const resumenAnterior = resultadoPublicacion([
      {
        codigo: 'PCMI6-8H',
        hoja: 'CMI6-8',
        semana: 39,
        lunes: '2026-09-28',
        creados: 1,
        actualizados: 0,
        omitidos: 0,
        eliminados: 0,
        bloques: [],
      },
    ]);
    const previewObsoleta: PreviewCargaSemanas = {
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [varianteCarga([semanaCarga(40, '2026-10-05')])],
    };
    component.resultadoPublicacion.set(resumenAnterior);
    component.previewCarga.set(previewObsoleta);
    component.resultadoCarga.set(previewObsoleta);
    component.idempotencyKeyCarga = 'clave-anterior';
    component.confirmarSobrescritura.set(true);
    (service.listarCargasPendientes$ as jest.Mock).mockReturnValue(
      of([
        cargaPendiente(
          [varianteCarga([semanaCarga(40, '2026-10-05')])],
          5,
          'semanas.xlsx',
        ),
      ]),
    );
    const previewError = {
      fileName: 'semanas.xlsx',
      fileHash: 'f'.repeat(64),
      puedeAplicar: false,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 0,
        bloques: 0,
        entrenamientos: 0,
        errores: 1,
      },
      hojas: [
        {
          hoja: 'CMI6-8',
          valida: false,
          totalBloques: 0,
          totalEntrenamientos: 0,
          semanas: [],
          errores: [
            {
              hoja: 'CMI6-8',
              semana: 40,
              filaExcel: 12,
              celdas: ['A12', 'C12'],
              campo: 'fecha',
              mensaje: 'La fecha no es válida.',
            },
          ],
          warnings: [],
        },
      ],
    };
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'CARGA_EXCEL_INVALIDO',
              message: 'Corrige los errores localizados del Excel.',
              preview: previewError,
            },
          }),
      ),
    );

    await component.publicarCarga(5);
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    expect(component.previewImportacion()).toEqual(previewError);
    expect(component.previewCarga()).toBeNull();
    expect(component.resultadoCarga()).toBeNull();
    expect(component.idempotencyKeyCarga).toBeNull();
    expect(component.confirmarSobrescritura()).toBe(false);
    expect(component.resultadoPublicacion()).toEqual(resumenAnterior);
    expect(component.errorCarga()).toContain('No se publicó nada');
    expect(component.errorCarga()).toContain('descarta esta carga');

    const host = fixture.nativeElement as HTMLElement;
    const texto = host.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('CMI6-8');
    expect(texto).toContain('Semana 40');
    expect(texto).toContain('Fila 12');
    expect(texto).toContain('A12, C12');
    expect(texto).toContain('La fecha no es válida.');
    expect(texto).toContain('Excel importado');
    expect(texto).not.toContain('Excel preparado');
    expect(texto).not.toContain(
      'Previsualización: todavía no se ha guardado nada',
    );
    const pendienteDom = document.querySelector(
      '.carga-directa__pendiente',
    ) as HTMLElement;
    expect(pendienteDom.textContent).toContain('Descarta esta importación');
    expect(
      botonPorTexto(pendienteDom, 'Continuar importación'),
    ).toBeUndefined();
  });

  it('previsualiza sin pedir destinos al administrador', async () => {
    const file = new File(['xlsx'], 'sergio.xlsx');
    component.archivoImportacion.set(file);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of({ puedeAplicar: true, previewHash: 'a'.repeat(64), variantes: [] }),
    );
    await component.previsualizarCargaSemanas();
    expect(service.previewCargaSemanas$).toHaveBeenCalledWith(file);
  });

  it('explica el Excel sin semanas con contenido junto a la previsualización', () => {
    component.previewImportacion.set({
      fileName: 'vacio.xlsx',
      fileHash: 'a'.repeat(64),
      puedeAplicar: false,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 0,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [],
    });
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'El Excel no contiene semanas con actividades',
    );
  });

  it('mantiene visible el error de la carga semanal si el servidor no devuelve una previsualización', async () => {
    component.archivoImportacion.set(
      new File(['contenido'], 'semanas.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Corrige el Excel antes de guardar semanas.' },
          }),
      ),
    );

    await component.previsualizarCargaSemanas();
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    expect(component.errorCarga()).toBe(
      'Corrige el Excel antes de guardar semanas.',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Corrige el Excel antes de guardar semanas.',
    );
  });

  it('autoselecciona solo un borrador compatible y exige elegir cuando hay varios', () => {
    component.variantes.set([
      {
        codigo: 'MI4-6H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
      },
    ]);
    component.codigoImportacionSeleccionado.set('CMI4-6H');
    const compatible = {
      id: 17,
      identificador: 'MADRID-BORRADOR-1',
      mes: 10,
      ano: 2026,
      estado: 'BORRADOR',
      relevancia: [Oposicion.MADRID],
      tipoDePlanificacion:
        TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    } as PlanificacionMensual;
    component.planificacionesMensuales.set([
      compatible,
      {
        ...compatible,
        id: 18,
        identificador: 'OTRA-FRANJA',
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      },
    ]);

    component.seleccionarCodigoImportacion('CMI4-6H');
    expect(
      component.planificacionesBorradorOptions.map((op) => op.value),
    ).toEqual([17]);
    expect(component.planificacionDestinoImportacion()).toBe(17);

    component.planificacionesMensuales.set([
      compatible,
      { ...compatible, id: 19, identificador: 'MADRID-BORRADOR-2' },
    ]);
    component.seleccionarCodigoImportacion('CMI4-6H');
    expect(component.planificacionDestinoImportacion()).toBeNull();

    component.planificacionesMensuales.set([]);
    component.seleccionarCodigoImportacion('CMI4-6H');
    expect(component.planificacionesBorradorOptions).toEqual([]);
    expect(component.planificacionDestinoImportacion()).toBeNull();
  });

  it('explica cada variante y no trata un estado desconocido como borrador', () => {
    component.codigosUltimaImportacion.set(['CMI6-8H', 'CBAA4-6H']);
    expect(component.codigosImportacionOptions()).toEqual([
      {
        label: 'Comunidad de Madrid · Iniciación · 6-8 horas',
        value: 'CMI6-8H',
      },
      {
        label: 'Consorcio de Alicante · Avanzado · 4-6 horas',
        value: 'CBAA4-6H',
      },
    ]);
    component.codigoImportacionSeleccionado.set('CMI6-8H');
    component.variantes.set([
      {
        codigo: 'PCMI6-8H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        activa: true,
      },
    ]);
    component.planificacionesMensuales.set([
      {
        id: 20,
        identificador: 'SIN-ESTADO',
        relevancia: [Oposicion.MADRID],
        tipoDePlanificacion:
          TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      } as PlanificacionMensual,
    ]);
    expect(component.planificacionesBorradorOptions).toEqual([]);
  });

  it('abre la creación guiada conservando oposición, franja y contexto', () => {
    component.variantes.set([
      {
        codigo: 'MI4-6H',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        activa: true,
      },
    ]);
    component.codigosUltimaImportacion.set(['CMI4-6H', 'CMA4-6H']);
    component.codigoImportacionSeleccionado.set('CMI4-6H');

    component.crearBorradorParaImportacion();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion/planificacion-mensual', 'new'],
      {
        queryParams: {
          origen: 'importacion-plantillas',
          codigosHoja: ['CMI4-6H', 'CMA4-6H'],
          codigoActivo: 'CMI4-6H',
          fechaFoco: null,
          oposicion: Oposicion.MADRID,
          franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        },
      },
    );
  });

  it('normaliza el código de hoja de Sergio al sufijo de plantilla', async () => {
    const file = new File(['xlsx'], 'sergio.xlsx');
    component.archivoImportacion.set(file);
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'c'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 7,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [
        {
          hoja: 'GI6-8',
          valida: true,
          totalBloques: 7,
          totalEntrenamientos: 0,
          semanas: [
            {
              numero: 7,
              fechaInicio: '2026-02-09',
              bloques: 7,
              entrenamientos: 0,
              esqueleto: false,
            },
          ],
          errores: [],
          warnings: [],
        },
      ],
    });

    component.confirmarAplicacionImportacion();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();

    expect(component.codigosUltimaImportacion()).toEqual(['GI6-8H']);
  });

  it('separa el prefijo de plantilla del código canónico de variante', async () => {
    const file = new File(['xlsx'], 'madrid.xlsx');
    component.archivoImportacion.set(file);
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'e'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 1,
        semanas: 1,
        bloques: 1,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [
        {
          hoja: 'CMI6-8',
          valida: true,
          variante: {
            codigo: 'PCMI6-8H',
            oposicion: Oposicion.MADRID,
            nivel: NivelOposicion.INICIACION,
            franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
          },
          totalBloques: 1,
          totalEntrenamientos: 0,
          semanas: [
            {
              numero: 1,
              fechaInicio: '2026-02-09',
              bloques: 1,
              entrenamientos: 0,
              esqueleto: false,
            },
          ],
          errores: [],
          warnings: [],
        },
      ],
    });

    component.confirmarAplicacionImportacion();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();

    expect(component.codigosUltimaImportacion()).toEqual(['CMI6-8H']);
    expect(component.varianteImportacionSeleccionada?.codigo).toBe('PCMI6-8H');
  });

  it('normaliza y deduplica los códigos válidos de hoja antes del volcado', async () => {
    const file = new File(['xlsx'], 'variantes.xlsx');
    component.archivoImportacion.set(file);
    const hoja = (codigo: string) => ({
      hoja: codigo,
      valida: true,
      totalBloques: 1,
      totalEntrenamientos: 0,
      semanas: [
        {
          numero: 1,
          fechaInicio: '2026-02-09',
          bloques: 1,
          entrenamientos: 0,
          esqueleto: false,
        },
      ],
      errores: [],
      warnings: [],
    });
    component.previewImportacion.set({
      fileName: file.name,
      fileHash: 'd'.repeat(64),
      puedeAplicar: true,
      yaAplicado: false,
      requiereConfirmacionSobrescritura: false,
      sobrescrituras: [],
      totales: {
        hojas: 5,
        semanas: 5,
        bloques: 5,
        entrenamientos: 0,
        errores: 0,
      },
      hojas: [
        hoja('GI6-8'),
        hoja('GI6-8H'),
        hoja('H6-8'),
        hoja('14-6'),
        hoja('URG'),
      ],
    });

    component.confirmarAplicacionImportacion();
    const config = (confirmation.confirm as jest.Mock).mock.calls.at(-1)[0];
    await config.accept();

    expect(component.codigosUltimaImportacion()).toEqual([
      'GI6-8H',
      'H6-8',
      '14-6',
      'URG',
    ]);
  });

  it('resuelve la identidad de hoja sin depender del código de variante', () => {
    const identidad = identidadVarianteImportada;

    expect(identidad(' cmi6-8h ')).toEqual({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    });
    expect(identidad('CAI4-6')).toEqual({
      oposicion: Oposicion.ALICANTE_CPBA,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });
    expect(identidad('H6-8')).toBeNull();
    expect(identidad(null)).toBeNull();
  });

  it('normaliza aliases de hoja a la identidad real de las plantillas', () => {
    const normalizar = codigoPlantillaImportada;

    expect(normalizar('CAI6-8')).toBe('CBAI6-8H');
    expect(normalizar('AVI4-6H')).toBe('AYVI4-6H');
    expect(normalizar('CMI6-8')).toBe('CMI6-8H');
  });

  it('agrupa por año ISO y no finge intervalos continuos entre años o huecos', () => {
    const grupos = component.agruparSemanasPorAnioIso([
      semanaCarga(3, '2027-01-18'),
      semanaCarga(53, '2026-12-28'),
      semanaCarga(1, '2027-01-04'),
    ]);

    expect(grupos.map((grupo) => grupo.anioIso)).toEqual([2026, 2027]);
    expect(grupos[0].semanas.map((semana) => semana.numero)).toEqual([53]);
    expect(grupos[1].semanas.map((semana) => semana.numero)).toEqual([1, 3]);
    expect(grupos[1].intervalos).toHaveLength(2);
    expect(
      grupos[1].intervalos.map((intervalo) => intervalo.inicio.lunes),
    ).toEqual(['2027-01-04', '2027-01-18']);
  });

  it('bloquea el doble clic durante la preparación y la publicación', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    const preparacion = new Subject<PreviewCargaSemanas>();
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      preparacion.asObservable(),
    );
    const publicacion = new Subject<ResultadoPublicacionSemanas>();
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      publicacion.asObservable(),
    );
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    const primera = component.importarSemanas();
    const segunda = component.importarSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    expect(
      (document.querySelector('input[type="file"]') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(document.querySelector('.p-dialog-header-close')).toBeNull();
    component.cambiarVisibilidadImportacion(false);
    expect(component.dialogoImportacionVisible()).toBe(true);
    preparacion.next(preparacionCarga([variante]));
    preparacion.complete();
    await new Promise((resolve) => setTimeout(resolve));
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    expect(
      (document.querySelector('input[type="file"]') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(document.querySelector('.p-dialog-header-close')).toBeNull();

    const tercera = component.importarSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(component.resultadoPublicacion()).toBeNull();
    expect(TestBed.inject(ToastrService).success).not.toHaveBeenCalled();

    publicacion.next(
      resultadoPublicacion([
        {
          codigo: 'PCMI6-8H',
          hoja: 'CMI6-8',
          semana: 40,
          lunes: '2026-10-05',
          creados: 1,
          actualizados: 0,
          omitidos: 0,
          eliminados: 0,
          bloques: [],
        },
      ]),
    );
    publicacion.complete();
    await Promise.all([primera, segunda, tercera]);
    expect(component.resultadoPublicacion()).not.toBeNull();
    fixture.detectChanges();
    expect(document.querySelector('.p-dialog-header-close')).not.toBeNull();
    component.cambiarVisibilidadImportacion(false);
    expect(component.dialogoImportacionVisible()).toBe(false);
  });

  it('revisa el Excel automáticamente al seleccionarlo, sin escribir nada', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const preview = previewCarga([
      varianteCarga([semanaCarga(40, '2026-10-05')]),
    ]);
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(of(preview));
    await component.seleccionarArchivoImportacion(file);
    expect(service.previewCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.previewCargaSemanas$).toHaveBeenCalledWith(file);
    expect(service.applyCargaSemanas$).not.toHaveBeenCalled();
    expect(service.publicarCargaSemanas$).not.toHaveBeenCalled();
    expect(component.previewCarga()).toEqual(preview);
    expect(component.archivoImportacion()).toBe(file);
  });

  it('rechaza localmente un archivo vacío o con extensión no soportada', async () => {
    const toast = TestBed.inject(ToastrService);
    await component.seleccionarArchivoImportacion(
      new File([], 'vacio.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    expect(service.previewCargaSemanas$).not.toHaveBeenCalled();
    expect(component.archivoImportacion()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      'El archivo Excel está vacío. Selecciona otro archivo.',
    );

    await component.seleccionarArchivoImportacion(
      new File(['texto'], 'semanas.txt'),
    );
    expect(service.previewCargaSemanas$).not.toHaveBeenCalled();
    expect(component.archivoImportacion()).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      'Selecciona un Excel .xlsx o .xls de hasta 10 MB',
    );
  });

  it('muestra Revisando Excel mientras revisa y deshabilita el selector', async () => {
    const revision = new Subject<PreviewCargaSemanas>();
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      revision.asObservable(),
    );
    component.abrirImportacionSemanas();
    const revisionPendiente = component.seleccionarArchivoImportacion(
      new File(['xlsx'], 'semanas.xlsx'),
    );
    fixture.detectChanges();
    expect(component.previsualizandoImportacion()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Revisando Excel',
    );
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input.disabled).toBe(true);

    revision.next(previewCarga([]));
    revision.complete();
    await revisionPendiente;
    fixture.detectChanges();
    expect(component.previsualizandoImportacion()).toBe(false);
    expect(component.previewCarga()).not.toBeNull();
    expect(service.applyCargaSemanas$).not.toHaveBeenCalled();
  });

  it('muestra año ISO, semanas y fechas completas antes de desplegar actividades', () => {
    const preview: PreviewCargaSemanas = {
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [
        varianteCarga([
          semanaCarga(53, '2026-12-28'),
          semanaCarga(1, '2027-01-04'),
          semanaCarga(3, '2027-01-18'),
        ]),
      ],
    };
    component.previewCarga.set(preview);
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    const texto =
      (fixture.nativeElement as HTMLElement).textContent?.replace(
        /\s+/g,
        ' ',
      ) ?? '';

    expect(texto).toContain('Comunidad de Madrid · Iniciación · 6-8 horas');
    expect(texto).toContain('Destino: MADRID-6-8 v4');
    expect(texto).toContain('Año 2026');
    expect(texto).toContain('Año 2027');
    expect(texto).toContain('3 semanas');
    expect(texto).toContain('Semana 53 · 28/12/2026');
    expect(texto).toContain('Semana 1 · 04/01/2027');
    expect(texto).toContain('Semana 3 · 18/01/2027');
    expect(texto).not.toContain('Semana 2 ·');
    expect(texto).not.toContain('04/01/2027 – 18/01/2027');
    const detalle = (fixture.nativeElement as HTMLElement).querySelector(
      'details.carga-directa__detalle',
    ) as HTMLDetailsElement | null;
    expect(detalle?.open).toBe(false);
  });

  it('muestra avisos no bloqueantes plegados sin interpretar su mensaje como HTML', () => {
    component.previewCarga.set({
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      warnings: [
        {
          hoja: 'CMI6-8',
          semana: 40,
          mensaje: 'Metadatos <strong>copiados</strong> de la pestaña.',
        },
      ],
      variantes: [varianteCarga([semanaCarga(40, '2026-10-05')])],
    });
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const avisos = host.querySelector(
      'details.carga-directa__avisos',
    ) as HTMLDetailsElement | null;
    expect(avisos?.open).toBe(false);
    expect(avisos?.querySelector('summary')?.textContent).toContain(
      'Avisos del Excel (1)',
    );
    const aviso = host.querySelector('.carga-directa__aviso-mensaje');
    expect(aviso?.textContent).toContain(
      'Metadatos <strong>copiados</strong> de la pestaña.',
    );
    expect(aviso?.querySelector('strong')).toBeNull();
    const importar = Array.from(host.querySelectorAll('button')).find((boton) =>
      boton.textContent?.includes('Importar semanas'),
    );
    expect(importar?.disabled).toBe(false);
  });

  it('no muestra la sección de avisos cuando la respuesta no trae warnings', () => {
    component.previewCarga.set({
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [varianteCarga([semanaCarga(40, '2026-10-05')])],
    });
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.carga-directa__avisos',
      ),
    ).toBeNull();
  });

  it('conserva celdas y avisos del 422 y descarta la preview válida anterior', async () => {
    component.previewCarga.set({
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [varianteCarga([semanaCarga(40, '2026-10-05')])],
    });
    component.resultadoCarga.set({
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [varianteCarga([semanaCarga(40, '2026-10-05')])],
    });
    component.idempotencyKeyCarga = 'clave-anterior';
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'CARGA_EXCEL_INVALIDO',
              message: 'Corrige los errores localizados del Excel.',
              preview: {
                fileName: 'semanas.xlsx',
                fileHash: 'f'.repeat(64),
                puedeAplicar: false,
                yaAplicado: false,
                requiereConfirmacionSobrescritura: false,
                sobrescrituras: [],
                totales: {
                  hojas: 1,
                  semanas: 0,
                  bloques: 0,
                  entrenamientos: 0,
                  errores: 1,
                },
                hojas: [
                  {
                    hoja: 'CMI6-8',
                    valida: false,
                    totalBloques: 0,
                    totalEntrenamientos: 0,
                    semanas: [],
                    errores: [
                      {
                        hoja: 'CMI6-8',
                        semana: 40,
                        filaExcel: 12,
                        celdas: ['A12', 'C12'],
                        campo: 'fecha',
                        mensaje: 'La fecha no es válida.',
                      },
                    ],
                    warnings: [
                      {
                        hoja: 'CMI6-8',
                        semana: 40,
                        mensaje: 'Se copiaron metadatos de la pestaña.',
                      },
                    ],
                  },
                ],
              },
            },
          }),
      ),
    );

    await component.seleccionarArchivoImportacion(
      new File(['xlsx'], 'semanas.xlsx'),
    );
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    expect(component.previewCarga()).toBeNull();
    expect(component.resultadoCarga()).toBeNull();
    expect(component.idempotencyKeyCarga).toBeNull();
    const host = fixture.nativeElement as HTMLElement;
    const texto = host.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('A12, C12');
    expect(texto).toContain('La fecha no es válida.');
    expect(texto).toContain('Se copiaron metadatos de la pestaña.');
    const avisos = host.querySelector(
      'details.carga-directa__avisos',
    ) as HTMLDetailsElement | null;
    expect(avisos?.open).toBe(false);
    expect(
      Array.from(host.querySelectorAll('button')).some((boton) =>
        boton.textContent?.includes('Importar semanas'),
      ),
    ).toBe(false);
  });

  it('sigue representando errores 422 antiguos sin celdas', async () => {
    component.archivoImportacion.set(new File(['xlsx'], 'antiguo.xlsx'));
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              message: 'Corrige el Excel.',
              preview: {
                fileName: 'antiguo.xlsx',
                fileHash: 'f'.repeat(64),
                puedeAplicar: false,
                yaAplicado: false,
                requiereConfirmacionSobrescritura: false,
                sobrescrituras: [],
                totales: {
                  hojas: 1,
                  semanas: 0,
                  bloques: 0,
                  entrenamientos: 0,
                  errores: 1,
                },
                hojas: [
                  {
                    hoja: 'CMI6-8',
                    valida: false,
                    totalBloques: 0,
                    totalEntrenamientos: 0,
                    semanas: [],
                    errores: [
                      {
                        hoja: 'CMI6-8',
                        semana: 40,
                        filaExcel: 12,
                        campo: 'fecha',
                        mensaje: 'La fecha no es válida.',
                      },
                    ],
                    warnings: [],
                  },
                ],
              },
            },
          }),
      ),
    );

    await component.previsualizarCargaSemanas();
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    const texto =
      (fixture.nativeElement as HTMLElement).textContent?.replace(
        /\s+/g,
        ' ',
      ) ?? '';
    expect(texto).toContain('La fecha no es válida.');
    expect(texto).not.toContain('Celdas A12');
  });

  it('conserva el cargaId si falla la publicación y reintenta sin preparar otra carga', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    let pendienteVisible = true;
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of(preparacionCarga([variante])),
    );
    (service.listarCargasPendientes$ as jest.Mock).mockImplementation(() =>
      of(pendienteVisible ? [cargaPendiente([variante], 9)] : []),
    );
    (service.publicarCargaSemanas$ as jest.Mock)
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 500,
              error: { message: 'La publicación no respondió.' },
            }),
        ),
      )
      .mockImplementation(() => {
        pendienteVisible = false;
        return of(
          resultadoPublicacion(
            [
              {
                codigo: 'PCMI6-8H',
                hoja: 'CMI6-8',
                semana: 40,
                lunes: '2026-10-05',
                creados: 1,
                actualizados: 0,
                omitidos: 0,
                eliminados: 0,
                bloques: [],
              },
            ],
            { cargaId: 9 },
          ),
        );
      });
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();

    await component.importarSemanas();
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(component.resultadoCarga()?.cargaId).toBe(9);
    expect(component.resultadoPublicacion()).toBeNull();
    expect(component.errorCarga()).toContain('La publicación no respondió.');
    component.abrirImportacionSemanas();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Importación sin terminar');
    expect(host.textContent).toContain('semanas.xlsx');
    expect(host.textContent).toContain('05/10/2026');
    expect(botonPorTexto(host, 'Continuar importación')).toBeTruthy();
    expect(host.textContent).not.toContain('Descarta esta importación');

    await component.publicarCarga(9);
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(2);
    expect(component.resultadoPublicacion()?.cargaId).toBe(9);
    expect(component.resultadoCarga()).toBeNull();
    fixture.detectChanges();
    expect(botonPorTexto(host, 'Continuar importación')).toBeUndefined();
  });

  it('mantiene reintentable un fallo de red y no vuelve a preparar', async () => {
    const file = new File(['xlsx'], 'semanas.xlsx');
    const variante = varianteCarga([semanaCarga(40, '2026-10-05')]);
    let pendienteVisible = true;
    (service.previewCargaSemanas$ as jest.Mock).mockReturnValue(
      of(previewCarga([variante])),
    );
    (service.applyCargaSemanas$ as jest.Mock).mockReturnValue(
      of(preparacionCarga([variante], 9)),
    );
    (service.listarCargasPendientes$ as jest.Mock).mockImplementation(() =>
      of(pendienteVisible ? [cargaPendiente([variante], 9)] : []),
    );
    (service.publicarCargaSemanas$ as jest.Mock)
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 0,
              error: new Error('sin respuesta'),
            }),
        ),
      )
      .mockImplementation(() => {
        pendienteVisible = false;
        return of(resultadoPublicacion([], { cargaId: 9 }));
      });
    component.archivoImportacion.set(file);
    await component.previsualizarCargaSemanas();
    await component.importarSemanas();

    expect(component.resultadoCarga()?.cargaId).toBe(9);
    component.dialogoImportacionVisible.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(botonPorTexto(host, 'Continuar importación')).toBeTruthy();
    expect(host.textContent).not.toContain('Descarta esta importación');

    await component.publicarCarga(9);
    expect(service.applyCargaSemanas$).toHaveBeenCalledTimes(1);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(2);
    expect(component.resultadoCarga()).toBeNull();
  });

  it('publica y conserva un resumen con contadores reales, años y enlaces canónicos', async () => {
    const resultado = resultadoPublicacion(
      [
        {
          codigo: 'PCMI6-8H',
          hoja: 'CMI6-8',
          semana: 40,
          lunes: '2026-10-05',
          creados: 0,
          actualizados: 0,
          omitidos: 100,
          eliminados: 0,
          bloques: [],
        },
        {
          codigo: 'PCMI6-8H',
          hoja: 'CMI6-8',
          semana: 41,
          lunes: '2026-10-12',
          creados: 0,
          actualizados: 0,
          omitidos: 68,
          eliminados: 0,
          bloques: [],
        },
      ],
      {
        warnings: [
          {
            hoja: 'CMI6-8',
            semana: 40,
            mensaje: 'Se copiaron metadatos de la pestaña.',
          },
        ],
      },
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(of(resultado));

    await component.publicarCarga(3);
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const texto = host.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(component.resultadoPublicacion()).toEqual(resultado);
    expect(texto).toContain('Excel importado');
    expect(texto).toContain('Comunidad de Madrid · Iniciación · 6-8 horas');
    expect(texto).toContain('Año 2026');
    expect(texto).toContain('Semana 40 · 05/10/2026');
    expect(texto).toContain('Semana 41 · 12/10/2026');
    expect(texto).toContain('Se copiaron metadatos de la pestaña.');
    expect(router.navigate).not.toHaveBeenCalled();

    const detalle = host.querySelector(
      'details.carga-directa__detalle',
    ) as HTMLDetailsElement | null;
    expect(detalle?.open).toBe(false);
    expect(detalle?.querySelector('summary')?.textContent).toContain(
      'Ver detalles',
    );
    expect(detalle?.textContent).toContain('0 añadidos');
    expect(detalle?.textContent).toContain('168 sin cambios');
    expect(detalle?.textContent).toContain('Sin cambios reales');
    const avisos = host.querySelector(
      'details.carga-directa__avisos',
    ) as HTMLDetailsElement | null;
    expect(avisos?.open).toBe(false);
    expect(avisos?.querySelector('summary')?.textContent).toContain(
      'Avisos del Excel (1)',
    );

    const enlaces = Array.from(
      host.querySelectorAll(
        'a[href*="/app/planificacion/planificacion-mensual/207"]',
      ),
    );
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute('href')).toContain('fechaFoco=2026-10-05');
    expect(enlaces[1].getAttribute('href')).toContain('fechaFoco=2026-10-12');
    expect(enlaces[0].textContent).toContain('Ver semana importada');
  });

  it('agrupa el resumen por perfil y separa los años ISO de cada uno', async () => {
    const resultado = resultadoPublicacion(
      [
        {
          codigo: 'PCMI6-8H',
          hoja: 'CMI6-8',
          semana: 53,
          lunes: '2026-12-28',
          creados: 1,
          actualizados: 0,
          omitidos: 0,
          eliminados: 0,
          bloques: [],
        },
        {
          codigo: 'PCMI6-8H',
          hoja: 'CMI6-8',
          semana: 1,
          lunes: '2027-01-04',
          creados: 0,
          actualizados: 1,
          omitidos: 0,
          eliminados: 0,
          bloques: [],
        },
        {
          codigo: 'PGI4-6H',
          hoja: 'GI4-6',
          semana: 2,
          lunes: '2027-01-11',
          creados: 0,
          actualizados: 0,
          omitidos: 0,
          eliminados: 1,
          bloques: [],
        },
      ],
      {
        variantes: [
          { codigo: 'PCMI6-8H', planificacionId: 207 },
          { codigo: 'PGI4-6H', planificacionId: 208 },
        ],
      },
    );
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(of(resultado));

    await component.publicarCarga(3);
    component.abrirImportacionSemanas();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelectorAll('.carga-directa__perfil-publicado'),
    ).toHaveLength(2);
    const texto = host.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(texto).toContain('Año 2026');
    expect(texto).toContain('Año 2027');
    expect(texto).toContain('1 añadido');
    expect(texto).toContain('1 actualizado');
    expect(texto).toContain('1 retirado');
    const enlaceOtroPerfil = host.querySelector(
      'a[href*="/app/planificacion/planificacion-mensual/208"]',
    );
    expect(enlaceOtroPerfil?.getAttribute('href')).toContain(
      'fechaFoco=2027-01-11',
    );
  });

  it('mantiene el resumen al cerrar/reabrir y solo lo descarta por acción explícita o nuevo archivo', async () => {
    const resultado = resultadoPublicacion([
      {
        codigo: 'PCMI6-8H',
        hoja: 'CMI6-8',
        semana: 40,
        lunes: '2026-10-05',
        creados: 1,
        actualizados: 0,
        omitidos: 0,
        eliminados: 0,
        bloques: [],
      },
    ]);
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(of(resultado));

    await component.publicarCarga(3);
    component.abrirImportacionSemanas();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Excel importado');
    expect(
      Array.from(host.querySelectorAll('button')).some((boton) =>
        boton.textContent?.includes('Descartar resumen'),
      ),
    ).toBe(false);

    component.cambiarVisibilidadImportacion(false);
    component.abrirImportacionSemanas();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Excel importado',
    );

    component.descartarResumenPublicacion();
    fixture.detectChanges();
    expect(component.resultadoPublicacion()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Excel importado',
    );

    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(of(resultado));
    await component.publicarCarga(3);
    expect(component.resultadoPublicacion()).not.toBeNull();
    component.seleccionarArchivoImportacion(
      new File(['xlsx'], 'nuevo.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    expect(component.resultadoPublicacion()).toBeNull();
  });

  it('protege la publicación con doble clic y conserva el resumen si falla el refresco', async () => {
    const resultado = resultadoPublicacion([
      {
        codigo: 'PCMI6-8H',
        hoja: 'CMI6-8',
        semana: 40,
        lunes: '2026-10-05',
        creados: 1,
        actualizados: 0,
        omitidos: 0,
        eliminados: 0,
        bloques: [],
      },
    ]);
    const publicacion = new Subject<ResultadoPublicacionSemanas>();
    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(
      publicacion.asObservable(),
    );

    const primera = component.publicarCarga(3);
    const segunda = component.publicarCarga(3);
    expect(service.publicarCargaSemanas$).toHaveBeenCalledTimes(1);
    publicacion.next(resultado);
    publicacion.complete();
    await Promise.all([primera, segunda]);
    expect(component.resultadoPublicacion()).toEqual(resultado);

    (service.publicarCargaSemanas$ as jest.Mock).mockReturnValue(of(resultado));
    (service.getVariantes$ as jest.Mock).mockReturnValue(
      throwError(() => new Error('fallo de refresco')),
    );
    await component.publicarCarga(3);
    expect(component.resultadoPublicacion()).toEqual(resultado);
  });
});
