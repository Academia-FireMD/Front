import { getVentanaDosSemanasAtras } from './utils';

describe('getVentanaDosSemanasAtras (Tarea 4: ventana de 2 semanas)', () => {
  it('devuelve la fecha 14 días atrás a medianoche', () => {
    const hoy = new Date(2026, 7, 18, 14, 30, 0); // 18 ago 2026 14:30
    const resultado = getVentanaDosSemanasAtras(hoy);

    expect(resultado.getFullYear()).toBe(2026);
    expect(resultado.getMonth()).toBe(7);
    expect(resultado.getDate()).toBe(4); // 18 - 14 = 4
    expect(resultado.getHours()).toBe(0);
    expect(resultado.getMinutes()).toBe(0);
    expect(resultado.getSeconds()).toBe(0);
  });

  it('es una capa de presentación: no altera el Date recibido', () => {
    const hoy = new Date(2026, 0, 1, 10, 0, 0);
    getVentanaDosSemanasAtras(hoy);
    expect(hoy.getDate()).toBe(1); // el original no se muta
  });

  it('por defecto usa la fecha actual', () => {
    const resultado = getVentanaDosSemanasAtras();
    const esperado = new Date();
    esperado.setDate(esperado.getDate() - 14);
    esperado.setHours(0, 0, 0, 0);
    expect(resultado.getTime()).toBe(esperado.getTime());
  });
});
