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

  async function montar(estado: ConfiguracionPlanificacion) {
    await TestBed.configureTestingModule({
      imports: [PlanificacionAlumnoComponent],
      providers: [
        {
          provide: AutoasignacionService,
          useValue: { getConfiguracion$: jest.fn(() => of(estado)) },
        },
        {
          provide: ToastrService,
          useValue: { success: jest.fn(), error: jest.fn() },
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: {} },
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
      },
    });
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('progressbar');
    expect(html).toContain('Tu planificación está activa');
    expect(html).toContain('AYVI4-6');
  });
});
