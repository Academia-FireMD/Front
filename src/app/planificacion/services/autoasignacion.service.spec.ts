import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../environments/environment';
import { NivelOposicion } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import type { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import type { ConfiguracionPlanificacion } from '../models/autoasignacion.model';
import { AutoasignacionService } from './autoasignacion.service';

describe('AutoasignacionService', () => {
  let service: AutoasignacionService;
  let httpMock: HttpTestingController;

  const configuracionRespuesta: ConfiguracionPlanificacion = {
    estado: 'REQUIERE_CONFIGURACION',
    preferenciasPrecargadas: {
      oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
      nivel: null,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
    },
    oposicionesPermitidas: [
      Oposicion.GENERAL,
      Oposicion.VALENCIA_AYUNTAMIENTO,
      Oposicion.ALICANTE_CPBA,
      Oposicion.MADRID,
    ],
    configuracionActiva: null,
    ultimaRecomendacion: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AutoasignacionService,
        { provide: ToastrService, useValue: { error: jest.fn() } },
      ],
    });
    service = TestBed.inject(AutoasignacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GET /configuracion usa la ruta exacta', () => {
    let recibida: unknown;
    service.getConfiguracion$().subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/configuracion`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(configuracionRespuesta);

    expect(recibida).toEqual(configuracionRespuesta);
  });

  it('POST /recomendacion-nivel envía las 5 respuestas y devuelve la recomendación', () => {
    const respuesta = { puntuacion: 12, nivelRecomendado: 'AVANZADO' };
    let recibida: unknown;

    service
      .recomendarNivel$([0, 3, 2, 1, 3], 1)
      .subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/recomendacion-nivel`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      respuestas: [0, 3, 2, 1, 3],
      versionCuestionario: 1,
    });
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });

  it('GET /cuestionario-nivel obtiene la definición canónica versionada', () => {
    service.getCuestionarioNivel$().subscribe();

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/cuestionario-nivel`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ version: 1, preguntas: [] });
  });

  it('PUT /configuracion usa la ruta exacta, envía version y conserva el error 409', () => {
    let recibida: unknown;
    let capturado: unknown;

    service
      .guardarConfiguracion$({
        oposicion: Oposicion.ALICANTE_CPBA,
        nivel: NivelOposicion.AVANZADO,
        franja: 'FRANJA_SEIS_A_OCHO_HORAS' as TipoDePlanificacionDeseada,
        version: 2,
      })
      .subscribe({
        next: (r) => (recibida = r),
        error: (e) => (capturado = e),
      });

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/configuracion`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      oposicion: 'ALICANTE_CPBA',
      nivel: NivelOposicion.AVANZADO,
      franja: 'FRANJA_SEIS_A_OCHO_HORAS',
      version: 2,
    });

    request.flush(
      { message: 'Versión desfasada' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(capturado).toBeInstanceOf(HttpErrorResponse);
    expect((capturado as HttpErrorResponse).status).toBe(409);
    expect(recibida).toBeUndefined();
  });

  it('POST /tutor/:id/recomendar envía el nivel', () => {
    let recibida: unknown;

    service
      .recomendarNivelTutor$(42, NivelOposicion.AVANZADO)
      .subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/tutor/42/recomendar`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ nivel: NivelOposicion.AVANZADO });
    request.flush({ ok: true, nivel: NivelOposicion.AVANZADO });

    expect(recibida).toEqual({ ok: true, nivel: NivelOposicion.AVANZADO });
  });

  it('POST /tutor/:id/forzar envía combinación, motivo y versión', () => {
    let recibida: unknown;

    service
      .forzarConfiguracionTutor$(42, {
        oposicion: Oposicion.GENERAL,
        nivel: NivelOposicion.INICIACION,
        franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
        motivo: 'Cambio por falta de disponibilidad',
        version: 2,
      })
      .subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/tutor/42/forzar`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      oposicion: Oposicion.GENERAL,
      nivel: NivelOposicion.INICIACION,
      franja: 'FRANJA_CUATRO_A_SEIS_HORAS',
      motivo: 'Cambio por falta de disponibilidad',
      version: 2,
    });
    request.flush(configuracionRespuesta);

    expect(recibida).toEqual(configuracionRespuesta);
  });

  it('GET /tutor/alumnos usa el contrato acotado del panel tutor', () => {
    let recibida: unknown;
    const respuesta = [
      {
        alumno: { id: 42, nombre: 'Ana', apellidos: 'A', email: 'a@a.es' },
        configuracion: null,
        preferencias: {
          oposicion: Oposicion.MADRID,
          nivel: null,
          franja: null,
        },
        oposicionesPermitidas: [Oposicion.MADRID],
        opcionesPermitidas: [],
        recomendacion: null,
      },
    ];

    service.getTutorAlumnos$().subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/tutor/alumnos`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });

  it('GET /admin/alumnos/:id/configuracion usa el contrato acotado del diálogo admin', () => {
    let recibida: unknown;

    service.getAdminAlumnoConfiguracion$(42).subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/alumnos/42/configuracion`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      alumno: { id: 42, nombre: 'Ana', apellidos: 'A', email: 'a@a.es' },
      configuracion: null,
      preferencias: {
        oposicion: Oposicion.MADRID,
        nivel: null,
        franja: null,
      },
      oposicionesPermitidas: [Oposicion.MADRID],
      opcionesPermitidas: [],
      recomendacion: null,
    });

    expect(recibida).toEqual(
      expect.objectContaining({ oposicionesPermitidas: [Oposicion.MADRID] }),
    );
  });

  it('CRUD admin: variantes GET/POST/PATCH y reglas GET/POST/PATCH', () => {
    service.getVariantes$().subscribe();
    let req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/variantes`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);

    service
      .crearVariante$({
        codigo: 'GA4-6',
        oposicion: Oposicion.GENERAL,
        nivel: NivelOposicion.AVANZADO,
        franja: 'FRANJA_CUATRO_A_SEIS_HORAS' as TipoDePlanificacionDeseada,
        activa: true,
      })
      .subscribe();
    req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/variantes`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});

    service.publicarVariante$(3, 17).subscribe();
    req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/variantes/3/publicar`,
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ planificacionMensualId: 17 });
    req.flush({});

    service
      .actualizarVariante$(3, {
        activa: false,
        planificacionMensualId: null,
      })
      .subscribe();
    req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/variantes/3`,
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      activa: false,
      planificacionMensualId: null,
    });
    req.flush({});

    service.getReglas$().subscribe();
    req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/reglas`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);

    service
      .crearRegla$({
        oposicionSuscripcion: Oposicion.MADRID,
        oposicionPlanificacion: Oposicion.MADRID,
        activa: true,
      })
      .subscribe();
    req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/reglas`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({});

    service.actualizarRegla$(5, { activa: false }).subscribe();
    req = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/reglas/5`,
    );
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('GET /admin/sin-coincidencia devuelve la lista', () => {
    let recibida: unknown;
    const respuesta = [{ id: 1, email: 'a@a.es', nombre: 'A', apellidos: 'B' }];

    service.getSinCoincidencia$().subscribe((r) => (recibida = r));

    const request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/sin-coincidencia`,
    );
    expect(request.request.method).toBe('GET');
    request.flush(respuesta);

    expect(recibida).toEqual(respuesta);
  });

  it('POST /admin/reconciliar distingue preview de apply', () => {
    let recibida: unknown;

    service.reconciliar$(false).subscribe((r) => (recibida = r));

    const preview = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/reconciliar`,
    );
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({ aplicar: false });
    preview.flush({
      aplicar: false,
      previewHash: 'preview-1',
      totalElegibles: 2,
      aplicables: 1,
      aplicados: 0,
      noAplicables: 1,
      casos: [],
    });

    expect(recibida).toEqual(
      expect.objectContaining({ aplicar: false, aplicables: 1 }),
    );

    service.reconciliar$(true, 'preview-1').subscribe();
    const apply = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/reconciliar`,
    );
    expect(apply.request.body).toEqual({
      aplicar: true,
      previewHash: 'preview-1',
    });
    apply.flush({
      aplicar: true,
      previewHash: 'preview-1',
      totalElegibles: 2,
      aplicables: 1,
      aplicados: 1,
      noAplicables: 1,
      casos: [],
    });
  });

  it('usa multipart y el hash de preview para importar plantillas', () => {
    const file = new File(['xlsx'], 'madrid.xlsx');

    service.previewImportacionPlantillas$(file, 'CMI6-8').subscribe();
    let request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/importaciones/plantillas/preview`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(((request.request.body as FormData).get('file') as File).name).toBe(
      file.name,
    );
    expect((request.request.body as FormData).get('sheetName')).toBe('CMI6-8');
    request.flush({});

    service.applyImportacionPlantillas$(file, 'a'.repeat(64), true).subscribe();
    request = httpMock.expectOne(
      `${environment.apiUrl}/planificaciones/admin/importaciones/plantillas/apply`,
    );
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect((body.get('file') as File).name).toBe(file.name);
    expect(body.get('expectedFileHash')).toBe('a'.repeat(64));
    expect(body.get('forzarSobrescritura')).toBe('true');
    request.flush({});
  });
});
