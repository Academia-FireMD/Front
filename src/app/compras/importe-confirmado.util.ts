/** Normaliza a céntimos el importe mostrado y aceptado antes de enviarlo. */
export function importeConfirmadoEnCentimos(
  importe: number | null | undefined,
): number | null {
  if (typeof importe !== 'number' || !Number.isFinite(importe)) return null;
  const normalizado = Math.round((importe + Number.EPSILON) * 100) / 100;
  return normalizado > 0 ? normalizado : null;
}
