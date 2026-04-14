/** Misma lógica que en Server: identificador + extensión de fileName (evita mojibake en fileName). */
export function buildDocumentDownloadFileName(
  identificador: string,
  fileName: string | null | undefined,
): string {
  const id = identificador?.trim();
  const fn = fileName?.trim() || '';
  if (!id) {
    return fn || 'documento.pdf';
  }
  // Solo tratamos como extensión real si contiene al menos una letra.
  // Esto evita falsos positivos con códigos tipo "I01.001" o versiones "v2.3".
  const idExtMatch = id.match(/\.([a-z0-9]{2,8})$/i);
  if (idExtMatch && /[a-z]/i.test(idExtMatch[1])) {
    return id;
  }
  const m = fn.match(/(\.[a-z0-9]{2,8})$/i);
  const ext = m && /[a-z]/i.test(m[1]) ? m[1] : '.pdf';
  return `${id}${ext}`;
}
