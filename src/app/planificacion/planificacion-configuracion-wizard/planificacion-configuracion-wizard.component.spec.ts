import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { PlanificacionPreferenciasComponent } from '../../shared/planificacion-preferencias/planificacion-preferencias.component';
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
  estadoTest: null,
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
            getCuestionarioNivel$: jest.fn(),
            recomendarNivel$: jest.fn(),
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

  it('limita preferencias a las combinaciones publicadas desde el primer paso', () => {
    const preferencias = fixture.debugElement.query(
      By.directive(PlanificacionPreferenciasComponent),
    ).componentInstance as PlanificacionPreferenciasComponent;

    expect(preferencias.mostrarNivel).toBe(false);
    expect(preferencias.oposicionContext).toBe('planificacion');
    expect(preferencias.mostrarAyudaSuscripciones).toBe(true);

    component.activeStep.set(1);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Hacer test de nivel');
    expect(fixture.nativeElement.querySelectorAll('#wizardNivel')).toHaveLength(
      1,
    );
  });

  it('explica que el selector solo muestra oposiciones incluidas en suscripciones activas', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain(
      'Solo se muestran las oposiciones incluidas en tus suscripciones activas.',
    );
  });

  it('abre directamente el paso Nivel al llegar con un borrador completo de ficha', () => {
    component.abrirEnNivel = true;
    component.ngOnInit();

    expect(component.activeStep()).toBe(1);
  });

  it('no puede continuar sin oposición o franja', () => {
    component.preferencias = { oposicion: null, nivel: null, franja: null };
    expect(component.puedeContinuarPasoPreferencias).toBe(false);
  });

  it('conserva la franja elegida antes del nivel y ofrece solo niveles compatibles', () => {
    component.configuracion = {
      ...configuracion,
      opcionesPermitidas: [
        {
          oposicion: Oposicion.MADRID,
          nivel: NivelOposicion.AVANZADO,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
          varianteId: 1,
          planificacionMensual: null,
        },
        {
          oposicion: Oposicion.MADRID,
          nivel: NivelOposicion.INICIACION,
          franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
          varianteId: 2,
          planificacionMensual: null,
        },
      ],
    };

    component.onPreferenciasChange({
      oposicion: Oposicion.MADRID,
      nivel: null,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    });

    expect(component.preferencias.franja).toBe('FRANJA_CUATRO_A_SEIS_HORAS');
    expect(component.nivelesPermitidos).toEqual([NivelOposicion.AVANZADO]);
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

  it('muestra la explicación completa de GCV antes de elegirla, sin checkbox prematuro', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(texto).toContain(
      'La planificación General Comunidad Valenciana está diseñada para trabajar de forma global los contenidos comunes a las distintas oposiciones de bombero de la Comunidad Valenciana.',
    );
    expect(texto).toContain(
      'Recuerda cambiar la selección cuando quieras preparar una convocatoria concreta.',
    );
    expect(
      fixture.nativeElement.querySelector('p-checkbox[inputId="confirmarGcv"]'),
    ).toBeNull();
  });

  it('muestra la confirmación únicamente cuando la selección es GENERAL', () => {
    component.preferencias = {
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    };
    component.gcvConfirmado = false;
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('p-checkbox[inputId="confirmarGcv"]'),
    ).toBeTruthy();

    component.onPreferenciasChange({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    });
    expect(component.requiereConfirmacionGCV).toBe(false);
  });

  it('aceptar el test actualiza el mismo borrador sin guardar todavía', () => {
    component.preferencias.nivel = NivelOposicion.INICIACION;

    component.aplicarNivelRecomendado(NivelOposicion.AVANZADO);

    expect(component.preferencias.nivel).toBe(NivelOposicion.AVANZADO);
    expect(service.guardarConfiguracion$).not.toHaveBeenCalled();
  });

  it('cancelar el test restaura el nivel del borrador y no persiste', () => {
    component.preferencias.nivel = NivelOposicion.INICIACION;
    component.iniciarCuestionario();
    component.preferencias.nivel = NivelOposicion.AVANZADO;

    component.cancelarCuestionario();

    expect(component.preferencias.nivel).toBe(NivelOposicion.INICIACION);
    expect(component.elegirCuestionario()).toBe(false);
    expect(service.guardarConfiguracion$).not.toHaveBeenCalled();
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
    expect(emitSpy).toHaveBeenCalledWith('EXITO');
  });

  it('emite conflicto sin reportarlo como configuración activada en un 409', async () => {
    (service.guardarConfiguracion$ as jest.Mock).mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    component.preferencias = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    };
    const emitSpy = jest.spyOn(component.configurada, 'emit');

    await component.guardarConfiguracion();

    expect(emitSpy).toHaveBeenCalledWith('CONFLICTO');
    expect(emitSpy).not.toHaveBeenCalledWith('EXITO');
    expect(component.errorGuardado).toContain('otro dispositivo');
  });

  it('al editar una configuración ACTIVA prioriza su variante sobre onboarding', () => {
    component.configuracion = {
      ...configuracion,
      estado: 'ACTIVA',
      preferenciasPrecargadas: {
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
      },
      configuracionActiva: {
        variante: {
          codigo: 'ACTIVA-68',
          oposicion: Oposicion.ALICANTE_CPBA,
          nivel: NivelOposicion.AVANZADO,
          franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
        },
        version: 4,
        fechaVigencia: '2026-08-19',
        origen: 'ALUMNO',
        planificacionMensual: null,
      },
    };
    component.ngOnInit();

    expect(component.preferencias).toEqual({
      oposicion: Oposicion.ALICANTE_CPBA,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    });
    expect(component.tieneNivelPrecargado).toBe(true);
  });

  it('prioriza las preferencias precargadas explícitas sobre la variante activa', () => {
    component.configuracion = {
      ...configuracion,
      preferenciasPrecargadas: {
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.INICIACION,
        franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
      },
      configuracionActiva: {
        variante: {
          codigo: 'ACTIVA-68',
          oposicion: Oposicion.ALICANTE_CPBA,
          nivel: NivelOposicion.AVANZADO,
          franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
        },
        version: 4,
        fechaVigencia: '2026-08-19',
        origen: 'ALUMNO',
        planificacionMensual: null,
      },
    };
    component.preferenciasPrecargadas = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
    };
    component.ngOnInit();

    expect(component.preferencias).toEqual({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
    });
  });

  it('bloquea el guardado si falta nivel y no aplica un default silencioso', async () => {
    component.preferencias = {
      oposicion: Oposicion.MADRID,
      nivel: null,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    };

    await component.guardarConfiguracion();

    expect(service.guardarConfiguracion$).not.toHaveBeenCalled();
    expect(component.errorGuardado).toContain('nivel');
  });

  it('no permite navegar al paso de confirmación sin nivel', () => {
    component.activeStep.set(1);
    component.preferencias = {
      oposicion: Oposicion.MADRID,
      nivel: null,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    };

    component.irAPasoConfirmacion();

    expect(component.activeStep()).toBe(1);
  });

  it('muestra Cancelar solo en edición, emite cancelado y no guarda', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Cancelar',
    );

    const canceladoSpy = jest.spyOn(component.cancelado, 'emit');
    component.modoEdicion = true;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Cancelar',
    );
    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const botonCancelar = botones.find((button) =>
      button.textContent?.includes('Cancelar'),
    );
    expect(botonCancelar).toBeTruthy();

    (botonCancelar as HTMLButtonElement).click();

    expect(canceladoSpy).toHaveBeenCalledTimes(1);
    expect(service.guardarConfiguracion$).not.toHaveBeenCalled();
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
        planificacionMensual: null,
      },
    };
    expect(component.hayConfiguracionAnterior).toBe(true);
    expect(component.configuracionAnterior?.codigo).toBe('CA4-6');
  });

  it('expone la configuración actual para compararla con la nueva', () => {
    component.configuracion = {
      ...configuracion,
      configuracionActiva: {
        variante: {
          codigo: 'PCAI4-6H',
          oposicion: Oposicion.ALICANTE_CPBA,
          nivel: NivelOposicion.INICIACION,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
        },
        version: 3,
        fechaVigencia: '2026-08-01',
        origen: 'ONBOARDING',
        planificacionMensual: null,
      },
    };
    component.preferencias = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
    };
    component.activeStep.set(2);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Configuración actual');
    expect(texto).toContain('Nueva configuración');
    expect(texto).toContain('Consorcio de Alicante');
    expect(texto).toContain('Comunidad de Madrid');
    expect(texto).toContain('4-6 horas');
    expect(texto).toContain('6-8 horas');
  });
});
