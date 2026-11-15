import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AlumnoAdminService } from '../../services/alumno-admin.service';
import { NuevoAlumnoExternoComponent } from './nuevo-alumno-externo.component';

describe('Alta externa: recuperación tras recarga', () => {
  let api: { accionManual: jest.Mock; consultarAlta: jest.Mock };
  const crear = () =>
    TestBed.runInInjectionContext(() => new NuevoAlumnoExternoComponent());
  beforeEach(() => {
    sessionStorage.clear();
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => '3292fd29-0300-483e-ab11-5cf5926b477c'),
    });
    api = { accionManual: jest.fn(), consultarAlta: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AlumnoAdminService, useValue: api },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
  });
  it('conserva datos y clave tras timeout, recarga y consulta 404; reintenta sin crear una intención distinta', async () => {
    api.accionManual
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(
        of({ usuarioId: 7, operacionId: 'op', avisoEstado: 'NO_SOLICITADO' }),
      );
    const inicial = crear();
    inicial.abrir();
    inicial.nombre = 'Nombre';
    inicial.apellidos = 'Apellido';
    inicial.email = 'ALUMNO@example.test';
    await inicial.guardar();
    const original = api.accionManual.mock.calls[0];
    const recargada = crear();
    recargada.abrir();
    expect(recargada.incierta).toBe(true);
    expect(recargada.nombre).toBe('Nombre');
    api.consultarAlta.mockReturnValue(throwError(() => ({ status: 404 })));
    await recargada.comprobar();
    recargada.email = 'distinto@example.test';
    recargada.notificar = true;
    await recargada.guardar();
    expect(api.accionManual.mock.calls[1]).toEqual(original);
    expect(recargada.resultado?.usuarioId).toBe(7);
    expect(JSON.stringify(sessionStorage)).not.toContain('enlaceAcceso');
  });
  it('la intención de otro administrador no se recupera al cambiar de cuenta', async () => {
    const token = (id: number) =>
      'x.' + btoa(JSON.stringify({ sub: id })) + '.x';
    sessionStorage.setItem('authToken', token(1));
    api.accionManual.mockReturnValue(throwError(() => ({ status: 0 })));
    const a = crear();
    a.abrir();
    a.nombre = 'Admin A';
    a.email = 'a@example.test';
    await a.guardar();
    sessionStorage.setItem('authToken', token(2));
    const b = crear();
    b.abrir();
    expect(b.incierta).toBe(false);
    expect(b.nombre).toBe('');
  });
  it('una segunda alta comienza vacía y no vuelve a mostrar el enlace ya recibido', async () => {
    api.accionManual.mockReturnValue(
      of({
        usuarioId: 7,
        operacionId: 'op',
        avisoEstado: 'NO_SOLICITADO',
        enlaceAcceso: 'https://example.test/reset?token=privado',
      }),
    );
    const c = crear();
    c.abrir();
    c.nombre = 'Alta';
    c.apellidos = 'Una';
    c.email = 'una@example.test';
    await c.guardar();
    c.visible = false;
    c.abrir();
    expect(c.resultado).toBeNull();
    expect(c.email).toBe('');
    expect(c.incierta).toBe(false);
    expect(JSON.stringify(sessionStorage)).not.toContain('privado');
  });
});
