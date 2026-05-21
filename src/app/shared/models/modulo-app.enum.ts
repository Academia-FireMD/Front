/**
 * Espejo TS del enum Prisma `ModuloApp` (Server `feature/white-label-config`).
 * Único source-of-truth en el frontend (D6, §4.1, §6.3).
 *
 * 9 valores totales. Cualquier ampliación requiere:
 *  - migración Prisma `ALTER TYPE ... ADD VALUE`
 *  - decorar al menos un controller con `@RequiereModulo`
 *  - wirearlo en al menos un MenuItem o `data.modulo` de ruta
 *  - los tests de contract-drift fallan en CI si se rompe alguna de las tres.
 */
export enum ModuloApp {
  PLANIFICACION = 'PLANIFICACION',
  SIMULACROS = 'SIMULACROS',
  HORARIOS = 'HORARIOS',
  DOCUMENTACION = 'DOCUMENTACION',
  CURSOS = 'CURSOS',
  EXAMEN = 'EXAMEN',
  TEST = 'TEST',
  FLASHCARDS = 'FLASHCARDS',
  FACTURACION = 'FACTURACION',
}
