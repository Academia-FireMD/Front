import { Oposicion } from '../shared/models/subscription.model';
import { GRUPO_COMUNIDAD_VALENCIANA, oposiciones } from '../utils/consts';

/** Reglas ya compiladas del tema activo, sin recursos externos para el iframe. */
export function reglasTemaEstudio(): string {
  const reglas: string[] = [];
  const recoger = (lista: CSSRuleList) => {
    for (const regla of Array.from(lista)) {
      if (regla instanceof CSSStyleRule) {
        if (
          !/\.p-(button|inputtext|card|tabmenu|accordion)(?:[\s.:#\[>,+~]|$)/.test(
            regla.selectorText,
          )
        )
          continue;
        if (!/url\s*\(|<\/style/i.test(regla.cssText))
          reglas.push(regla.cssText);
      } else if (
        'cssRules' in regla &&
        !(regla instanceof CSSMediaRule) &&
        !(regla instanceof CSSSupportsRule)
      ) {
        recoger((regla as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const hoja of Array.from(document.styleSheets)) {
    try {
      recoger(hoja.cssRules);
    } catch {
      /* Las hojas de otro origen no son necesarias. */
    }
  }
  return reglas.join('\n');
}

export function colorSuperficie(nombre: string, fallback: string): string {
  const valor = getComputedStyle(document.documentElement)
    .getPropertyValue(nombre)
    .trim();
  return /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/-]+\))$/i.test(
    valor,
  )
    ? valor
    : fallback;
}

let imagenes: Promise<Record<'cv' | 'cam', string>> | undefined;
export function imagenesPerfilEstudio(): Promise<Record<'cv' | 'cam', string>> {
  return (imagenes ??= (async () => {
    async function png(ruta: string | null): Promise<string> {
      if (!ruta) return '';
      try {
        const respuesta = await fetch(new URL(ruta, document.baseURI), {
          credentials: 'omit',
          redirect: 'error',
          signal: AbortSignal.timeout(4000),
        });
        if (!respuesta.ok) return '';
        const bytes = new Uint8Array(await respuesta.arrayBuffer());
        if (
          bytes.length > 1024 * 1024 ||
          ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        )
          return '';
        const blob = new Blob([bytes], { type: 'image/png' });
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } catch {
        return '';
      }
    }
    const [cv, cam] = await Promise.all([
      png(GRUPO_COMUNIDAD_VALENCIANA.image),
      png(oposiciones[Oposicion.MADRID].image),
    ]);
    return { cv, cam };
  })());
}
