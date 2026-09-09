import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
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

const cuestionario = {
  // Valor deliberadamente ajeno a la versión real: el Front consume el
  // contrato del backend y no debe mantener una copia local del cuestionario.
  version: 42,
  preguntas: Array.from({ length: 5 }, (_, indice) => ({
    id: `nivel-${indice + 1}`,
    texto: `Pregunta ${indice + 1}`,
    opciones: [
      { valor: 0, etiqueta: 'Opción 0' },
      { valor: 1, etiqueta: 'Opción 1' },
      { valor: 2, etiqueta: 'Opción 2' },
      { valor: 3, etiqueta: 'Opción 3' },
    ],
  })),
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
            getCuestionarioNivel$: jest.fn(() => of(cuestionario)),
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

  it('obtiene la recomendación sin sustituir la elección hasta que el usuario la acepta', async () => {
    component.respuestas = [3, 2, 3, 1, 3];
    await component.obtenerRecomendacion();

    expect(service.recomendarNivel$).toHaveBeenCalledWith(
      [3, 2, 3, 1, 3],
      cuestionario.version,
    );
    expect(component.recomendacion?.nivelRecomendado).toBe('AVANZADO');
    expect(component.preferencias.nivel).toBeNull();

    component.aceptarRecomendacion();
    expect(component.preferencias.nivel).toBe('AVANZADO');
  });

  it('mantiene las respuestas del cuestionario en null hasta que se contestan', () => {
    expect(component.respuestas).toEqual([null, null, null, null, null]);
    expect(component.cuestionarioCompleto).toBe(false);
  });

  it('renderiza la definición del backend y no una copia local', () => {
    expect(service.getCuestionarioNivel$).toHaveBeenCalled();
    expect(component.preguntas.map((pregunta) => pregunta.texto)).toEqual([
      'Pregunta 1',
      'Pregunta 2',
      'Pregunta 3',
      'Pregunta 4',
      'Pregunta 5',
    ]);
  });

  it('recarga y limpia respuestas si el backend rechaza una versión obsoleta', async () => {
    (service.recomendarNivel$ as jest.Mock).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { codigo: 'CUESTIONARIO_DESACTUALIZADO' },
          }),
      ),
    );
    component.respuestas = [3, 2, 3, 1, 3];

    await component.obtenerRecomendacion();

    expect(service.getCuestionarioNivel$).toHaveBeenCalledTimes(2);
    expect(component.respuestas).toEqual([null, null, null, null, null]);
  });

  it('normaliza cada respuesta elegida a número y conserva el bloqueo hasta completar', () => {
    component.onRespuestaChange(0, '2');
    component.onRespuestaChange(1, 2);

    expect(component.respuestas).toEqual([2, 2, null, null, null]);
    expect(component.cuestionarioCompleto).toBe(false);
  });

  it('bloquea la recomendación si falta una respuesta', async () => {
    component.respuestas = [3, 2, null, 1, 3];

    await component.obtenerRecomendacion();

    expect(service.recomendarNivel$).not.toHaveBeenCalled();
    expect(component.errorCuestionario).toContain('5 preguntas');
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

  it('al editar prioriza la variante activa sobre las preferencias de onboarding', () => {
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
});
