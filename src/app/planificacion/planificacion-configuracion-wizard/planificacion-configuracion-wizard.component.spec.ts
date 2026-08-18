import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { PlanificacionConfiguracionWizardComponent } from './planificacion-configuracion-wizard.component';

const configuracion: ConfiguracionPlanificacion = {
  estado: 'REQUIERE_CONFIGURACION',
  preferenciasPrecargadas: {
    oposicion: Oposicion.ALICANTE_CPBA,
    nivel: null,
    franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
  },
  oposicionesPermitidas: [
    Oposicion.GENERAL,
    Oposicion.ALICANTE_CPBA,
    Oposicion.MADRID,
  ],
  configuracionActiva: null,
  ultimaRecomendacion: null,
};

describe('PlanificacionConfiguracionWizardComponent', () => {
  let component: PlanificacionConfiguracionWizardComponent;
  let fixture: ComponentFixture<PlanificacionConfiguracionWizardComponent>;
  let service: AutoasignacionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanificacionConfiguracionWizardComponent],
      providers: [
        {
          provide: AutoasignacionService,
          useValue: {
            recomendarNivel$: jest.fn(() =>
              of({ puntuacion: 12, nivelRecomendado: 'AVANZADO' }),
            ),
            guardarConfiguracion$: jest.fn(() => of(configuracion)),
          },
        },
        {
          provide: ToastrService,
          useValue: {
            error: jest.fn(),
            success: jest.fn(),
            warning: jest.fn(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    service = TestBed.inject(AutoasignacionService);
    fixture = TestBed.createComponent(
      PlanificacionConfiguracionWizardComponent,
    );
    component = fixture.componentInstance;
    component.configuracion = configuracion;
    fixture.detectChanges();
  });

  it('precarga las preferencias desde preferenciasPrecargadas', () => {
    expect(component.preferencias.oposicion).toBe('ALICANTE_CPBA');
    expect(component.preferencias.franja).toBe('FRANJA_CUATRO_A_SEIS_HORAS');
  });

  it('no puede continuar sin oposición o franja', () => {
    component.preferencias = { oposicion: null, nivel: null, franja: null };
    expect(component.puedeContinuarPasoPreferencias).toBe(false);
  });

  it('si elige GENERAL, exige confirmación GCV para continuar', () => {
    component.preferencias = {
      oposicion: Oposicion.GENERAL,
      nivel: null,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    };
    component.gcvConfirmado = false;
    expect(component.requiereConfirmacionGCV).toBe(true);
    expect(component.puedeContinuarPasoPreferencias).toBe(false);

    component.confirmarGCV();
    expect(component.puedeContinuarPasoPreferencias).toBe(true);
  });

  it('obtiene la recomendación y la aplica al nivel', async () => {
    component.respuestas = [3, 2, 3, 1, 3];
    await component.obtenerRecomendacion();

    expect(service.recomendarNivel$).toHaveBeenCalledWith([3, 2, 3, 1, 3]);
    expect(component.recomendacion?.nivelRecomendado).toBe('AVANZADO');
    expect(component.preferencias.nivel).toBe('AVANZADO');
  });

  it('guarda la configuración con oposición, nivel, franja y versión', async () => {
    component.preferencias = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    };
    const emitSpy = jest.spyOn(component.configurada, 'emit');

    await component.guardarConfiguracion();

    expect(service.guardarConfiguracion$).toHaveBeenCalledWith({
      oposicion: Oposicion.MADRID,
      nivel: 'AVANZADO',
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
      version: 0,
    });
    expect(emitSpy).toHaveBeenCalled();
  });

  it('detecta cuando hay una configuración anterior', () => {
    component.configuracion = {
      ...configuracion,
      configuracionActiva: {
        variante: {
          codigo: 'CA4-6',
          oposicion: Oposicion.ALICANTE_CPBA,
          nivel: NivelOposicion.AVANZADO,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
        },
        version: 3,
        fechaVigencia: '2026-08-01',
        origen: 'ONBOARDING',
      },
    };
    expect(component.hayConfiguracionAnterior).toBe(true);
    expect(component.configuracionAnterior?.codigo).toBe('CA4-6');
  });
});
