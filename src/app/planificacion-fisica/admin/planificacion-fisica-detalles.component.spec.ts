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
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import {
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
    disciplinaId: 1,
    disciplinaNombre: 'Cuerda 1',
    grupo: 'CUERDA',
    contenido: null,
    comentario: null,
    vacio: true,
  };

  const detalleRelleno: DetalleDisciplina = {
    id: 46,
    disciplinaId: 3,
    disciplinaNombre: 'Carrera 1',
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

  let activatedRouteMock: {
    snapshot: { paramMap: { get: jest.Mock } };
  };

  beforeEach(async () => {
    serviceMock = {
      detallesDeBloque: jest.fn().mockReturnValue(of(semanasFixture)),
      actualizarDetalle: jest.fn().mockReturnValue(of({})),
    };

    activatedRouteMock = {
      snapshot: { paramMap: { get: jest.fn().mockReturnValue('3') } },
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaDetallesComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
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
    expect(html.textContent).toContain('Cuerda 1');
    expect(html.textContent).toContain('Carrera 1');
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
});
