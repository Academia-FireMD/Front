import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';

/**
 * `@toast-ui/editor` (usado por `<app-markdown-editor>`) no funciona en jsdom
 * — su `Editor` no es invocable como constructor fuera de un navegador real
 * (ningún otro spec del repo renderiza `<app-markdown-editor>` con
 * `detectChanges()` por este mismo motivo; `bloque-form.component.spec.ts`
 * lo esquiva porque su tipo por defecto nunca activa esa rama). Se mockea
 * aquí para poder testear el resto del componente (badges, guardado, etc.)
 * sin arrastrar un editor WYSIWYG real a un test unitario.
 */
jest.mock('@toast-ui/editor', () => ({
  Editor: jest.fn().mockImplementation(() => ({
    getMarkdown: jest.fn(() => ''),
    setMarkdown: jest.fn(),
    destroy: jest.fn(),
  })),
}));
import { PlanificacionesService } from '../../services/planificaciones.service';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { PlanificacionMensual } from '../../shared/models/planificacion.model';
import {
  BloqueEntrenamiento,
  DetalleDisciplina,
  PlanificacionFisicaService,
  SemanaConDetalles,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaDetallesComponent } from './planificacion-fisica-detalles.component';

describe('PlanificacionFisicaDetallesComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaDetallesComponent>;
  let component: PlanificacionFisicaDetallesComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const detalleVacio: DetalleDisciplina = {
    id: 45,
    asignacionId: 501,
    diaSemana: 1,
    disciplinaId: 1,
    disciplinaNombre: 'Cuerda',
    grupo: 'CUERDA',
    contenido: null,
    comentario: null,
    vacio: true,
  };

  const detalleRelleno: DetalleDisciplina = {
    id: 46,
    asignacionId: 502,
    diaSemana: 4,
    disciplinaId: 3,
    disciplinaNombre: 'Carrera',
    grupo: 'CARRERA',
    contenido: '4x400m',
    comentario: null,
    vacio: false,
  };

  const semanasFixture: SemanaConDetalles[] = [
    {
      semanaId: 12,
      indice: 0,
      numeroAno: 26,
      comentarioSemana: null,
      detalles: [detalleVacio, detalleRelleno],
    },
  ];

  const bloqueFixture: BloqueEntrenamiento = {
    id: 3,
    identificador: 'BLOQUE-3',
    comentarioGeneral: null,
    fechaInicioSemana1: '2026-08-01T00:00:00.000Z',
    numSemanas: 4,
    relevancia: [],
    estado: 'BORRADOR',
    planificaciones: [{ id: 20, identificador: 'PCA-A' }],
    _count: { semanas: 4 },
  };

  const planificacionesDisponibles: PlanificacionMensual[] = [
    {
      id: 20,
      identificador: 'PCA-A',
      mes: 8,
      ano: 2026,
      subBloques: [],
      asignacion: {} as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      esPorDefecto: false,
      relevancia: [],
    },
    {
      id: 21,
      identificador: 'PGCV-B',
      mes: 8,
      ano: 2026,
      subBloques: [],
      asignacion: {} as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      esPorDefecto: false,
      relevancia: [],
    },
  ];

  let activatedRouteMock: {
    snapshot: { paramMap: { get: jest.Mock } };
  };

  beforeEach(async () => {
    serviceMock = {
      detallesDeBloque: jest.fn().mockReturnValue(of(semanasFixture)),
      obtenerBloque: jest.fn().mockReturnValue(of(bloqueFixture)),
      actualizarPlanificaciones: jest.fn(),
      actualizarDetalle: jest.fn().mockReturnValue(of({})),
    };

    activatedRouteMock = {
      snapshot: { paramMap: { get: jest.fn().mockReturnValue('3') } },
    };

    const planificacionesServiceMock = {
      getPlanificacionMensual$: jest.fn().mockReturnValue(
        of({
          data: planificacionesDisponibles,
          pagination: { take: 999999, skip: 0, searchTerm: '', count: 2 },
        }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaDetallesComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
        {
          provide: PlanificacionesService,
          useValue: planificacionesServiceMock,
        },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionFisicaDetallesComponent);
    component = fixture.componentInstance;

    const toast = TestBed.inject(ToastrService);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
  });

  it('carga las semanas del bloque desde la ruta y renderiza sus disciplinas', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.detallesDeBloque).toHaveBeenCalledWith(3);
    expect(component['semanas']()).toEqual(semanasFixture);

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Cuerda');
    expect(html.textContent).toContain('Carrera');
    expect(html.textContent).toContain('Lunes');
    expect(html.textContent).toContain('Jueves');
  });

  it('marca con el badge "Falta" solo las disciplinas vacías', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const badgeVacio = fixture.debugElement.query(
      By.css(
        '[data-testid="pf-detalle-45"] [data-testid="pf-detalle-falta-badge"]',
      ),
    );
    expect(badgeVacio).toBeTruthy();

    const badgeRelleno = fixture.debugElement.query(
      By.css(
        '[data-testid="pf-detalle-46"] [data-testid="pf-detalle-falta-badge"]',
      ),
    );
    expect(badgeRelleno).toBeFalsy();
  });

  it('guardarDetalle llama al servicio con el contenido del control y actualiza el estado local (deja de estar vacío)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component['controlFor'](detalleVacio).setValue('3x1000m series');
    await component['guardarDetalle'](detalleVacio);

    expect(serviceMock.actualizarDetalle).toHaveBeenCalledWith(45, {
      contenido: '3x1000m series',
    });

    const actualizado = component['semanas']()[0].detalles.find(
      (d) => d.id === 45,
    );
    expect(actualizado?.vacio).toBe(false);
    expect(actualizado?.contenido).toBe('3x1000m series');
  });

  it('si el guardado falla, muestra un toast de error y NO marca el detalle como relleno', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    serviceMock.actualizarDetalle!.mockReturnValueOnce(
      throwError(() => new Error('boom')),
    );

    component['controlFor'](detalleVacio).setValue('algo');
    await component['guardarDetalle'](detalleVacio);

    const toast = TestBed.inject(ToastrService);
    expect(toast.error).toHaveBeenCalled();

    const actualizado = component['semanas']()[0].detalles.find(
      (d) => d.id === 45,
    );
    expect(actualizado?.vacio).toBe(true);
  });

  it('si el id del bloque en la ruta es inválido, avisa y vuelve al listado de bloques sin llamar al servicio', async () => {
    activatedRouteMock.snapshot.paramMap.get.mockReturnValue(null);
    fixture.detectChanges();
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion-fisica/admin',
    ]);
    expect(serviceMock.detallesDeBloque).not.toHaveBeenCalled();
  });

  it('carga el bloque, sus planificaciones enlazadas y las disponibles', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.obtenerBloque).toHaveBeenCalledWith(3);
    expect(component['bloque']()).toEqual(bloqueFixture);
    expect(component['planificacionesSeleccionadas']()).toEqual([
      planificacionesDisponibles[0],
    ]);

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Planificaciones de temario enlazadas');
    expect(html.textContent).toContain('PCA-A');
  });

  it('guardarPlanificaciones envía los IDs seleccionados y actualiza el bloque', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const actualizado = {
      ...bloqueFixture,
      planificaciones: [
        { id: 20, identificador: 'PCA-A' },
        { id: 21, identificador: 'PGCV-B' },
      ],
    };
    serviceMock.actualizarPlanificaciones!.mockReturnValue(of(actualizado));

    component['planificacionesSeleccionadas'].set(planificacionesDisponibles);
    await component['guardarPlanificaciones']();

    expect(serviceMock.actualizarPlanificaciones).toHaveBeenCalledWith(
      3,
      [20, 21],
    );
    expect(component['bloque']()).toEqual(actualizado);
    const toast = TestBed.inject(ToastrService);
    expect(toast.success).toHaveBeenCalled();
  });

  it('guardarPlanificaciones muestra toast de error si el servicio falla', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    serviceMock.actualizarPlanificaciones!.mockReturnValue(
      throwError(() => new Error('boom')),
    );

    await component['guardarPlanificaciones']();

    const toast = TestBed.inject(ToastrService);
    expect(toast.error).toHaveBeenCalledWith(
      'No se han podido guardar las planificaciones enlazadas.',
    );
  });
});
