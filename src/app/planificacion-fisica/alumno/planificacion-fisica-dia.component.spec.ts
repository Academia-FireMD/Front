import { registerLocaleData } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import localeEs from '@angular/common/locales/es';
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subject, of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../../shared/models/subscription.model';
import {
  DiaDetalle,
  MiPlan,
  PlanificacionFisicaService,
} from '../services/planificacion-fisica.service';
import { PlanificacionFisicaDiaComponent } from './planificacion-fisica-dia.component';

registerLocaleData(localeEs);

describe('PlanificacionFisicaDiaComponent', () => {
  let fixture: ComponentFixture<PlanificacionFisicaDiaComponent>;
  let component: PlanificacionFisicaDiaComponent;
  let serviceMock: Partial<Record<keyof PlanificacionFisicaService, jest.Mock>>;

  const diaFixture: DiaDetalle = {
    fecha: '2026-07-17',
    comentarioSemana: 'Semana de carga',
    comentarioGeneral: 'Bloque general',
    intensidad: 75,
    numeroSemana: 28,
    identificadorBloque: 'BLOQUE-AVANZADO-A',
    tipoPlan: 'ADVANCED',
    soloLectura: false,
    esHoy: true,
    disciplinas: [
      {
        asignacionId: 501,
        disciplinaId: 1,
        nombre: 'Cuerda',
        grupo: 'CUERDA',
        color: '#9fe2d0',
        contenido: '3x10m',
        comentario: 'Controla el descanso entre series.',
        realizado: false,
      },
      {
        asignacionId: 502,
        disciplinaId: 2,
        nombre: 'Carrera',
        grupo: 'CARRERA',
        color: '#fdeaa8',
        contenido: null,
        comentario: 'suave',
        realizado: true,
      },
    ],
  };

  const miPlanFixture: MiPlan = {
    bloque: {
      id: 1,
      identificador: 'BLOQUE-1',
      comentarioGeneral: null,
      fechaInicioSemana1: '2026-07-01',
      numSemanas: 4,
      relevancia: [Oposicion.VALENCIA_AYUNTAMIENTO],
      estado: 'PUBLICADO',
    },
    hoy: '2026-07-17',
    semanas: [
      {
        id: 10,
        indice: 0,
        numeroAno: 1,
        fechaInicio: '2026-07-17',
        intensidad: 20,
        comentarioSemana: null,
        esActual: true,
        esAnterior: false,
        soloLectura: false,
        progreso: { hechas: 1, total: 2 },
        dias: [{ fecha: '2026-07-17', diaSemana: 5, chips: [] }],
      },
    ],
  };

  function setup(
    fecha = '2026-07-17',
    bloqueId?: string,
    originPlanificacionId?: string,
  ): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          paramMap: { get: () => fecha },
          queryParamMap: {
            get: (key: string) =>
              key === 'bloqueId'
                ? (bloqueId ?? null)
                : key === 'originPlanificacionId'
                  ? (originPlanificacionId ?? null)
                  : null,
          },
        },
      },
    });
    fixture = TestBed.createComponent(PlanificacionFisicaDiaComponent);
    component = fixture.componentInstance;
  }

  beforeEach(async () => {
    serviceMock = {
      dia: jest.fn().mockReturnValue(of(diaFixture)),
      miPlan: jest.fn().mockReturnValue(of(miPlanFixture)),
      marcarProgreso: jest
        .fn()
        .mockReturnValue(
          of({ realizado: true, realizadoEn: '2026-07-17T10:00:00Z' }),
        ),
    };

    await TestBed.configureTestingModule({
      imports: [PlanificacionFisicaDiaComponent, NoopAnimationsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PlanificacionFisicaService, useValue: serviceMock },
        // La app corre en español (`app.module.ts`): la cabecera del día es
        // texto en español y su capitalización solo se puede verificar con
        // este locale.
        { provide: LOCALE_ID, useValue: 'es' },
      ],
    }).compileComponents();
  });

  it('la cabecera capitaliza SOLO la primera palabra ("Viernes, 17 de julio")', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const titulo = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-titulo"]'),
    ).nativeElement as HTMLElement;
    // El `text-transform: capitalize` que había ponía "17 De Julio".
    expect(titulo.textContent?.trim()).toBe('Viernes, 17 de julio');
  });

  it('descanso no muestra botón ni cuenta como tarea completables', async () => {
    serviceMock.dia!.mockReturnValue(
      of({
        ...diaFixture,
        disciplinas: [
          {
            ...diaFixture.disciplinas[0],
            asignacionId: 503,
            nombre: 'Descanso',
            grupo: 'DESCANSO',
            realizado: false,
          },
        ],
      }),
    );
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['progreso']()).toEqual({ hechas: 0, total: 0 });
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-dia-progreso"]')),
    ).toBeFalsy();
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-dia-descanso"]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="pf-dia-boton-marcar-503"]'),
      ),
    ).toBeFalsy();
  });

  it('un día vacío no se presenta como día de descanso', async () => {
    serviceMock.dia!.mockReturnValue(of({ ...diaFixture, disciplinas: [] }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['esDiaDeDescanso']()).toBe(false);
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-dia-descanso"]')),
    ).toBeFalsy();
    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-dia-progreso"]')),
    ).toBeFalsy();
    expect(
      fixture.debugElement.query(
        By.css('[data-testid="pf-dia-sin-disciplinas"]'),
      ),
    ).toBeTruthy();
  });

  it('carga día y plan para el bloque indicado en query', async () => {
    setup('2026-07-17', '3');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceMock.dia).toHaveBeenCalledWith('2026-07-17', 3);
    expect(serviceMock.miPlan).toHaveBeenCalledWith(3);
  });

  it('carga el día y pinta cada disciplina con su contenido', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.dia).toHaveBeenCalledWith('2026-07-17', undefined);
    expect(serviceMock.miPlan).toHaveBeenCalledWith(undefined);
    expect(component['detalle']()).toEqual(diaFixture);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('3x10m');
    expect(html).toContain('Sin detalle aún.');
  });

  it('renderiza el banner de comentarios de la semana y general', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const banner = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-comentarios-banner"]'),
    );
    const comentarioSemana = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-comentario-semana"]'),
    );
    const comentarioGeneral = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-comentario-general"]'),
    );
    expect(banner).toBeTruthy();
    expect(comentarioSemana.nativeElement.textContent).toContain(
      'Semana de carga',
    );
    expect(
      comentarioGeneral.nativeElement.compareDocumentPosition(
        comentarioSemana.nativeElement,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const html = banner.nativeElement.textContent;
    expect(html).toContain('Comentario de la semana:');
    expect(html).toContain('Semana de carga');
    expect(html).toContain('Comentario general:');
    expect(html).not.toContain('Comentario del bloque: Bloque general');
    expect(html).toContain('Bloque general');
  });

  it('muestra el plan comercial canónico, nunca el identificador del bloque', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const badge = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-badge-plan"]'),
    );
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent).toContain('Plan Avanzado');
    expect(badge.nativeElement.textContent).not.toContain('BLOQUE-AVANZADO-A');
  });

  it('separa la cabecera abreviada del detalle temporal dentro de la tarjeta', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const resumen = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-resumen"]'),
    ).nativeElement as HTMLElement;
    const detalle = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-titulo"]'),
    ).nativeElement as HTMLElement;
    expect(resumen.textContent?.trim()).toBe('Viernes 17 jul · Semana 28');
    expect(detalle.textContent?.trim()).toBe('Viernes, 17 de julio');
  });

  it('muestra el subtítulo solo con la semana, sin intensidad', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const subtitulo = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-subtitulo"]'),
    );
    expect(subtitulo.nativeElement.textContent.trim()).toBe('Semana 28');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Intensidad',
    );
  });

  it('distingue visualmente disciplinas hechas y pendientes', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Cuerda (501) está pendiente: botón "Marcar como hecho".
    const botonPendiente = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-marcar-501"]'),
    );
    expect(botonPendiente).toBeTruthy();
    expect(botonPendiente.nativeElement.textContent).toContain(
      'Marcar como hecho',
    );
    expect(botonPendiente.componentInstance.severity).toBe('warning');
    expect(
      botonPendiente
        .query(By.css('button'))
        .nativeElement.getAttribute('aria-label'),
    ).toBe('Marcar como hecho');

    // Carrera (502) está hecha: botón "Hecho".
    const botonHecho = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-hecho-502"]'),
    );
    expect(botonHecho).toBeTruthy();
    expect(botonHecho.nativeElement.textContent).toContain('Hecho');
    expect(botonHecho.componentInstance.severity).toBe('success');
    expect(
      botonHecho
        .query(By.css('button'))
        .nativeElement.getAttribute('aria-label'),
    ).toBe('Marcar como pendiente');
  });

  it('tiñe cada tarjeta con el color de su disciplina', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tarjeta = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-disciplina-501"]'),
    );

    expect(tarjeta).toBeTruthy();
    expect(
      tarjeta.nativeElement.style.getPropertyValue('--pf-dia-disciplina-color'),
    ).toBe('#9fe2d0');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.p-card.pf-dia__disciplina',
      ),
    ).toBeTruthy();
  });

  it('renderiza el comentario del bloque en la clase de comentario', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const comentario = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-comentario-bloque-502"]'),
    );
    expect(comentario).toBeTruthy();
    expect(comentario.nativeElement.textContent).toContain('suave');
    expect(comentario.nativeElement.textContent).toContain(
      'Comentario del bloque:',
    );
    expect(comentario.classes['pf-dia__disciplina-comentario']).toBe(true);
    expect(comentario.nativeElement.tagName).toBe('P');
  });

  it('renderiza el comentario de cada disciplina antes de su contenido', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const tarjeta = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-disciplina-501"]'),
    ).nativeElement as HTMLElement;
    const comentario = tarjeta.querySelector(
      '[data-testid="pf-dia-comentario-bloque-501"]',
    ) as HTMLElement;
    const contenido = tarjeta.querySelector(
      '.pf-dia__disciplina-contenido',
    ) as HTMLElement;

    expect(comentario.textContent).toContain(
      'Controla el descanso entre series.',
    );
    expect(contenido.textContent).toContain('3x10m');
    expect(
      comentario.compareDocumentPosition(contenido) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('click en "Marcar como hecho" llama al servicio y actualiza el estado local', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const boton = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-marcar-501"]'),
    );
    boton.nativeElement.click();
    await fixture.whenStable();

    expect(serviceMock.marcarProgreso).toHaveBeenCalledWith(501, true, 1);
    expect(
      component['detalle']()?.disciplinas.find((d) => d.asignacionId === 501)
        ?.realizado,
    ).toBe(true);
  });

  it('marcar progreso llama al servicio y actualiza el estado local', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await component['toggle'](diaFixture.disciplinas[0]);

    expect(serviceMock.marcarProgreso).toHaveBeenCalledWith(501, true, 1);
    expect(
      component['detalle']()?.disciplinas.find((d) => d.asignacionId === 501)
        ?.realizado,
    ).toBe(true);
  });

  it('deshabilita el botón "Marcar como hecho" mientras el PUT de marcarProgreso está en vuelo (evita doble-click → doble PUT)', async () => {
    const marcarProgreso$ = new Subject<{
      realizado: boolean;
      realizadoEn: string;
    }>();
    serviceMock.marcarProgreso!.mockReturnValue(marcarProgreso$);

    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const primerClick = component['toggle'](diaFixture.disciplinas[0]);
    // Aún no resuelve la petición: el botón debe quedar deshabilitado.
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['estaGuardando'](501)).toBe(true);

    const boton = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-marcar-501"]'),
    );
    const botonNative = boton.query(By.css('button'))
      .nativeElement as HTMLButtonElement;
    expect(botonNative.disabled).toBe(true);

    // Un segundo click mientras la primera petición sigue en vuelo NO debe
    // disparar un segundo PUT.
    await component['toggle'](diaFixture.disciplinas[0]);
    expect(serviceMock.marcarProgreso).toHaveBeenCalledTimes(1);

    marcarProgreso$.next({
      realizado: true,
      realizadoEn: '2026-07-17T10:00:00Z',
    });
    marcarProgreso$.complete();
    await primerClick;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['estaGuardando'](501)).toBe(false);
    // Tras completarse, la disciplina pasa a hecho y el botón cambia.
    const botonHecho = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-hecho-501"]'),
    );
    expect(botonHecho).toBeTruthy();
  });

  it('usa soloLectura de dia y NO permite marcar en la semana anterior', async () => {
    serviceMock.dia!.mockReturnValue(of({ ...diaFixture, soloLectura: true }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['soloLectura']()).toBe(true);

    await component['toggle'](diaFixture.disciplinas[0]);
    // No debe haber llamado al backend: la UI bloquea el toggle localmente.
    expect(serviceMock.marcarProgreso).not.toHaveBeenCalled();

    const aviso = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-solo-lectura"]'),
    );
    expect(aviso).toBeTruthy();
  });

  it('soloLectura de dia bloquea el PUT aunque miPlan best-effort falle', async () => {
    serviceMock.dia!.mockReturnValue(of({ ...diaFixture, soloLectura: true }));
    serviceMock.miPlan!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['soloLectura']()).toBe(true);
    const boton = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-marcar-501"] button'),
    ).nativeElement as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    await component['toggle'](diaFixture.disciplinas[0]);
    expect(serviceMock.marcarProgreso).not.toHaveBeenCalled();
  });

  it('no llama «Hoy» al progreso de una fecha pasada o futura', async () => {
    serviceMock.dia!.mockReturnValue(of({ ...diaFixture, esHoy: false }));
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .query(
          By.css('[data-testid="pf-dia-progreso"] .pf-dia__progreso-label'),
        )
        .nativeElement.textContent.trim(),
    ).toBe('Progreso del día');
  });

  it('muestra la píldora de upsell cuando `dia()` responde 403 TIER_TOO_LOW', async () => {
    serviceMock.dia!.mockReturnValue(
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
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const pill = fixture.debugElement.query(
      By.css('[data-testid="pf-upsell-pill"]'),
    );
    expect(pill).toBeTruthy();
  });

  it('volver navega al calendario', async () => {
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    component['volver']();

    const router = TestBed.inject(Router);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/app/planificacion-fisica'],
      {
        queryParams: { bloqueId: 1 },
      },
    );
  });

  it.each(['abc', '0', '-1', '1.5', '9007199254740992'])(
    'ignora bloqueId inválido %s',
    async (bloqueId) => {
      setup('2026-07-17', bloqueId);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(serviceMock.dia).toHaveBeenCalledWith('2026-07-17', undefined);
      expect(serviceMock.miPlan).toHaveBeenCalledWith(undefined);
    },
  );

  it('permite desmarcar una disciplina hecha y conserva el label visible accesible', async () => {
    serviceMock.marcarProgreso!.mockReturnValue(
      of({ realizado: false, realizadoEn: '2026-07-17T10:00:00Z' }),
    );
    setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component['toggle'](diaFixture.disciplinas[1]);
    expect(serviceMock.marcarProgreso).toHaveBeenCalledWith(502, false, 1);
    expect(
      component['detalle']()?.disciplinas.find((d) => d.asignacionId === 502)
        ?.realizado,
    ).toBe(false);
    fixture.detectChanges();

    const boton = fixture.debugElement.query(
      By.css('[data-testid="pf-dia-boton-marcar-502"]'),
    );
    expect(
      boton.query(By.css('button')).nativeElement.getAttribute('aria-label'),
    ).toBe('Marcar como hecho');
  });

  it('si el PUT falla conserva estado, muestra toast y libera el guard', async () => {
    serviceMock.marcarProgreso!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    setup();
    fixture.detectChanges();
    await fixture.whenStable();

    await component['toggle'](diaFixture.disciplinas[0]);

    expect(component['detalle']()?.disciplinas[0].realizado).toBe(false);
    expect(component['estaGuardando'](501)).toBe(false);
    expect(TestBed.inject(ToastrService).error).toHaveBeenCalled();
  });

  it('muestra error de carga y reintenta con fecha y bloque originales', async () => {
    serviceMock.dia!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    setup('2026-07-17', '3');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="pf-dia-error"]')),
    ).toBeTruthy();
    serviceMock.dia!.mockReturnValue(of(diaFixture));
    component['reintentar']();
    await fixture.whenStable();

    expect(serviceMock.dia).toHaveBeenLastCalledWith('2026-07-17', 3);
  });

  it('si el bloque explícito ya no existe vuelve al plan de temario de origen', async () => {
    serviceMock.dia!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    setup('2026-07-17', '3', '91');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(ToastrService).warning).toHaveBeenCalledWith(
      'La planificación física ha cambiado.',
    );
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
      '/app/planificacion/planificacion-mensual-alumno',
      91,
    ]);
    expect(component['errorCarga']()).toBe(false);
  });

  it('si el bloque explícito ya no existe y no hay origen vuelve al calendario físico', async () => {
    serviceMock.dia!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    setup('2026-07-17', '3');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([
      '/app/planificacion-fisica',
    ]);
    expect(component['errorCarga']()).toBe(false);
  });

  it('un fallo de miPlan no bloquea el detalle del día', async () => {
    serviceMock.miPlan!.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    setup('2026-07-17', '3');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component['detalle']()).toEqual(diaFixture);
    expect(component['errorCarga']()).toBe(false);
  });
});
