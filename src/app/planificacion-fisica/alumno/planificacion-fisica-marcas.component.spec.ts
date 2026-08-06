import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
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
      id: 3,
      codigo: 'CARRERA_60',
      nombre: 'Carrera 60 m',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      unidadSugerida: 'seg',
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
    expect(component['grupos']()).toHaveLength(1);
    expect(component['grupos']()[0].marcas).toHaveLength(2);
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-marcas-grupo-3"]')),
    ).toBeTruthy();
  });

  it('usa el catálogo para seleccionar una prueba y sugerir la unidad', async () => {
    await cargar();
    expect(component['pruebaOpciones']()).toEqual([
      expect.objectContaining({ pruebaFisicaId: 3, nombre: 'Carrera 60 m' }),
      expect.objectContaining({ pruebaFisicaId: -1, nombre: 'Otra prueba…' }),
    ]);
    component['onPruebaChange'](3);
    expect(component['form'].controls.unidad.value).toBe('seg');
  });

  it('envía pruebaFisicaId, nunca disciplinaId, al guardar una marca oficial', async () => {
    await cargar();
    component['form'].setValue({
      pruebaFisicaId: 3,
      nombreLibre: '',
      valor: 7.1,
      unidad: 'seg',
      fecha: new Date(2026, 6, 5),
      notas: '',
    });
    await component['guardarMarca']();
    expect(serviceMock.crearMarca).toHaveBeenCalledWith({
      pruebaFisicaId: 3,
      valor: 7.1,
      unidad: 'seg',
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
});
