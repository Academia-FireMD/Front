import {
  esUnidadTiempo,
  formatearValor,
  parsearValorTiempo,
} from './marcas-formato';

describe('marcas-formato', () => {
  describe('parsearValorTiempo', () => {
    it('convierte mm:ss a segundos cuando la unidad es seg', () => {
      expect(parsearValorTiempo('12:34', 'seg')).toBe(754);
    });

    it('acepta segundos en crudo', () => {
      expect(parsearValorTiempo('754', 'seg')).toBe(754);
      expect(parsearValorTiempo(754, 'seg')).toBe(754);
    });

    it('acepta decimales en crudo', () => {
      expect(parsearValorTiempo('12.5', 'seg')).toBe(12.5);
    });

    it('parsea hh:mm:ss para unidades de tiempo', () => {
      expect(parsearValorTiempo('1:05:17', 'seg')).toBe(3917);
    });

    it('devuelve NaN para formatos inválidos de tiempo', () => {
      expect(parsearValorTiempo('12:60', 'seg')).toBeNaN();
      expect(parsearValorTiempo('abc', 'seg')).toBeNaN();
      expect(parsearValorTiempo('1:2:3:4', 'seg')).toBeNaN();
    });

    it('delega a Number para unidades que no son tiempo', () => {
      expect(parsearValorTiempo('42', 'm')).toBe(42);
      expect(parsearValorTiempo('7.5', 'reps')).toBe(7.5);
    });
  });

  describe('formatearValor', () => {
    it('formatea segundos enteros como mm:ss', () => {
      expect(formatearValor(754, 'seg')).toBe('12:34');
    });

    it('formatea tiempos cortos como 0:ss', () => {
      expect(formatearValor(45, 'seg')).toBe('0:45');
    });

    it('mantiene decimales en tiempos para no perder precisión', () => {
      expect(formatearValor(12.5, 'seg')).toBe('12.5 seg');
    });

    it('formatea minutos enteros mayores de 60 como hh:mm', () => {
      expect(formatearValor(90, 'min')).toBe('1:30');
    });

    it('formatea minutos cortos como mm:ss', () => {
      expect(formatearValor(5, 'min')).toBe('5:00');
    });

    it('formatea unidades no tiempo como valor + unidad', () => {
      expect(formatearValor(42, 'm')).toBe('42 m');
      expect(formatearValor(15, 'reps')).toBe('15 reps');
    });

    it('devuelve el número sin unidad cuando no hay unidad', () => {
      expect(formatearValor(10, null)).toBe('10');
    });

    it('devuelve cadena vacía para valores no finitos', () => {
      expect(formatearValor(NaN, 'seg')).toBe('');
      expect(formatearValor(Infinity, 'm')).toBe('');
    });
  });

  describe('esUnidadTiempo', () => {
    it('detecta segundos y minutos sin importar mayúsculas ni plural', () => {
      expect(esUnidadTiempo('seg')).toBe(true);
      expect(esUnidadTiempo('SEG')).toBe(true);
      expect(esUnidadTiempo('min')).toBe(true);
      expect(esUnidadTiempo('Minutos')).toBe(true);
      expect(esUnidadTiempo('s')).toBe(true);
    });

    it('devuelve false para unidades que no son tiempo', () => {
      expect(esUnidadTiempo('m')).toBe(false);
      expect(esUnidadTiempo('reps')).toBe(false);
      expect(esUnidadTiempo(null)).toBe(false);
    });
  });
});
