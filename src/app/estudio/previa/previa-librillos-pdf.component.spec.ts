import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../services/auth.service';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { PreviaLibrillosPdfComponent } from './previa-librillos-pdf.component';

jest.mock('./previa-librillos-pdf.component-worker', () => ({
  crearWorkerPdf: jest.fn(),
}));

describe('Guardado de salida en un PDF con cuaderno legado', () => {
  const clave = 'previa-librillo:fixture:legado';
  let visor: PreviaLibrillosPdfComponent;

  beforeEach(() => {
    localStorage.removeItem(clave);
    TestBed.configureTestingModule({
      imports: [PreviaLibrillosPdfComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        {
          provide: AuthService,
          useValue: {
            sessionSnapshot: () => ({ sub: '17' }),
            isSessionCurrent: () => true,
          },
        },
      ],
    });
    visor = TestBed.createComponent(
      PreviaLibrillosPdfComponent,
    ).componentInstance;
    // La clave se conoce al abrir el PDF. El test no necesita cargar sus bytes.
    visor['clave'] = clave;
  });

  afterEach(() => localStorage.removeItem(clave));

  it('solo bloquea cambios de contenido pendientes y permite reintentar', async () => {
    const escritura = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('sin espacio');
      });
    try {
      expect(await visor.guardarAntesDeSalir()).toBe(true);
      expect(visor.estadoGuardadoAlSalir()).toBe('guardado');
      visor.editarNota('Nota de prueba');
      expect(await visor.guardarAntesDeSalir()).toBe(false);
      expect(visor.estadoGuardadoAlSalir()).toBe('fallo');
    } finally {
      escritura.mockRestore();
    }
    expect(await visor.guardarAntesDeSalir()).toBe(true);
    expect(visor.estadoGuardadoAlSalir()).toBe('local');
    expect(localStorage.getItem(clave)).toContain('Nota de prueba');
  });
});
