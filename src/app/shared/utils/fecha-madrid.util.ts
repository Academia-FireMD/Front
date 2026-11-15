const partesMadrid = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
export function fechaLocalMadrid(iso: string | null | undefined): string {
  if (!iso) return '';
  const partes = Object.fromEntries(
    partesMadrid.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${partes['year']}-${partes['month']}-${partes['day']}T${partes['hour']}:${partes['minute']}`;
}
export function isoDesdeMadrid(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Fecha no válida');
  const deseada = new Date(`${value}:00Z`).getTime();
  let instante = deseada;
  for (let i = 0; i < 3; i++) {
    const local = fechaLocalMadrid(new Date(instante).toISOString());
    if (local === value) return new Date(instante).toISOString();
    instante += deseada - new Date(`${local}:00Z`).getTime();
  }
  throw new Error('Esta hora no existe en Madrid por el cambio horario');
}
export function mostrarFechaMadrid(iso: string | null | undefined): string {
  return iso
    ? new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso))
    : '';
}
