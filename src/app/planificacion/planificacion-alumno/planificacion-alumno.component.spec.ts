import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { PlanificacionAlumnoComponent } from './planificacion-alumno.component';
import { AutoasignacionService } from '../services/autoasignacion.service';
import { ConfiguracionPlanificacion } from '../models/autoasignacion.model';

/**
 * Regresión (QA staging 2026-08-18): con ChangeDetectionStrategy.OnPush y
 * carga async/await, sin markForCheck el shell se quedaba en "Cargando…" para
 * siempre aunque la API respondiese 200.
 */
describe('PlanificacionAlumnoComponent — render por estado', () => {
  let fixture: ComponentFixture<PlanificacionAlumnoComponent>;

  const estadoRequiereConfiguracion: ConfiguracionPlanificacion = {
    estado: 'REQUIERE_CONFIGURACION',
    oposicionesPermitidas: ['VALENCIA_AYUNTAMIENTO', 'GENERAL'] as never[],
    preferenciasPrecargadas: {
      oposicion: null,
      nivel: null,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as never,
    },
    configuracionActiva: null,
    ultimaRecomendacion: null,
  };

  async function montar(
    estado: ConfiguracionPlanificacion,
    revisar: string | null = null,
  ) {
    await TestBed.configureTestingModule({
      imports: [PlanificacionAlumnoComponent],
      providers: [
        {
          provide: AutoasignacionService,
          useValue: { getConfiguracion$: jest.fn(() => of(estado)) },
        },
        {
          provide: ToastrService,
          useValue: {
            success: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
          },
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: () => revisar } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionAlumnoComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('REQUIERE_CONFIGURACION renderiza el asistente (no se queda cargando)', async () => {
    await montar(estadoRequiereConfiguracion);
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('progressbar');
    expect(html).toContain('app-planificacion-configuracion-wizard');
  });

  it('BLOQUEADA renderiza la pantalla de bloqueo con CTA', async () => {
    await montar({
      ...estadoRequiereConfiguracion,
      estado: 'BLOQUEADA',
      oposicionesPermitidas: [],
    });
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('progressbar');
    expect(html).toContain('Planificación no disponible');
  });

  it('ACTIVA renderiza el resumen de la variante vigente', async () => {
    await montar({
      ...estadoRequiereConfiguracion,
      estado: 'ACTIVA',
      configuracionActiva: {
        variante: {
          codigo: 'AYVI4-6',
          oposicion: 'VALENCIA_AYUNTAMIENTO' as never,
          nivel: 'INICIACION' as never,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as never,
        },
        version: 1,
        fechaVigencia: '2026-08-18T00:00:00.000Z',
        origen: 'ALUMNO',
        planificacionMensual: {
          id: 42,
          identificador: 'S082026GA4-6',
          mes: 8,
          ano: 2026,
        },
      },
    });
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('progressbar');
    expect(html).toContain('Tu planificación está activa');
    expect(html).toContain('AYVI4-6');
  });

  it('ACTIVA expone el id del plan mensual canónico para el enlace del calendario', async () => {
    await montar({
      ...estadoRequiereConfiguracion,
      estado: 'ACTIVA',
      configuracionActiva: {
        variante: {
          codigo: 'AYVI4-6',
          oposicion: 'VALENCIA_AYUNTAMIENTO' as never,
          nivel: 'INICIACION' as never,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as never,
        },
        version: 1,
        fechaVigencia: '2026-08-18T00:00:00.000Z',
        origen: 'ALUMNO',
        planificacionMensual: {
          id: 77,
          identificador: 'S082026AYVI4-6',
          mes: 8,
          ano: 2026,
        },
      },
    });

    expect(fixture.componentInstance.planificacionMensualId).toBe(77);
    const link = fixture.nativeElement.querySelector(
      'button[label="Ver mi planificación"]',
    );
    expect(link).toBeTruthy();
  });

  it('ACTIVA vuelve al resumen cuando se cancela la edición', async () => {
    await montar({
      ...estadoRequiereConfiguracion,
      estado: 'ACTIVA',
      configuracionActiva: {
        variante: {
          codigo: 'AYVI4-6',
          oposicion: 'VALENCIA_AYUNTAMIENTO' as never,
          nivel: 'INICIACION' as never,
          franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as never,
        },
        version: 1,
        fechaVigencia: '2026-08-18T00:00:00.000Z',
        origen: 'ALUMNO',
        planificacionMensual: {
          id: 77,
          identificador: 'S082026AYVI4-6',
          mes: 8,
          ano: 2026,
        },
      },
    });

    fixture.componentInstance.editando = true;
    fixture.detectChanges();

    fixture.componentInstance.cancelarEdicion();
    fixture.detectChanges();

    expect(fixture.componentInstance.editando).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Tu planificación está activa',
    );
  });

  it('PENDIENTE_PUBLICACION informa al alumno sin pedir repetir preferencias', async () => {
    await montar({
      ...estadoRequiereConfiguracion,
      estado: 'PENDIENTE_PUBLICACION',
      configuracionActiva: null,
    });

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('pendiente de publicación');
    expect(html).toContain('No necesitas repetir tus datos');
    expect(html).toContain('Cambiar preferencias');
  });

  it('PENDIENTE_PUBLICACION abre el wizard precargado desde Perfil', async () => {
    await montar(
      {
        ...estadoRequiereConfiguracion,
        estado: 'PENDIENTE_PUBLICACION',
      },
      'preferencias',
    );

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(fixture.componentInstance.editando).toBe(true);
    expect(html).toContain('Tus preferencias están guardadas');
    expect(html).toContain('app-planificacion-configuracion-wizard');
  });

  it('un conflicto del wizard nunca muestra el toast de éxito', async () => {
    await montar(estadoRequiereConfiguracion);
    const toast = TestBed.inject(ToastrService);

    fixture.componentInstance.onConfigurada('CONFLICTO');

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('cambió en otro dispositivo'),
    );
  });
});
