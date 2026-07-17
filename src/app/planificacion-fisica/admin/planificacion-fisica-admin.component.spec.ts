import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { Confirmation, ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { FileUpload } from 'primeng/fileupload';
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

  // Regresión de un bug cazado en QA visual (2026-07-17): el aviso de progreso
  // se emite desde el `accept` del primer diálogo. Cuando ambos compartían un
  // único <p-confirmDialog>, el cierre del primero se comía al segundo: el
  // confirm() SÍ se llamaba pero PrimeNG no lo pintaba nunca, así que el admin
  // confirmaba el borrado, no pasaba nada, y no veía ni un mensaje.
  // Un test unitario no puede comprobar que PrimeNG pinte (eso solo lo ve un
  // navegador), pero sí la invariante que lo arregla: los dos diálogos DEBEN
  // usar keys distintas, y esas keys deben existir en el template.
  it('los dos diálogos de borrado usan keys DISTINTAS (si se unifican, el aviso de progreso deja de verse)', async () => {
    fixture.detectChanges();

    // 1er intento (sin force) -> 409; 2o intento (con force) -> OK.
    // Si el mock devolviera 409 SIEMPRE, el accept del 2o diálogo reintentaría
    // en bucle infinito.
    serviceMock.eliminar!.mockImplementation((_id: number, force?: boolean) =>
      force
        ? of(undefined)
        : throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: {
                  message: 'tiene progreso',
                  progreso: 7,
                  confirmar: '...',
                },
              }),
          ),
    );

    const confirmationService = TestBed.inject(ConfirmationService);
    const keys: (string | undefined)[] = [];
    const confirmSpy = jest
      .spyOn(confirmationService, 'confirm')
      .mockImplementation((opts: Confirmation) => {
        keys.push(opts.key);
        (opts.accept as (() => void) | undefined)?.();
        return confirmationService;
      });

    component.eliminarBloque(bloqueFixture, new Event('click'));
    await new Promise((r) => setTimeout(r, 0));

    // Se abren DOS diálogos: el de confirmar y el aviso de progreso.
    expect(keys.length).toBe(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    // Esta es la invariante que arregla el bug: keys distintas.
    expect(keys[0]).not.toBe(keys[1]);

    // Y ambas keys deben existir en el template, o el diálogo no se pinta.
    const html: string = fixture.nativeElement.innerHTML;
    keys.forEach((k) => expect(html).toContain(k as string));

    confirmSpy.mockRestore();
  });

  it('onFileSelected limpia el p-fileUpload al seleccionar un fichero, para que una segunda selección siga funcionando (PrimeNG destruye su <input> tras la primera)', async () => {
    fixture.detectChanges();

    const clearSpy = jest.fn();
    // Sustituimos el ViewChild real por un stub: solo nos interesa
    // verificar que `clear()` se invoca, no el comportamiento interno
    // de PrimeNG.
    component['excelUpload'] = { clear: clearSpy } as unknown as FileUpload;

    const file = new File(['x'], 'plantilla.xlsx');
    await component.onFileSelected({ files: [file] });

    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('al eliminar un bloque con progreso de alumnos, pide una segunda confirmación explícita con el nº de marcas y solo reintenta con force=true si el admin la acepta', async () => {
    fixture.detectChanges();

    const error409 = new HttpErrorResponse({
      status: 409,
      error: {
        message: 'El bloque tiene progreso de alumnos registrado.',
        progreso: 42,
        confirmar: true,
      },
    });

    serviceMock
      .eliminar! // Primer intento (sin force): el backend rechaza porque hay progreso.
      .mockReturnValueOnce(throwError(() => error409))
      // Segundo intento (con force, tras la 2ª confirmación): éxito.
      .mockReturnValueOnce(of(undefined));

    const confirmCalls: Confirmation[] = [];
    const confirmSpy = jest
      .spyOn(TestBed.inject(ConfirmationService), 'confirm')
      .mockImplementation((opts) => {
        confirmCalls.push(opts);
        if (confirmCalls.length === 1) {
          // 1ª confirmación ("¿estás seguro?"): el admin acepta siempre.
          opts.accept?.();
        }
        // La 2ª confirmación (aviso de progreso) la dispara el propio
        // componente al recibir el 409 — la controla el test explícitamente
        // más abajo, no se auto-acepta aquí.
        return TestBed.inject(ConfirmationService);
      });

    component.eliminarBloque(bloqueFixture, new Event('click'));
    // Deja que el primer eliminar() (que rechaza) se propague y dispare
    // la 2ª llamada a confirm() dentro del catch.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Todavía NO se ha borrado nada: solo el primer intento (sin force) se
    // ha hecho, y se ha mostrado el 2º aviso con el nº real de marcas.
    expect(serviceMock.eliminar).toHaveBeenCalledTimes(1);
    expect(serviceMock.eliminar).toHaveBeenNthCalledWith(
      1,
      bloqueFixture.id,
      false,
    );
    expect(confirmCalls.length).toBe(2);
    expect(confirmCalls[1].message).toContain('42');
    expect(confirmCalls[1].header).toContain('progreso');
    expect(serviceMock.listarBloques).not.toHaveBeenCalledTimes(2);

    // El admin acepta el 2º aviso ("Sí, eliminar de todas formas").
    confirmCalls[1].accept?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(serviceMock.eliminar).toHaveBeenCalledTimes(2);
    expect(serviceMock.eliminar).toHaveBeenNthCalledWith(
      2,
      bloqueFixture.id,
      true,
    );

    confirmSpy.mockRestore();
  });

  it('si el admin rechaza el 2º aviso de progreso, NUNCA se reintenta el borrado con force', async () => {
    fixture.detectChanges();

    const error409 = new HttpErrorResponse({
      status: 409,
      error: {
        message: 'El bloque tiene progreso de alumnos registrado.',
        progreso: 7,
        confirmar: true,
      },
    });

    serviceMock.eliminar!.mockReturnValueOnce(throwError(() => error409));

    const confirmCalls: Confirmation[] = [];
    const confirmSpy = jest
      .spyOn(TestBed.inject(ConfirmationService), 'confirm')
      .mockImplementation((opts) => {
        confirmCalls.push(opts);
        if (confirmCalls.length === 1) {
          opts.accept?.();
        }
        // 2ª confirmación: NO se auto-acepta; el admin la rechaza (no se
        // invoca `accept`, que es como PrimeNG modela un `reject`/dismiss
        // cuando el componente no define callback de `reject`).
        return TestBed.inject(ConfirmationService);
      });

    component.eliminarBloque(bloqueFixture, new Event('click'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(confirmCalls.length).toBe(2);
    expect(serviceMock.eliminar).toHaveBeenCalledTimes(1);

    // El admin cierra/rechaza el 2º diálogo: nunca se llama a `accept`.
    confirmCalls[1].reject?.();
    await Promise.resolve();

    expect(serviceMock.eliminar).toHaveBeenCalledTimes(1);
    expect(serviceMock.eliminar).toHaveBeenCalledWith(bloqueFixture.id, false);

    confirmSpy.mockRestore();
  });

  it('verDetalles navega a la ventana de edición de detalles del bloque', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.verDetalles(bloqueFixture);

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion-fisica/admin',
      bloqueFixture.id,
      'detalles',
    ]);
  });
});
