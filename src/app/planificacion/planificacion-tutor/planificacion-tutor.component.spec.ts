import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
import type { AlumnoPlanificacionTutor } from '../models/autoasignacion.model';
import { PlanificacionTutorComponent } from './planificacion-tutor.component';

describe('PlanificacionTutorComponent', () => {
  let fixture: ComponentFixture<PlanificacionTutorComponent>;
  let component: PlanificacionTutorComponent;
  let service: {
    getTutorAlumnos$: jest.Mock;
    forzarConfiguracionTutor$: jest.Mock;
  };

  const alumno: AlumnoPlanificacionTutor = {
    alumno: { id: 42, nombre: 'Ana', apellidos: 'A', email: 'a@a.es' },
    configuracion: {
      variante: {
        id: 8,
        codigo: 'MAD6-8',
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.AVANZADO,
        franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      },
      version: 2,
      fechaVigencia: '2026-08-20T00:00:00.000Z',
      origen: 'ALUMNO',
      planificacionMensual: {
        id: 91,
        identificador: 'MADRID-6-8',
        mes: 8,
        ano: 2026,
      },
    },
    preferencias: {
      oposicion: Oposicion.MADRID,
      nivel: null,
      franja: null,
    },
    oposicionesPermitidas: [Oposicion.MADRID],
    opcionesPermitidas: [
      {
        oposicion: Oposicion.MADRID,
        nivel: NivelOposicion.AVANZADO,
        franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
        varianteId: 3,
        planificacionMensual: {
          id: 92,
          identificador: 'MADRID-6-8-ALTERNATIVA',
          mes: 9,
          ano: 2026,
        },
      },
    ],
    recomendacion: null,
  };

  beforeEach(async () => {
    service = {
      getTutorAlumnos$: jest.fn(() => of([alumno])),
      forzarConfiguracionTutor$: jest.fn(() => of({})),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionTutorComponent],
      providers: [
        { provide: AutoasignacionService, useValue: service },
        { provide: ToastrService, useValue: { error: jest.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionTutorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('carga solo el endpoint acotado de alumnos tutor', () => {
    expect(service.getTutorAlumnos$).toHaveBeenCalledTimes(1);
    expect(component.alumnos()).toEqual([alumno]);
  });

  it('usa la configuración activa directa del endpoint para prellenar la variante', () => {
    expect(component.preferenciasEditadas).toEqual({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    });
    expect(component.alumnoSeleccionado()?.configuracion?.variante.codigo).toBe(
      'MAD6-8',
    );
  });

  it('deriva las opciones del backend sin usar un catálogo local', () => {
    expect(component.opciones).toEqual({
      oposiciones: [Oposicion.MADRID],
      niveles: [NivelOposicion.AVANZADO],
      franjas: [TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS],
    });
  });

  it('filtra nivel y franja por la combinación de oposición seleccionada', () => {
    component.preferenciasEditadas = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    };

    expect(component.opciones.niveles).toEqual([NivelOposicion.AVANZADO]);
    expect(component.opciones.franjas).toEqual([
      TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    ]);
  });

  it('resetea nivel y franja cuando la oposición nueva no conserva la combinación', () => {
    const otraOposicion: AlumnoPlanificacionTutor = {
      ...alumno,
      opcionesPermitidas: [
        ...alumno.opcionesPermitidas,
        {
          oposicion: Oposicion.GENERAL,
          nivel: NivelOposicion.INICIACION,
          franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
          varianteId: 4,
          planificacionMensual: null,
        },
      ],
    };
    component.alumnos.set([otraOposicion]);
    component.seleccionarAlumno(otraOposicion);
    component.onPreferenciasChange({
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    });
    component.onPreferenciasChange({
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    });

    expect(component.preferenciasEditadas).toEqual({
      oposicion: Oposicion.GENERAL,
      nivel: null,
      franja: null,
    });
    expect(component.opciones.niveles).toEqual([NivelOposicion.INICIACION]);
    expect(component.opciones.franjas).toEqual([]);
  });

  it('exige los tres valores y un motivo antes de forzar', async () => {
    component.preferenciasEditadas = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    };
    component.motivo = 'Ajuste acordado';

    expect(component.puedeGuardar).toBe(true);
    await component.guardar();

    expect(service.forzarConfiguracionTutor$).toHaveBeenCalledWith(42, {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      motivo: 'Ajuste acordado',
    });
  });

  it('bloquea una combinación exacta sin planificación publicada', async () => {
    const alumnoSinPlan: AlumnoPlanificacionTutor = {
      ...alumno,
      opcionesPermitidas: [
        {
          oposicion: Oposicion.MADRID,
          nivel: NivelOposicion.AVANZADO,
          franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
          varianteId: 3,
          planificacionMensual: null,
        },
      ],
    };
    component.alumnos.set([alumnoSinPlan]);
    component.seleccionarAlumno(alumnoSinPlan);
    component.preferenciasEditadas = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    };
    component.motivo = 'Ajuste acordado';

    expect(component.opcionSeleccionada?.planificacionMensual).toBeNull();
    expect(component.puedeGuardar).toBe(false);
    await component.guardar();
    expect(service.forzarConfiguracionTutor$).not.toHaveBeenCalled();
  });

  it('no permite guardar una combinación cruzada que no exista en opcionesPermitidas', async () => {
    component.preferenciasEditadas = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.INICIACION,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    };
    component.motivo = 'Ajuste acordado';

    expect(component.opcionSeleccionada).toBeNull();
    expect(component.puedeGuardar).toBe(false);
    await component.guardar();
    expect(service.forzarConfiguracionTutor$).not.toHaveBeenCalled();
  });

  it('muestra un error visible y toast si el guardado tutor falla', async () => {
    service.forzarConfiguracionTutor$.mockReturnValueOnce(
      throwError(() => new Error('fallo')),
    );
    component.preferenciasEditadas = {
      oposicion: Oposicion.MADRID,
      nivel: NivelOposicion.AVANZADO,
      franja: TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
    };
    component.motivo = 'Ajuste acordado';

    await component.guardar();

    expect(component.error()).toBe(
      'No se pudieron guardar las preferencias del alumno.',
    );
  });
});
