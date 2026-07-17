import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  BloqueEntrenamiento,
  ErrorImport,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaAdminComponent } from './planificacion-fisica-admin.component';

describe('PlanificacionFisicaAdminComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaAdminComponent>;
  let component: PlanificacionFisicaAdminComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const bloqueFixture: BloqueEntrenamiento = {
    id: 1,
    identificador: 'BLOQUE-1',
    comentarioGeneral: null,
    fechaInicioSemana1: '2026-08-01T00:00:00.000Z',
    numSemanas: 4,
    relevancia: [Oposicion.VALENCIA_AYUNTAMIENTO],
    estado: 'BORRADOR',
    _count: { semanas: 4 },
  };

  const erroresFixture: ErrorImport[] = [
    {
      hoja: 'Semanas',
      fila: 3,
      motivo: 'intensidad debe estar entre 0 y 100 (recibido: 140)',
    },
    {
      hoja: 'Calendario',
      fila: 4,
      motivo: 'Disciplina desconocida: "Pilates"',
    },
  ];

  beforeEach(async () => {
    serviceMock = {
      preview: jest.fn().mockReturnValue(of({ resumen: null, errores: [] })),
      importar: jest.fn(),
      listarBloques: jest.fn().mockReturnValue(of([bloqueFixture])),
      publicar: jest.fn(),
      eliminar: jest.fn(),
      descargarPlantillaUrl: jest
        .fn()
        .mockReturnValue(
          'http://localhost:3000/planificacion-fisica/plantilla',
        ),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaAdminComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        // ConfirmationService REAL (no el mock de COMMON_TEST_PROVIDERS):
        // `<p-confirmDialog>` en el template se suscribe a los Subjects
        // internos del servicio real en su constructor; el mock plano de
        // COMMON_TEST_PROVIDERS no los tiene y revienta al crear el fixture.
        // Mismo patrón que `curso-admin-edit.component.spec.ts`.
        ConfirmationService,
        // El mock de PrimeNGConfig de COMMON_TEST_PROVIDERS no trae
        // `translationObserver` (Observable): `_ConfirmDialog.ngOnInit` se
        // suscribe a él siempre que el diálogo se renderiza de verdad, y
        // revienta con "Cannot read properties of undefined (reading
        // 'subscribe')" si falta. Lo sobreescribimos con la instancia real.
        PrimeNGConfig,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionFisicaAdminComponent);
    component = fixture.componentInstance;

    const toast = TestBed.inject(ToastrService);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
  });

  it('debe crearse y cargar los bloques existentes al iniciar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(serviceMock.listarBloques).toHaveBeenCalled();
    expect(component['bloques']()).toEqual([bloqueFixture]);
  });

  it('al previsualizar un Excel con errores, los guarda tal cual (hoja/fila/motivo) y NO guarda resumen', async () => {
    serviceMock.preview!.mockReturnValue(
      of({ resumen: null, errores: erroresFixture }),
    );
    fixture.detectChanges();

    const file = new File(['x'], 'plantilla.xlsx');
    await component.onFileSelected({ files: [file] });
    fixture.detectChanges();

    expect(component['errores']()).toEqual(erroresFixture);
    expect(component['resumen']()).toBeNull();
    expect(component['tieneErrores']()).toBe(true);

    const html = fixture.nativeElement as HTMLElement;
    const errorTable = fixture.debugElement.query(
      By.css('[data-testid="errores-table"]'),
    );
    expect(errorTable).toBeTruthy();
    expect(html.textContent).toContain('Semanas');
    expect(html.textContent).toContain('intensidad debe estar entre 0 y 100');
    expect(html.textContent).toContain('Disciplina desconocida');
    expect(html.textContent).toContain('No se ha importado nada');
  });

  it('al previsualizar un Excel válido, guarda el resumen y NO hay errores', async () => {
    const resumen = {
      identificador: 'BLOQUE-2',
      numSemanas: 4,
      totalAsignaciones: 20,
      totalDetalles: 60,
      relevancia: [Oposicion.MADRID],
    };
    serviceMock.preview!.mockReturnValue(of({ resumen, errores: [] }));
    fixture.detectChanges();

    const file = new File(['x'], 'plantilla.xlsx');
    await component.onFileSelected({ files: [file] });
    fixture.detectChanges();

    expect(component['resumen']()).toEqual(resumen);
    expect(component['tieneErrores']()).toBe(false);
    const resumenCard = fixture.debugElement.query(
      By.css('[data-testid="resumen-card"]'),
    );
    expect(resumenCard).toBeTruthy();
  });

  it('si import() devuelve 422 con errores en el cuerpo del error HTTP, los muestra en la tabla', async () => {
    fixture.detectChanges();
    const file = new File(['x'], 'plantilla.xlsx');
    component['selectedFile'].set(file);

    serviceMock.importar!.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              message: 'El Excel tiene errores; no se ha importado nada',
              errores: erroresFixture,
            },
          }),
      ),
    );

    await component.importar();

    expect(component['errores']()).toEqual(erroresFixture);
    expect(component['resumen']()).toBeNull();
  });

  it('publicarBloque llama al servicio y recarga el listado tras confirmar', async () => {
    fixture.detectChanges();
    serviceMock.publicar!.mockReturnValue(
      of({ ...bloqueFixture, estado: 'PUBLICADO' }),
    );

    const confirmSpy = jest
      .spyOn(TestBed.inject(ConfirmationService), 'confirm')
      .mockImplementation((opts) => {
        (opts.accept as (() => void) | undefined)?.();
        return TestBed.inject(ConfirmationService);
      });

    component.publicarBloque(bloqueFixture, new Event('click'));
    await Promise.resolve();

    expect(serviceMock.publicar).toHaveBeenCalledWith(bloqueFixture.id);
    expect(serviceMock.listarBloques).toHaveBeenCalledTimes(2);
    confirmSpy.mockRestore();
  });
});
