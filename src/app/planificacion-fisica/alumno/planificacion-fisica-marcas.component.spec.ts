import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import {
  MarcaPersonal,
  PlanificacionFisicaService,
  PruebaFisicaCatalogo,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaMarcasComponent } from './planificacion-fisica-marcas.component';

describe('PlanificacionFisicaMarcasComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaMarcasComponent>;
  let component: PlanificacionFisicaMarcasComponent;
  let serviceMock: any;

  const catalogo: PruebaFisicaCatalogo[] = [
    {
      id: 1,
      codigo: 'CUERDA',
      nombre: 'Cuerda',
      grupo: 'CUERDA',
      color: '#ffd1dc',
      unidad: 'm',
      mejorEsMenor: false,
    },
    {
      id: 3,
      codigo: 'CARRERA_60',
      nombre: 'Carrera 60 m',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      unidad: 'seg',
      mejorEsMenor: true,
    },
    {
      id: 7,
      codigo: 'PRESS_BANCA',
      nombre: 'Press de banca',
      grupo: 'FUERZA',
      color: '#c8e6c9',
      unidad: null,
      mejorEsMenor: false,
    },
  ];

  const marcas: MarcaPersonal[] = [
    {
      id: 1,
      pruebaFisicaId: 3,
      pruebaNombre: 'Carrera 60 m',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      valor: 7.2,
      unidad: 'seg',
      fecha: '2026-07-10',
      notas: null,
      mejorEsMenor: true,
      unidadCanonica: 'seg',
    },
    {
      id: 2,
      pruebaFisicaId: 3,
      pruebaNombre: 'Carrera 60 m',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      valor: 7.3,
      unidad: 'seg',
      fecha: '2026-06-01',
      notas: null,
      mejorEsMenor: true,
      unidadCanonica: 'seg',
    },
    {
      id: 3,
      pruebaFisicaId: 1,
      pruebaNombre: 'Cuerda',
      grupo: 'CUERDA',
      color: '#ffd1dc',
      valor: 10,
      unidad: 'm',
      fecha: '2026-07-01',
      notas: null,
      mejorEsMenor: false,
      unidadCanonica: 'm',
    },
  ];

  beforeEach(async () => {
    serviceMock = {
      marcas: jest.fn().mockReturnValue(of(marcas)),
      catalogoPruebas: jest.fn().mockReturnValue(of(catalogo)),
      crearMarca: jest.fn().mockReturnValue(of(marcas[0])),
      borrarMarca: jest.fn().mockReturnValue(of({ ok: true })),
    };
    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaMarcasComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        ConfirmationService,
        PrimeNGConfig,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(PlanificacionFisicaMarcasComponent);
    component = fixture.componentInstance;
  });

  async function cargar() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('carga el catálogo filtrado y agrupa el histórico por prueba física', async () => {
    await cargar();
    expect(serviceMock.catalogoPruebas).toHaveBeenCalled();
    expect(component['grupos']()).toHaveLength(2);
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-marcas-grupo-3"]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-marcas-grupo-1"]')),
    ).toBeTruthy();
  });

  it('usa el catálogo para seleccionar una prueba y bloquear su unidad canónica', async () => {
    await cargar();
    expect(component['pruebaOpciones']()).toEqual([
      expect.objectContaining({ pruebaFisicaId: 3, nombre: 'Carrera 60 m' }),
      expect.objectContaining({ pruebaFisicaId: 1, nombre: 'Cuerda' }),
      expect.objectContaining({
        pruebaFisicaId: 7,
        nombre: 'Press de banca',
      }),
      expect.objectContaining({ pruebaFisicaId: -1, nombre: 'Otra prueba…' }),
    ]);
    component['onPruebaChange'](3);
    expect(component['form'].controls.unidad.value).toBe('seg');
    expect(component['unidadBloqueada']()).toBe(true);
    expect(component['esEntradaTiempo']()).toBe(true);
  });

  it('permite editar la unidad para pruebas sin unidad canónica', async () => {
    await cargar();
    component['onPruebaChange'](7);
    expect(component['form'].controls.unidad.enabled).toBe(true);
    expect(component['unidadBloqueada']()).toBe(false);
  });

  it('limpia la unidad al cambiar a "Otra prueba…"', async () => {
    await cargar();
    component['onPruebaChange'](3);
    expect(component['form'].controls.unidad.value).toBe('seg');
    component['onPruebaChange'](-1);
    expect(component['form'].controls.unidad.value).toBe('');
    expect(component['form'].controls.unidad.enabled).toBe(true);
  });

  it('no permite editar la unidad de una prueba con unidad canónica', async () => {
    await cargar();
    component['onPruebaChange'](3);
    expect(component['form'].controls.unidad.disabled).toBe(true);
  });

  it('parsea mm:ss al guardar una marca de tiempo', async () => {
    await cargar();
    component['onPruebaChange'](3);
    component['form'].controls.valorTexto.setValue('12:34');
    component['form'].controls.fecha.setValue(new Date(2026, 6, 5));
    await component['guardarMarca']();
    expect(serviceMock.crearMarca).toHaveBeenCalledWith(
      expect.objectContaining({
        pruebaFisicaId: 3,
        valor: 754,
        unidad: 'seg',
        fecha: '2026-07-05',
      }),
    );
  });

  it('rechaza un tiempo inválido', async () => {
    await cargar();
    component['onPruebaChange'](3);
    component['form'].controls.valorTexto.setValue('12:60');
    component['form'].controls.valorTexto.markAsTouched();
    expect(component['form'].invalid).toBe(true);
  });

  it('envía pruebaFisicaId, nunca disciplinaId, al guardar una marca oficial', async () => {
    await cargar();
    component['onPruebaChange'](1);
    component['form'].controls.valor.setValue(15);
    component['form'].controls.fecha.setValue(new Date(2026, 6, 5));
    await component['guardarMarca']();
    expect(serviceMock.crearMarca).toHaveBeenCalledWith({
      pruebaFisicaId: 1,
      valor: 15,
      unidad: 'm',
      fecha: '2026-07-05',
    });
  });

  it('mantiene la reactividad de Otra prueba y envía nombreLibre', async () => {
    await cargar();
    component['form'].controls.pruebaFisicaId.setValue(-1);
    component['onPruebaChange'](-1);
    fixture.detectChanges();
    expect(component['esOtraPruebaSeleccionada']()).toBe(true);
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="pf-marcas-input-nombre-libre"]'),
      ),
    ).toBeTruthy();
    component['form'].setValue({
      pruebaFisicaId: -1,
      nombreLibre: 'Lanzamiento',
      valor: 4,
      valorTexto: '',
      unidad: 'm',
      fecha: new Date(2026, 6, 5),
      notas: '',
    });
    await component['guardarMarca']();
    expect(serviceMock.crearMarca).toHaveBeenCalledWith({
      nombreLibre: 'Lanzamiento',
      valor: 4,
      unidad: 'm',
      fecha: '2026-07-05',
    });
  });

  it('muestra error si falla el catálogo y no miente con un selector vacío', async () => {
    serviceMock.catalogoPruebas.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    await cargar();
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-marcas-error"]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="pf-marcas-sin-pruebas"]'),
      ),
    ).toBeFalsy();
  });

  describe('stats y gráfica', () => {
    it('calcula la mejor marca (PR) y la última por grupo', async () => {
      await cargar();
      const grupoCarrera = component['grupos']().find(
        (g) => g.pruebaFisicaId === 3,
      );
      expect(grupoCarrera?.mejorMarca?.id).toBe(1);
      expect(grupoCarrera?.ultimaMarca?.id).toBe(1);
      expect(grupoCarrera?.anteriorMarca?.id).toBe(2);
    });

    it('calcula la progresión direction-aware (menor es mejor para tiempos)', async () => {
      await cargar();
      const grupoCarrera = component['grupos']().find(
        (g) => g.pruebaFisicaId === 3,
      );
      // Última (7.2) vs anterior (7.3): -0.1 → mejora
      expect(grupoCarrera?.progresion).toBeCloseTo(-0.1);
      expect(grupoCarrera?.progresionEsMejora).toBe(true);
    });

    it('ordena los datos de la gráfica cronológicamente ascendente', async () => {
      await cargar();
      const grupoCarrera = component['grupos']().find(
        (g) => g.pruebaFisicaId === 3,
      );
      expect(grupoCarrera?.marcasGrafica.map((m) => m.id)).toEqual([2, 1]);
    });

    it('muestra la gráfica solo cuando hay ≥2 marcas con la misma unidad', async () => {
      await cargar();
      const grupoCarrera = component['grupos']().find(
        (g) => g.pruebaFisicaId === 3,
      );
      const grupoCuerda = component['grupos']().find(
        (g) => g.pruebaFisicaId === 1,
      );
      expect(grupoCarrera?.mostrarGrafica).toBe(true);
      expect(grupoCuerda?.mostrarGrafica).toBe(false);
    });

    it('excluye de la gráfica las marcas con unidad distinta a la canónica', async () => {
      const marcasConUnidadDistinta: MarcaPersonal[] = [
        {
          id: 10,
          pruebaFisicaId: 3,
          pruebaNombre: 'Carrera 60 m',
          grupo: 'CARRERA',
          color: '#fdeaa8',
          valor: 7.2,
          unidad: 'seg',
          fecha: '2026-07-10',
          notas: null,
          mejorEsMenor: true,
          unidadCanonica: 'seg',
        },
        {
          id: 11,
          pruebaFisicaId: 3,
          pruebaNombre: 'Carrera 60 m',
          grupo: 'CARRERA',
          color: '#fdeaa8',
          valor: 1.2,
          unidad: 'min',
          fecha: '2026-06-01',
          notas: null,
          mejorEsMenor: true,
          unidadCanonica: 'seg',
        },
      ];
      serviceMock.marcas.mockReturnValue(of(marcasConUnidadDistinta));
      await cargar();
      const grupo = component['grupos']().find((g) => g.pruebaFisicaId === 3);
      expect(grupo?.marcasGrafica.length).toBe(1);
      expect(grupo?.mostrarGrafica).toBe(false);
    });

    it('resalta el punto del PR en los datos de la gráfica', async () => {
      await cargar();
      const grupoCarrera = component['grupos']().find(
        (g) => g.pruebaFisicaId === 3,
      );
      const data = grupoCarrera?.chartData as {
        datasets: Array<{
          pointRadius: number[];
          pointBackgroundColor: string[];
        }>;
      };
      // Mejor marca = 7.2 (índice 1 en orden cronológico ascendente)
      expect(data?.datasets[0].pointRadius[1]).toBe(7);
      expect(data?.datasets[0].pointRadius[0]).toBe(4);
      expect(data?.datasets[0].pointBackgroundColor[1]).not.toBe(
        data?.datasets[0].pointBackgroundColor[0],
      );
    });
  });
});
