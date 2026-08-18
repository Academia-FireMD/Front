import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import { PlanificacionAdminComponent } from './planificacion-admin.component';

class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('PlanificacionAdminComponent', () => {
  let component: PlanificacionAdminComponent;
  let fixture: ComponentFixture<PlanificacionAdminComponent>;
  let service: AutoasignacionService;

  beforeAll(() => {
    // PrimeNG Table/TabView requieren ResizeObserver en el entorno de test.
    (globalThis as any).ResizeObserver = ResizeObserverMock;
  });

  beforeEach(async () => {
    const serviceMock = {
      getVariantes$: jest.fn(() => of([])),
      getReglas$: jest.fn(() => of([])),
      getSinCoincidencia$: jest.fn(() => of([])),
      crearVariante$: jest.fn(() => of({})),
      actualizarVariante$: jest.fn(() => of({})),
      crearRegla$: jest.fn(() => of({})),
      actualizarRegla$: jest.fn(() => of({})),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionAdminComponent],
      providers: [
        { provide: AutoasignacionService, useValue: serviceMock },
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), success: jest.fn() },
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

  it('carga variantes, reglas y sin-coincidencia al iniciar', () => {
    expect(service.getVariantes$).toHaveBeenCalled();
    expect(service.getReglas$).toHaveBeenCalled();
    expect(service.getSinCoincidencia$).toHaveBeenCalled();
  });

  it('crea una variante nueva con el payload correcto', async () => {
    component.varianteForm.patchValue({
      codigo: 'GA4-6',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      activa: true,
    });
    await component.guardarVariante();

    expect(service.crearVariante$).toHaveBeenCalledWith({
      codigo: 'GA4-6',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      activa: true,
    });
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
    component.varianteForm.patchValue({ activa: false });
    await component.guardarVariante();

    expect(service.actualizarVariante$).toHaveBeenCalledWith(7, {
      codigo: 'GA6-8',
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
      activa: false,
    });
  });

  it('crea una regla de oposición', async () => {
    component.reglaForm.patchValue({
      oposicionSuscripcion: Oposicion.MADRID,
      oposicionPlanificacion: Oposicion.MADRID,
      activa: true,
    });
    await component.guardarRegla();

    expect(service.crearRegla$).toHaveBeenCalledWith({
      oposicionSuscripcion: Oposicion.MADRID,
      oposicionPlanificacion: Oposicion.MADRID,
      activa: true,
    });
  });
});
