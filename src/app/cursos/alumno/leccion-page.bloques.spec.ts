import { Bloque } from '../models/curso.model';
import { filtrarBloquesRenderizables } from './leccion-page.component';

function bloque(extra: Partial<Bloque>): Bloque {
  return { id: 1, leccionId: 1, orden: 0, tipo: 'TEXTO', ...extra } as Bloque;
}

describe('filtrarBloquesRenderizables', () => {
  it('conserva solo el primer INTERACTIVO/HIDRAULICA y mantiene el resto ordenado', () => {
    const primero = bloque({
      id: 1,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'HIDRAULICA',
    });
    const texto = bloque({ id: 2, tipo: 'TEXTO', contenidoMarkdown: 'x' });
    const duplicado = bloque({
      id: 3,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'HIDRAULICA',
    });
    const final = bloque({ id: 4, tipo: 'VIDEO' });

    expect(
      filtrarBloquesRenderizables([primero, texto, duplicado, final]),
    ).toEqual([primero, texto, final]);
  });

  it('no descarta INTERACTIVO sin el código HIDRAULICA ni otros tipos', () => {
    const otro = bloque({
      id: 1,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'OTRA',
    });
    const texto = bloque({ id: 2 });
    const hidraulica = bloque({
      id: 3,
      tipo: 'INTERACTIVO',
      aplicacionCodigo: 'HIDRAULICA',
    });

    expect(filtrarBloquesRenderizables([otro, texto, hidraulica])).toEqual([
      otro,
      texto,
      hidraulica,
    ]);
  });

  it('mantiene todos los bloques si no hay aplicaciones Hidráulica', () => {
    const lista = [
      bloque({ id: 1, tipo: 'TEXTO' }),
      bloque({ id: 2, tipo: 'TEST' }),
      bloque({ id: 3, tipo: 'DOCUMENTO' }),
    ];
    expect(filtrarBloquesRenderizables(lista)).toEqual(lista);
  });
});
