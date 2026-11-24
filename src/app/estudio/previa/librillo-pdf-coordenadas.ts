import type { PageViewport } from 'pdfjs-dist';
import { PuntoPdf, RectanguloPdf } from './librillo-pdf-api.service';

const unidad = (valor: number) => Math.min(1, Math.max(0, valor));

// La caja efectiva de PDF.js es la porción visible de CropBox y MediaBox.
// Guardamos coordenadas dentro de esa caja, con el origen arriba a la izquierda.
export function coordenadasPdf(
  viewport: Pick<
    PageViewport,
    'width' | 'height' | 'convertToPdfPoint' | 'convertToViewportPoint'
  >,
  caja: number[],
) {
  const [xInicial, yInicial, xFinal, yFinal] = caja;
  const anchoPdf = xFinal - xInicial;
  const altoPdf = yFinal - yInicial;

  const alPdf = ({ x, y }: PuntoPdf): PuntoPdf => {
    const [px, py] = viewport.convertToPdfPoint(
      x * viewport.width,
      y * viewport.height,
    );
    return {
      x: unidad((px - xInicial) / anchoPdf),
      y: unidad((yFinal - py) / altoPdf),
    };
  };

  const aPantalla = ({ x, y }: PuntoPdf): PuntoPdf => {
    const [px, py] = viewport.convertToViewportPoint(
      xInicial + x * anchoPdf,
      yFinal - y * altoPdf,
    );
    return { x: unidad(px / viewport.width), y: unidad(py / viewport.height) };
  };

  return { alPdf, aPantalla };
}

export function transformarRectangulo(
  rectangulo: RectanguloPdf,
  transformar: (punto: PuntoPdf) => PuntoPdf,
): RectanguloPdf {
  const primero = transformar(rectangulo);
  const ultimo = transformar({
    x: rectangulo.x + rectangulo.ancho,
    y: rectangulo.y + rectangulo.alto,
  });
  const x = Math.min(primero.x, ultimo.x);
  const y = Math.min(primero.y, ultimo.y);
  return {
    x,
    y,
    ancho: Math.min(1 - x, Math.abs(ultimo.x - primero.x)),
    alto: Math.min(1 - y, Math.abs(ultimo.y - primero.y)),
  };
}
