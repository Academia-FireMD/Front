import { CursoDetail, Leccion, ProgresoLeccion } from '../models/curso.model';

/** Curso con solo lo necesario para los cálculos de progreso. */
type ConSecciones = Pick<CursoDetail, 'secciones'>;

/**
 * Lecciones del curso aplanadas en orden de currículum: por orden de sección
 * y, dentro de cada sección, por orden de lección. Es el orden canónico que
 * usan el sidebar, la navegación anterior/siguiente y "continuar".
 */
export function leccionesPlanas(curso: ConSecciones): Leccion[] {
  return [...(curso.secciones ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .flatMap((s) => [...(s.lecciones ?? [])].sort((a, b) => a.orden - b.orden));
}

/** true si existe un ProgresoLeccion completado para esa lección. */
export function estaCompletada(
  leccionId: number,
  prog: ProgresoLeccion[] = [],
): boolean {
  return prog.some((p) => p.leccionId === leccionId && p.completada);
}

/** % del curso = lecciones completadas / total, redondeado. 0 si no hay lecciones. */
export function calcularPorcentajeCurso(
  curso: ConSecciones,
  prog: ProgresoLeccion[] = [],
): number {
  const lecciones = leccionesPlanas(curso);
  if (!lecciones.length) return 0;
  const completadas = lecciones.filter((l) =>
    estaCompletada(l.id, prog),
  ).length;
  return Math.round((completadas / lecciones.length) * 100);
}

/**
 * Lección para "continuar donde lo dejaste":
 *  1. La lección INCOMPLETA con `ultimaVez` más reciente (retoma lo último visto).
 *  2. Si ninguna incompleta tiene actividad → la primera incompleta en orden.
 *  3. Si todas están completas → la última lección del curso.
 *  4. Si el curso no tiene lecciones → null.
 */
export function leccionContinuar(
  curso: ConSecciones,
  prog: ProgresoLeccion[] = [],
): Leccion | null {
  const lecciones = leccionesPlanas(curso);
  if (!lecciones.length) return null;
  const incompletas = lecciones.filter((l) => !estaCompletada(l.id, prog));
  if (!incompletas.length) return lecciones[lecciones.length - 1];
  const conActividad = incompletas
    .map((l) => ({ l, p: prog.find((p) => p.leccionId === l.id) }))
    .filter((x) => x.p?.updatedAt)
    .sort((a, b) => +new Date(b.p!.updatedAt!) - +new Date(a.p!.updatedAt!));
  return conActividad[0]?.l ?? incompletas[0];
}
