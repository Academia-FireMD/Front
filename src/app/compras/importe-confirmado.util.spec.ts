import { importeConfirmadoEnCentimos } from './importe-confirmado.util';

describe('importeConfirmadoEnCentimos', () => {
  it('normaliza al mismo importe en céntimos que ve el alumno', () => {
    expect(importeConfirmadoEnCentimos(9.9)).toBe(9.9);
    expect(importeConfirmadoEnCentimos(12.5)).toBe(12.5);
    expect(importeConfirmadoEnCentimos(19.999)).toBe(20);
  });

  it.each([null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza un importe no cobrable: %s',
    (importe) => {
      expect(importeConfirmadoEnCentimos(importe)).toBeNull();
    },
  );
});
