import {
  coordenadasPdf,
  transformarRectangulo,
} from './librillo-pdf-coordenadas';

describe('Coordenadas del Librillo PDF', () => {
  it('reencuentra el mismo fragmento al rotar y acercar una caja recortada', () => {
    const caja = [10, 20, 210, 420];
    const rotada = coordenadasPdf(
      {
        width: 800,
        height: 400,
        convertToPdfPoint: (x, y) => [10 + y / 2, 20 + x / 2],
        convertToViewportPoint: (x, y) => [(y - 20) * 2, (x - 10) * 2],
      },
      caja,
    );
    const original = coordenadasPdf(
      {
        width: 200,
        height: 400,
        convertToPdfPoint: (x, y) => [10 + x, 420 - y],
        convertToViewportPoint: (x, y) => [x - 10, 420 - y],
      },
      caja,
    );
    const fragmento = { x: 0.2, y: 0.25, ancho: 0.4, alto: 0.125 };
    const ancla = transformarRectangulo(fragmento, original.alPdf);
    const visible = transformarRectangulo(ancla, rotada.aPantalla);
    expect(visible.x).toBeCloseTo(0.625);
    expect(visible.y).toBeCloseTo(0.2);
    expect(visible.ancho).toBeCloseTo(0.125);
    expect(visible.alto).toBeCloseTo(0.4);
    const recuperada = transformarRectangulo(visible, rotada.alPdf);
    expect(recuperada.x).toBeCloseTo(ancla.x);
    expect(recuperada.y).toBeCloseTo(ancla.y);
    expect(recuperada.ancho).toBeCloseTo(ancla.ancho);
    expect(recuperada.alto).toBeCloseTo(ancla.alto);
  });
});
