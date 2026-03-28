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
  if (/\.[a-z0-9]{2,8}$/i.test(id)) {
    return id;
  }
  const m = fn.match(/(\.[a-z0-9]{2,8})$/i);
  const ext = m ? m[1] : '.pdf';
  return `${id}${ext}`;
}
