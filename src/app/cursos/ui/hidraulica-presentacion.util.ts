import { HidraulicaPresentacion } from '../services/hidraulica-interactivo.service';

/** Fuente nativa de plataforma (sin cargar webfonts en el embed). */
export const FUENTE_PLATAFORMA =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const COLOR_SEGURO =
  /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/-]+\))$/i;

function leerColor(nombre: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  try {
    const valor = getComputedStyle(document.documentElement)
      .getPropertyValue(nombre)
      .trim();
    return COLOR_SEGURO.test(valor) ? valor : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Tokens de presentación que el padre envía en el `init` del bridge (v1
 * backwards compatible). Solo valores seguros: colores hex/rgb/hsl y una pila
 * de fuentes del sistema; el HTML vuelve a validarlos antes de aplicar CSS.
 */
export function presentacionHidraulicaIntegrada(): HidraulicaPresentacion {
  return {
    modo: 'INTEGRADA',
    tema: {
      primario: leerColor('--primary-color', '#bb292a'),
      texto: leerColor('--text-color', '#1f2429'),
      textoSecundario: leerColor('--text-color-secondary', '#6b7280'),
      borde: leerColor('--surface-border', '#d9dde2'),
      fuente: FUENTE_PLATAFORMA,
    },
  };
}
