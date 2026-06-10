import {
  calcularPorcentajeCurso,
  estaCompletada,
  leccionContinuar,
  leccionesPlanas,
} from './progreso.util';
import { CursoDetail, ProgresoLeccion } from '../models/curso.model';

const curso = {
  secciones: [
    {
      id: 2,
      orden: 1,
      titulo: 'B',
      cursoId: 1,
      lecciones: [{ id: 12, orden: 0, titulo: 'L3' }],
    },
    {
      id: 1,
      orden: 0,
      titulo: 'A',
      cursoId: 1,
      lecciones: [
        { id: 11, orden: 1, titulo: 'L2' },
        { id: 10, orden: 0, titulo: 'L1' },
      ],
    },
  ],
} as unknown as CursoDetail;

describe('progreso.util', () => {
  it('leccionesPlanas respeta orden de sección y de lección', () => {
    expect(leccionesPlanas(curso).map((l) => l.id)).toEqual([10, 11, 12]);
  });

  it('estaCompletada true solo si hay progreso completado para esa lección', () => {
    const prog = [{ leccionId: 10, completada: true }] as ProgresoLeccion[];
    expect(estaCompletada(10, prog)).toBe(true);
    expect(estaCompletada(11, prog)).toBe(false);
    expect(estaCompletada(10, [])).toBe(false);
  });

  it('calcularPorcentajeCurso = completadas/total redondeado', () => {
    const prog = [
      { leccionId: 10, completada: true },
      { leccionId: 12, completada: true },
    ] as ProgresoLeccion[];
    expect(calcularPorcentajeCurso(curso, prog)).toBe(67); // 2/3
  });

  it('calcularPorcentajeCurso = 0 sin lecciones', () => {
    expect(
      calcularPorcentajeCurso({ secciones: [] } as unknown as CursoDetail),
    ).toBe(0);
  });

  it('leccionContinuar = incompleta con updatedAt más reciente', () => {
    const prog = [
      { leccionId: 10, completada: true, updatedAt: '2026-06-01T00:00:00Z' },
      { leccionId: 11, completada: false, updatedAt: '2026-06-05T00:00:00Z' },
    ] as ProgresoLeccion[];
    expect(leccionContinuar(curso, prog)?.id).toBe(11);
  });

  it('leccionContinuar sin progreso = primera lección en orden', () => {
    expect(leccionContinuar(curso, [])?.id).toBe(10);
  });

  it('leccionContinuar con todo completado = última lección', () => {
    const prog = [
      { leccionId: 10, completada: true },
      { leccionId: 11, completada: true },
      { leccionId: 12, completada: true },
    ] as ProgresoLeccion[];
    expect(leccionContinuar(curso, prog)?.id).toBe(12);
  });

  it('leccionContinuar incompletas sin actividad = primera incompleta', () => {
    const prog = [{ leccionId: 10, completada: true }] as ProgresoLeccion[];
    expect(leccionContinuar(curso, prog)?.id).toBe(11);
  });
});
