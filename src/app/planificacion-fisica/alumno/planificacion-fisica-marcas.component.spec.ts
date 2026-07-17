import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { Confirmation, ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import {
  MarcaPersonal,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaMarcasComponent } from './planificacion-fisica-marcas.component';

describe('PlanificacionFisicaMarcasComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaMarcasComponent>;
  let component: PlanificacionFisicaMarcasComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const marcasFixture: MarcaPersonal[] = [
    {
      id: 1,
      disciplinaId: 3,
      disciplinaNombre: 'Carrera 1',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      valor: 12.4,
      unidad: 'min',
      fecha: '2026-07-10',
      notas: 'buena sensación',
    },
    {
      id: 2,
      disciplinaId: 3,
      disciplinaNombre: 'Carrera 1',
      grupo: 'CARRERA',
      color: '#fdeaa8',
      valor: 12.9,
      unidad: 'min',
      fecha: '2026-06-01',
      notas: null,
    },
    {
      id: 3,
      disciplinaId: 5,
      disciplinaNombre: 'Press 1',
      grupo: 'PRESS',
      color: '#c9c0ec',
      valor: 20,
      unidad: 'reps',
      fecha: '2026-07-01',
      notas: null,
    },
  ];

  beforeEach(async () => {
    serviceMock = {
      marcas: jest.fn().mockReturnValue(of(marcasFixture)),
      miPlan: jest.fn().mockReturnValue(of(null)),
      crearMarca: jest.fn(),
      borrarMarca: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaMarcasComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        // ConfirmationService/PrimeNGConfig REALES: `<p-confirmDialog>` en el
        // template se suscribe a Subjects internos del servicio real; el
        // mock plano de COMMON_TEST_PROVIDERS revienta al crear el fixture.
        // Mismo patrón que `planificacion-fisica-admin.component.spec.ts`.
        ConfirmationService,
        PrimeNGConfig,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanificacionFisicaMarcasComponent);
    component = fixture.componentInstance;

    const toast = TestBed.inject(ToastrService);
    (toast.success as jest.Mock).mockClear();
    (toast.error as jest.Mock).mockClear();
  });

  it('carga las marcas al iniciar y las agrupa por disciplina', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.marcas).toHaveBeenCalled();
    expect(component['grupos']().length).toBe(2);
    expect(component['grupos']()[0].marcas.length).toBe(2);

    const contenedor = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-container"]'),
    );
    expect(contenedor).toBeTruthy();

    const grupoCarrera = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-grupo-3"]'),
    );
    expect(grupoCarrera).toBeTruthy();

    const marca1 = fixture.debugElement.query(
      By.css('[data-testid="pf-marca-1"]'),
    );
    expect(marca1).toBeTruthy();
  });

  it('añadir marca: llama a crearMarca con el DTO del formulario y refresca la lista', async () => {
    serviceMock.crearMarca!.mockReturnValue(
      of({ ...marcasFixture[0], id: 99 }),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component['form'].setValue({
      disciplinaId: 3,
      valor: 15,
      unidad: 'min',
      fecha: new Date(2026, 6, 5), // 5 julio 2026 (mes 0-indexado)
      notas: 'ok',
    });

    await component['guardarMarca']();

    expect(serviceMock.crearMarca).toHaveBeenCalledWith({
      disciplinaId: 3,
      valor: 15,
      unidad: 'min',
      fecha: '2026-07-05',
      notas: 'ok',
    });
    // refresca tras crear
    expect(serviceMock.marcas).toHaveBeenCalledTimes(2);
  });

  it('no llama a crearMarca si el formulario es inválido', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component['guardarMarca']();

    expect(serviceMock.crearMarca).not.toHaveBeenCalled();
  });

  it('borrar marca: pide confirmación y solo llama a borrarMarca si se acepta', async () => {
    serviceMock.borrarMarca!.mockReturnValue(of({ ok: true as const }));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmSpy = jest
      .spyOn(TestBed.inject(ConfirmationService), 'confirm')
      .mockImplementation((c: Confirmation) => {
        c.accept?.();
        return TestBed.inject(ConfirmationService);
      });

    const borrarBtn = fixture.debugElement.query(
      By.css('[data-testid="pf-marca-borrar-1"]'),
    );
    expect(borrarBtn).toBeTruthy();
    borrarBtn.triggerEventHandler('click', new Event('click'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(confirmSpy).toHaveBeenCalled();
    expect(serviceMock.borrarMarca).toHaveBeenCalledWith(1);
  });

  it('borrar marca: NO llama al backend si se cancela la confirmación', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    jest
      .spyOn(TestBed.inject(ConfirmationService), 'confirm')
      .mockImplementation(() => TestBed.inject(ConfirmationService)); // no invoca accept

    const borrarBtn = fixture.debugElement.query(
      By.css('[data-testid="pf-marca-borrar-1"]'),
    );
    borrarBtn.triggerEventHandler('click', new Event('click'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.borrarMarca).not.toHaveBeenCalled();
  });

  it('muestra la píldora de upsell cuando el backend responde 403 TIER_TOO_LOW', async () => {
    serviceMock.marcas!.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              reason: 'TIER_TOO_LOW',
              requiredTier: 'ADVANCED',
              message: 'Mejora tu suscripción para acceder a este contenido.',
            },
          }),
      ),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pill = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-upsell"]'),
    );
    expect(pill).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Mejora tu suscripción para acceder a este contenido.',
    );
  });

  it('muestra el estado "sin marcas" cuando el backend devuelve un array vacío', async () => {
    serviceMock.marcas!.mockReturnValue(of([]));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const vacio = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-vacio"]'),
    );
    expect(vacio).toBeTruthy();
    const errorEl = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-error"]'),
    );
    expect(errorEl).toBeFalsy();
  });

  it('muestra un estado de ERROR (no "sin marcas") cuando el backend falla con un error genérico (500)', async () => {
    serviceMock.marcas!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const errorEl = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-error"]'),
    );
    expect(errorEl).toBeTruthy();

    const vacio = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-vacio"]'),
    );
    expect(vacio).toBeFalsy();
    expect(component['sinMarcas']()).toBe(false);
  });

  it('el botón de reintentar del estado de error vuelve a llamar a marcas', async () => {
    serviceMock.marcas!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.marcas).toHaveBeenCalledTimes(1);

    serviceMock.marcas!.mockReturnValue(of(marcasFixture));

    const reintentar = fixture.debugElement.query(
      By.css('[data-testid="pf-marcas-reintentar"]'),
    );
    expect(reintentar).toBeTruthy();
    (reintentar.nativeElement as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.marcas).toHaveBeenCalledTimes(2);
    expect(component['error']()).toBe(false);
  });

  it('volver navega al calendario de planificación física', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component['volver']();

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith(['/app/planificacion-fisica']);
  });
});
