import {
  fechaLocalMadrid,
  isoDesdeMadrid,
  mostrarFechaMadrid,
} from './fecha-madrid.util';
describe('Fechas de gestión en Madrid', () => {
  it('usa CET en invierno y CEST en verano independientemente de la zona del navegador', () => {
    expect(fechaLocalMadrid('2026-11-15T12:31:47.123Z')).toBe(
      '2026-11-15T13:31',
    );
    expect(isoDesdeMadrid('2026-11-15T13:31')).toBe('2026-11-15T12:31:00.000Z');
    expect(fechaLocalMadrid('2026-07-15T12:31:00.000Z')).toBe(
      '2026-07-15T14:31',
    );
    expect(isoDesdeMadrid('2026-07-15T14:31')).toBe('2026-07-15T12:31:00.000Z');
  });
  it('vacío representa duración indefinida', () => {
    expect(isoDesdeMadrid('')).toBeNull();
    expect(fechaLocalMadrid(null)).toBe('');
  });
  it('rechaza una hora inexistente durante el cambio de verano', () => {
    expect(() => isoDesdeMadrid('2026-03-29T02:30')).toThrow();
  });
  it('presenta el instante en Madrid', () => {
    expect(mostrarFechaMadrid('2026-11-15T12:31:00Z')).toContain('13:31');
  });
});
