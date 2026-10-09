import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { PlanificacionAlumnoComponent } from './planificacion-alumno.component';

describe('PlanificacionAlumnoComponent — acceso al calendario', () => {
  let fixture: ComponentFixture<PlanificacionAlumnoComponent>;
  let router: { navigate: jest.Mock };
  let autoasignacionService: { getConfiguracion$: jest.Mock };
  let modo: string | null;

  const plan = { id: 42, identificador: 'P042026', mes: 10, ano: 2026 };
  const configuracionActiva: ConfiguracionPlanificacion = {
    estado: 'ACTIVA',
    preferenciasPrecargadas: {
      oposicion: null,
      nivel: null,
      franja: null,
    },
    oposicionesPermitidas: [],
    configuracionActiva: null,
    estadoTest: null,
    planActual: plan,
    planesPrevios: [],
    estadoPrevioHash: 'hash-actual',
  };

  beforeEach(async () => {
    modo = null;
    router = { navigate: jest.fn().mockResolvedValue(true) };
    autoasignacionService = {
      getConfiguracion$: jest.fn().mockReturnValue(of(configuracionActiva)),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionAlumnoComponent],
      providers: [
        { provide: AutoasignacionService, useValue: autoasignacionService },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'modo' ? modo : null),
              },
            },
          },
        },
        {
          provide: ToastrService,
          useValue: {
            success: jest.fn(),
            warning: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    })
      .overrideComponent(PlanificacionAlumnoComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PlanificacionAlumnoComponent);
  });

  it('abre directamente el calendario cuando la configuración activa tiene plan vigente', async () => {
    await fixture.componentInstance.cargar();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion/planificacion-mensual-alumno', plan.id],
      { replaceUrl: true },
    );
  });

  it('mantiene el wizard cuando se entra con el modo explícito de cambio', async () => {
    modo = 'cambiar';
    fixture = TestBed.createComponent(PlanificacionAlumnoComponent);

    await fixture.componentInstance.cargar();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editando).toBe(true);
  });

  it('al cancelar el cambio explícito vuelve al calendario vigente sin mutar el plan', async () => {
    modo = 'cambiar';
    fixture = TestBed.createComponent(PlanificacionAlumnoComponent);
    await fixture.componentInstance.cargar();

    fixture.componentInstance.onCancelado();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion/planificacion-mensual-alumno', plan.id],
      { replaceUrl: true },
    );
    expect(autoasignacionService.getConfiguracion$).toHaveBeenCalledTimes(1);
  });

  it('conserva la configuración inicial cuando el alumno aún no tiene plan', async () => {
    autoasignacionService.getConfiguracion$.mockReturnValue(
      of({
        ...configuracionActiva,
        estado: 'REQUIERE_CONFIGURACION',
        planActual: null,
      }),
    );

    await fixture.componentInstance.cargar();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editando).toBe(true);
  });

  it.each(['PENDIENTE_PUBLICACION', 'BLOQUEADA'] as const)(
    'no redirige si la planificación está %s',
    async (estado) => {
      autoasignacionService.getConfiguracion$.mockReturnValue(
        of({ ...configuracionActiva, estado }),
      );

      await fixture.componentInstance.cargar();

      expect(router.navigate).not.toHaveBeenCalled();
    },
  );
});
