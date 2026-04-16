// Validación ligera de formato NIF español en el Frontend.
// El backend hace la validación con checksum completa; aquí solo usamos
// regex para dar feedback inmediato al usuario mientras rellena el form.
// Un NIF que pase este regex todavía puede ser rechazado por el backend
// si la letra de control no coincide — el toast mostrará el error.

const NIF_REGEX =
  /^(?:[0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z]|[ABCDEFGHJKLMNPQRSUVWabcdefghjklmnpqrsuvw][0-9]{7}[0-9A-Ja-j])$/;

export function looksLikeSpanishNif(nif: string | null | undefined): boolean {
  if (!nif) return false;
  return NIF_REGEX.test(nif.trim());
}
