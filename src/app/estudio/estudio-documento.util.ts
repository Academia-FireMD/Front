export function sustituir(
  html: string,
  original: string,
  integrado: string,
): string {
  if (!html.includes(original))
    throw new Error('El visor no coincide con la versión integrada');
  return html.replace(original, () => integrado);
}
