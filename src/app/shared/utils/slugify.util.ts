/**
 * Slugify básico usado como PREVIEW cosmético en el editor de cursos
 * (curso-admin-edit): el backend es la fuente autoritativa del slug real —
 * lo genera server-side a partir de `titulo` y resuelve colisiones con
 * sufijos `-2`, `-3`, etc. Esta función NO replica esa disambiguación, solo
 * la normalización básica para que el admin vea "más o menos" lo que va a
 * quedar mientras escribe el título.
 *
 * minúsculas → sin acentos (NFD + strip de diacríticos) → cualquier
 * secuencia no [a-z0-9] se convierte en un único `-` → recorta guiones al
 * inicio/fin. String vacío o solo símbolos → `''`.
 */
export function slugify(input: string): string {
  if (!input) {
    return '';
  }

  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos (acentos, tildes, ñ->n~)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
