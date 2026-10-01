import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { PlanificacionConfiguracionWizardComponent } from './planificacion-configuracion-wizard.component';

const franja = 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada;
const opcion = {
  codigo: 'AYVA4-6',
  oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
  nivel: NivelOposicion.AVANZADO,
  franja,
  varianteId: 10,
  planificacionMensual: {
    id: 203, identificador: 'PAVA4-6H', mes: 8, ano: 2026,
  },
};
const configuracion: ConfiguracionPlanificacion = {
  estado: 'REQUIERE_CONFIGURACION',
  preferenciasPrecargadas: { oposicion: null, nivel: null, franja: null },
  oposicionesPermitidas: [Oposicion.VALENCIA_AYUNTAMIENTO],
  disponibilidadOposiciones: [
    { oposicion: Oposicion.VALENCIA_AYUNTAMIENTO, estado: 'DISPONIBLE' },
  ],
  opcionesPermitidas: [opcion],
  configuracionActiva: null,
  estadoTest: null,
  estadoPrevioHash: 'a'.repeat(64),
  planActual: null,
  planesPrevios: [],
};

describe('PlanificacionConfiguracionWizardComponent', () => {
  let component: PlanificacionConfiguracionWizardComponent;
  let fixture: ComponentFixture<PlanificacionConfiguracionWizardComponent>;
  let guardar: jest.Mock;

  beforeEach(async () => {
    guardar = jest.fn(() => of({ ...configuracion, estado: 'ACTIVA' }));
    await TestBed.configureTestingModule({
      imports: [PlanificacionConfiguracionWizardComponent],
      providers: [{
        provide: AutoasignacionService,
        useValue: {
          getCuestionarioNivel$: jest.fn(),
          recomendarNivel$: jest.fn(),
          guardarConfiguracion$: guardar,
        },
      }],
    }).compileComponents();
    fixture = TestBed.createComponent(PlanificacionConfiguracionWizardComponent);
    component = fixture.componentInstance;
    component.configuracion = configuracion;
    fixture.detectChanges();
  });

  it('no inventa una combinación ni precarga nivel/franja', () => {
    expect(component.preferencias.nivel).toBeNull();
    expect(component.preferencias.franja).toBeNull();
    expect(component.modalidad).toBe('ESPECIFICA');
    expect(component.puedeConfirmar).toBe(false);
  });

  it('solo ofrece las oposiciones autorizadas por el backend', () => {
    expect(component.opcionesEspecificas.map((item) => item.value))
      .toEqual([Oposicion.VALENCIA_AYUNTAMIENTO]);
    expect(component.hayPlanComun).toBe(false);
    component.configuracion = {
      ...configuracion,
      disponibilidadOposiciones: [
        { oposicion: Oposicion.MADRID, estado: 'SIN_PLANIFICACION_PUBLICADA' },
      ],
    };
    expect(component.opcionesEspecificas[0].disabled).toBe(true);
  });

  it('el test aceptado cambia solo el borrador y cancelar restaura el nivel', () => {
    component.preferencias = {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: NivelOposicion.AVANZADO,
      franja,
    };
    component.iniciarCuestionario();
    component.preferencias.nivel = null;
    component.cancelarCuestionario();
    expect(component.preferencias.nivel).toBe(NivelOposicion.AVANZADO);
    component.aceptarEvaluacion({
      nivel: NivelOposicion.AVANZADO,
      respuestas: [3, 3, 2, 2, 3],
      versionCuestionario: 2,
    });
    expect(guardar).not.toHaveBeenCalled();
  });

  it('envía la versión exacta del test aceptado al confirmar', async () => {
    component.preferencias = {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: null,
      franja,
    };
    component.modalidad = 'ESPECIFICA';
    component.aceptarEvaluacion({
      nivel: NivelOposicion.AVANZADO,
      respuestas: [3, 3, 2, 2, 3],
      versionCuestionario: 2,
    });
    await component.guardarConfiguracion();
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      respuestasTest: [3, 3, 2, 2, 3],
      versionCuestionario: 2,
    }));
  });

  it('cancelar el asistente no hace llamadas de guardado', () => {
    const cancelado = jest.spyOn(component.cancelado, 'emit');
    component.cancelar();
    expect(cancelado).toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
  });

  it('pide consentimiento antes de sustituir un plan existente y conserva el snapshot', async () => {
    component.configuracion = {
      ...configuracion,
      planActual: { id: 199, identificador: 'PAVA6-8H', mes: 8, ano: 2026 },
      planesPrevios: [{ id: 199, identificador: 'PAVA6-8H', mes: 8, ano: 2026 }],
    };
    component.preferencias = {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: NivelOposicion.AVANZADO,
      franja,
    };
    component.modalidad = 'ESPECIFICA';
    expect(component.requiereReemplazo).toBe(true);
    expect(component.puedeConfirmar).toBe(false);
    await component.guardarConfiguracion();
    expect(guardar).not.toHaveBeenCalled();

    component.confirmarReemplazo = true;
    await component.guardarConfiguracion();
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      planificacionIdEsperada: 203,
      estadoPrevioHash: 'a'.repeat(64),
      confirmarReemplazo: true,
    }));
  });

  it('un 409 informa del conflicto para recargar y volver a decidir', async () => {
    component.preferencias = {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: NivelOposicion.AVANZADO,
      franja,
    };
    component.modalidad = 'ESPECIFICA';
    guardar.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    const configurada = jest.spyOn(component.configurada, 'emit');
    await component.guardarConfiguracion();
    expect(configurada).toHaveBeenCalledWith('CONFLICTO');
    expect(configurada).not.toHaveBeenCalledWith('EXITO');
  });
});
