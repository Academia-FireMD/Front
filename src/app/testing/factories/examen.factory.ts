import { EstadoExamen, Examen, TipoAcceso } from '../../examen/models/examen.model';

/** Creates a minimal mock Examen (simulacro-style). */
export function createMockExamen(overrides: Partial<Examen> = {}): Examen {
  return {
    id: 5,
    titulo: 'Simulacro Bomberos 2024 - Convocatoria Estatal',
    descripcion: 'Simulacro oficial para la preparación de las pruebas de bomberos.',
    duracion: 90,
    estado: EstadoExamen.PUBLICADO,
    tipoAcceso: TipoAcceso.SIMULACRO,
    relevancia: [],
    creadorId: 99,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Creates a mock Examen in BORRADOR state (useful for admin tests). */
export function createMockExamenBorrador(overrides: Partial<Examen> = {}): Examen {
  return createMockExamen({
    id: 1,
    titulo: 'Borrador de examen',
    estado: EstadoExamen.BORRADOR,
    tipoAcceso: TipoAcceso.RESTRINGIDO,
    ...overrides,
  });
}
