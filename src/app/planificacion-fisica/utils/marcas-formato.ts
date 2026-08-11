/**
 * Utilidades de formato para marcas personales de planificación física.
 *
 * Centraliza el parseo y presentación de valores métricos, especialmente
 * tiempos (`mm:ss` ↔ segundos), para que el componente no repita la lógica.
 */

const UNIDADES_TIEMPO = new Set([
  'seg',
  's',
  'segundo',
  'segundos',
  'min',
  'minuto',
  'minutos',
]);

function normalizarUnidad(unidad: string | null | undefined): string {
  return (unidad ?? '').toLowerCase().trim();
}

/**
 * Devuelve true si la unidad representa un tiempo (segundos o minutos).
 * Las comparaciones son insensibles a mayúsculas y a plural.
 */
export function esUnidadTiempo(unidad: string | null | undefined): boolean {
  return UNIDADES_TIEMPO.has(normalizarUnidad(unidad));
}

/**
 * Convierte una entrada de tiempo `mm:ss` (o segundos en crudo) a número.
 *
 * - `'12:34'` con unidad `'seg'` → `754`
 * - `'754'` con unidad `'seg'` → `754`
 * - Valores que ya son número se devuelven tal cual.
 * - Si la unidad no es de tiempo, se delega a `Number()`.
 * - Formato inválido → `NaN`.
 */
export function parsearValorTiempo(
  valor: string | number,
  unidad?: string | null,
): number {
  if (typeof valor === 'number') {
    return valor;
  }
  const limpio = valor.trim().replace(',', '.');
  if (!esUnidadTiempo(unidad)) {
    const comoNumero = Number(limpio);
    return Number.isFinite(comoNumero) ? comoNumero : NaN;
  }
  if (limpio.includes(':')) {
    const partes = limpio.split(':').map((p) => parseInt(p, 10));
    if (partes.length !== 2 && partes.length !== 3) {
      return NaN;
    }
    if (partes.some((p) => Number.isNaN(p) || p < 0)) {
      return NaN;
    }
    // mm:ss
    if (partes.length === 2) {
      const [min, seg] = partes;
      if (seg > 59) return NaN;
      return min * 60 + seg;
    }
    // hh:mm:ss
    const [h, min, seg] = partes;
    if (min > 59 || seg > 59) return NaN;
    return h * 3600 + min * 60 + seg;
  }
  const comoNumero = Number(limpio);
  return Number.isFinite(comoNumero) ? comoNumero : NaN;
}

function formatearTiempo(valor: number, unidad: string): string {
  const unidadNorm = normalizarUnidad(unidad);
  const esMinutos =
    unidadNorm === 'min' || unidadNorm === 'minuto' || unidadNorm === 'minutos';

  if (esMinutos) {
    const totalMinutos = Math.floor(valor);
    const segundosResto = Math.round((valor - totalMinutos) * 60);
    const hh = Math.floor(totalMinutos / 60);
    const mm = totalMinutos % 60;
    if (hh > 0) {
      return `${hh}:${mm.toString().padStart(2, '0')}`;
    }
    return `${mm}:${segundosResto.toString().padStart(2, '0')}`;
  }

  // segundos
  const totalSegundos = Math.floor(valor);
  const mm = Math.floor(totalSegundos / 60);
  const ss = totalSegundos % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

/**
 * Formatea un valor numérico según su unidad.
 *
 * - Unidades de tiempo enteras → `mm:ss` (o `hh:mm` para minutos ≥ 60).
 * - Tiempos con decimales → `N unidad` para no perder precisión.
 * - Resto de unidades → `N unidad`.
 */
export function formatearValor(
  valor: number,
  unidad: string | null | undefined,
): string {
  if (!Number.isFinite(valor)) {
    return '';
  }
  const unidadNorm = normalizarUnidad(unidad);
  if (!unidadNorm) {
    return String(valor);
  }
  if (esUnidadTiempo(unidad)) {
    if (!Number.isInteger(valor)) {
      return `${valor} ${unidadNorm}`;
    }
    return formatearTiempo(valor, unidadNorm);
  }
  return `${valor} ${unidadNorm}`;
}
