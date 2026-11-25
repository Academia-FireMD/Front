import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { LibrilloCuadernoService } from './librillo-cuaderno.service';
import {
  LibrilloPdfApiService,
  PAGINA_PDF_VACIA,
} from './librillo-pdf-api.service';

describe('LibrilloCuadernoService', () => {
  const edicion = { doc: 17, revision: '1'.repeat(64) };
  const clave = 'fixture-cuaderno-librillo';
  const nota = (texto: string) => ({ ...PAGINA_PDF_VACIA, nota: texto });
  let api: {
    abrir: ReturnType<typeof jest.fn>;
    guardar: ReturnType<typeof jest.fn>;
  };
  let servicio: LibrilloCuadernoService;

  beforeEach(() => {
    localStorage.removeItem(clave);
    api = { abrir: jest.fn(), guardar: jest.fn() };
    api.abrir.mockReturnValue(
      of({
        revision: edicion.revision,
        paginas: 2,
        generacion: 0,
        partes: [],
        referencias: [],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        LibrilloCuadernoService,
        { provide: LibrilloPdfApiService, useValue: api },
      ],
    });
    servicio = TestBed.inject(LibrilloCuadernoService);
  });

  afterEach(() => localStorage.removeItem(clave));

  it('conserva ambas versiones cuando otra sesión modifica la página', async () => {
    await servicio.abrir(edicion, clave);
    api.guardar.mockReturnValue(
      of({
        generacion: 0,
        partes: [
          { pagina: 1, version: 1, valor: nota('Perfil'), conflicto: true },
        ],
      }),
    );
    servicio.editar(1, nota('Pendiente'));
    await servicio.guardarAhora();
    expect(servicio.paginas()[1].nota).toBe('Pendiente');
    expect(servicio.conflictos()[1].valor.nota).toBe('Perfil');
    servicio.resolver(1, true);
    expect(servicio.paginas()[1].nota).toBe('Perfil');
    expect(localStorage.getItem(clave)).toBeNull();
  });

  it('no reenvía un borrador que pertenecía a una generación borrada', async () => {
    await servicio.abrir(edicion, clave);
    api.guardar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { generacion: 1 },
          }),
      ),
    );
    servicio.editar(2, nota('Anterior'));
    await servicio.guardarAhora();
    expect(servicio.estado()).toBe('reiniciado');
    await servicio.guardarAhora();
    expect(api.guardar).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(clave)).toContain('Anterior');
  });
  it('permite salir en solo lectura aunque el perfil no responda', async () => {
    api.abrir.mockReturnValue(throwError(() => new Error('sin conexión')));
    await servicio.abrir(edicion, clave);
    expect(await servicio.guardarAntesDeSalir()).toBe('guardado');
    expect(api.guardar).not.toHaveBeenCalled();
  });

  it('espera también un cambio hecho durante el guardado', async () => {
    await servicio.abrir(edicion, clave);
    const pendiente = new Subject<{
      generacion: number;
      partes: Array<{
        pagina: number;
        version: number;
        valor: typeof PAGINA_PDF_VACIA;
      }>;
    }>();
    api.guardar.mockReturnValueOnce(pendiente).mockReturnValueOnce(
      of({
        generacion: 0,
        partes: [{ pagina: 1, version: 2, valor: nota('Última') }],
      }),
    );
    servicio.editar(1, nota('Primera'));
    const salida = servicio.guardarAntesDeSalir();
    servicio.editar(1, nota('Última'));
    pendiente.next({
      generacion: 0,
      partes: [{ pagina: 1, version: 1, valor: nota('Primera') }],
    });
    expect(await salida).toBe('guardado');
    expect(api.guardar.mock.calls[1][2]).toEqual([
      { pagina: 1, base: 1, valor: nota('Última') },
    ]);
    expect(localStorage.getItem(clave)).toBeNull();
  });

  it('permite salir con copia vigente y bloquea cuando solo queda una copia anterior', async () => {
    await servicio.abrir(edicion, clave);
    api.guardar.mockReturnValue(throwError(() => new Error('sin conexión')));
    servicio.editar(1, nota('Copia local'));
    const escritura = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('sin espacio');
      });
    try {
      expect(await servicio.guardarAntesDeSalir()).toBe('local');
      servicio.editar(1, nota('Más reciente'));
      expect(await servicio.guardarAntesDeSalir()).toBe('fallo');
      expect(localStorage.getItem(clave)).toContain('Copia local');
    } finally {
      escritura.mockRestore();
    }
    expect(await servicio.guardarAntesDeSalir()).toBe('local');
    expect(localStorage.getItem(clave)).toContain('Más reciente');
  });
});
