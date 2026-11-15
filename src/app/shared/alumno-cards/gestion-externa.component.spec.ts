import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AlumnoAdminService } from '../../services/alumno-admin.service';
import { GestionExternaComponent } from './gestion-externa.component';
import { CursoAdministrable } from '../models/alumno-externo.model';

describe('Gestión externa: recupera intenciones sin duplicar concesiones', () => {
  const inventario = {
    capacidades: {},
    cursos: [],
    simulacros: [],
    tutorias: { invitaciones: [], creditos: [], reservas: [], compras: [] },
  };
  let api: {
    inventario: jest.Mock;
    accionManual: jest.Mock;
    operacion: jest.Mock;
  };
  let c: GestionExternaComponent;
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'a046fa76-e7dd-4976-bd4e-8a8e5f6ced72'),
    });
    api = {
      inventario: jest.fn().mockReturnValue(of(inventario)),
      accionManual: jest.fn(),
      operacion: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AlumnoAdminService, useValue: api }],
    });
    c = TestBed.runInInjectionContext(() => new GestionExternaComponent());
    c.alumnoId = 7;
  });
  it('un timeout conserva clave y payload aun si cambia el borrador antes de reintentar', async () => {
    api.accionManual
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(
        of({ usuarioId: 7, operacionId: 'op', avisoEstado: 'NO_SOLICITADO' }),
      );
    c.abrir('CreditoAlta');
    await c.guardar();
    expect(c.incierta).toBe(true);
    c.validoHasta = '2099-01-01T12:00';
    c.notificar = true;
    await c.guardar();
    expect(api.accionManual.mock.calls[1]).toEqual(
      api.accionManual.mock.calls[0],
    );
    expect(api.accionManual.mock.calls[0][2]).toEqual({ notificar: false });
    expect(c.dialogo).toBeNull();
  });
  it('una respuesta recuperada no vuelve a mutar el recurso ni pretende recuperar el enlace secreto', async () => {
    api.operacion.mockReturnValue(
      of({
        id: 'op',
        usuarioId: 7,
        estado: 'COMPLETADA',
        avisoEstado: 'NO_SOLICITADO',
        resultado: { mensaje: 'Concedido' },
      }),
    );
    await c.consultar('clave-perdida');
    expect(api.accionManual).not.toHaveBeenCalled();
    expect(c.resultado?.operacionId).toBe('op');
    expect(c.enlaceVisible).toBe('');
  });
  it('editar sin cambiar el valor visible conserva los segundos y milisegundos originales', async () => {
    api.accionManual.mockReturnValue(
      of({ usuarioId: 7, operacionId: 'op', avisoEstado: 'NO_SOLICITADO' }),
    );
    const curso = {
      id: 1,
      cursoId: 12,
      version: 4,
      manualExpiraEn: '2099-11-15T12:31:47.123Z',
    } as CursoAdministrable;
    c.abrir('CursoEditar', curso);
    await c.guardar();
    expect(api.accionManual.mock.calls[0][2].expiraEn).toBe(
      curso.manualExpiraEn,
    );
    expect(api.accionManual.mock.calls[0][2].version).toBe(4);
  });
  it('recarga y 404: recupera el payload congelado y reintenta la misma intención sin editarlo', async () => {
    api.accionManual
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(
        of({ usuarioId: 7, operacionId: 'op', avisoEstado: 'NO_SOLICITADO' }),
      );
    c.abrir('CreditoAlta');
    await c.guardar();
    const original = api.accionManual.mock.calls[0];
    const recargada = TestBed.runInInjectionContext(
      () => new GestionExternaComponent(),
    );
    recargada.alumnoId = 7;
    recargada.ngOnChanges();
    api.operacion.mockReturnValue(throwError(() => ({ status: 404 })));
    await recargada.consultar(original[3]);
    recargada.reintentarPendiente(original[3]);
    recargada.notificar = true;
    recargada.validoHasta = '2099-01-01T12:00';
    expect(recargada.puedeGuardar).toBe(true);
    await recargada.guardar();
    expect(api.accionManual.mock.calls[1]).toEqual(original);
    expect(recargada.pendientes).toEqual([]);
  });
  it.each(['timeout', 'respuesta pendiente'])(
    '%s: consultar PENDIENTE y recargar conserva el replay que recupera el aviso',
    async (respuesta) => {
      api.accionManual
        .mockReturnValueOnce(
          respuesta === 'timeout'
            ? throwError(() => ({ status: 0 }))
            : of({ usuarioId: 7, operacionId: 'op', avisoEstado: 'PENDIENTE' }),
        )
        .mockReturnValueOnce(
          of({
            usuarioId: 7,
            operacionId: 'op',
            avisoEstado: 'ACEPTADO_POR_PROVEEDOR',
          }),
        );
      c.abrir('CreditoAlta');
      c.notificar = true;
      await c.guardar();
      const original = api.accionManual.mock.calls[0];
      api.operacion.mockReturnValue(
        of({ id: 'op', usuarioId: 7, avisoEstado: 'PENDIENTE' }),
      );
      await c.consultar(original[3]);
      // También la consulta desde la tarjeta de resultado conserva la clave original.
      await c.consultar('op');
      expect(c.pendientes).toEqual([original[3]]);
      const recargada = TestBed.runInInjectionContext(
        () => new GestionExternaComponent(),
      );
      recargada.alumnoId = 7;
      recargada.ngOnChanges();
      recargada.reintentarPendiente(original[3]);
      expect(recargada.puedeGuardar).toBe(true);
      recargada.notificar = false;
      await recargada.guardar();
      expect(api.accionManual.mock.calls[1]).toEqual(original);
      expect(recargada.pendientes).toEqual([]);
      expect(recargada.solicitudesPendientes).toEqual({});
    },
  );
  it('consultar un aviso ya enviado retira también la intención original conservada', async () => {
    api.accionManual.mockReturnValue(
      of({ usuarioId: 7, operacionId: 'op', avisoEstado: 'PENDIENTE' }),
    );
    c.abrir('CreditoAlta');
    await c.guardar();
    api.operacion.mockReturnValue(
      of({ id: 'op', usuarioId: 7, avisoEstado: 'ACEPTADO_POR_PROVEEDOR' }),
    );
    await c.consultar('op');
    expect(c.pendientes).toEqual([]);
    expect(c.solicitudesPendientes).toEqual({});
  });
});
