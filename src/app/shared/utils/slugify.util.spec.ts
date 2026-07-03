import { slugify } from './slugify.util';

describe('slugify', () => {
  it('minúsculas y espacios → guiones', () => {
    expect(slugify('Curso De Bomberos')).toBe('curso-de-bomberos');
  });

  it('quita acentos y diacríticos', () => {
    expect(slugify('Preparación Física Ágil')).toBe('preparacion-fisica-agil');
    expect(slugify('Año Niño')).toBe('ano-nino');
  });

  it('sustituye símbolos por guiones y colapsa repeticiones', () => {
    expect(slugify('Curso: Nivel 1 / Básico!!')).toBe('curso-nivel-1-basico');
  });

  it('recorta guiones al inicio y al final', () => {
    expect(slugify('  -Curso Extra-  ')).toBe('curso-extra');
  });

  it('string vacío o solo símbolos → cadena vacía', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('!!!')).toBe('');
  });

  it('mayúsculas mixtas con números se preservan como texto', () => {
    expect(slugify('Tema 10: RCP Avanzado')).toBe('tema-10-rcp-avanzado');
  });
});
