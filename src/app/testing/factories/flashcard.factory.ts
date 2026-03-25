import {
  EstadoFlashcard,
  FlashcardData,
  FlashcardTest,
  FlashcardTestItem,
} from '../../shared/models/flashcard.model';
import { Dificultad } from '../../shared/models/pregunta.model';
import { TestStatus } from '../../shared/models/test.model';

/** Creates a minimal mock FlashcardData card. */
export function createMockFlashcardData(overrides: Partial<FlashcardData> = {}): FlashcardData {
  return {
    id: 201,
    identificador: 'FC-001',
    descripcion: '¿Cuáles son los tres tipos de músculo en el cuerpo humano?',
    solucion: 'Músculo esquelético, músculo liso y músculo cardíaco.',
    dificultad: Dificultad.BASICO,
    temaId: 1,
    relevancia: [],
    tema: { id: 1, numero: 1, descripcion: 'Anatomía General' },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ReporteFallo: [],
    ...overrides,
  };
}

/** Creates a mock FlashcardTestItem (a card within a test session). */
export function createMockFlashcardTestItem(overrides: Partial<FlashcardTestItem> = {}): FlashcardTestItem {
  const flashcard = overrides.flashcard ?? createMockFlashcardData();
  return {
    id: 101,
    flashcardId: flashcard.id,
    testId: 1,
    respuesta: [],
    mostrarSolucion: false,
    flashcard,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Creates a mock FlashcardTest with N unanswered cards.
 * Each card has an empty `respuesta` array (= not answered yet).
 */
export function createMockFlashcardTest(
  numCards = 3,
  overrides: Partial<FlashcardTest> = {}
): FlashcardTest {
  const flashcards: FlashcardTestItem[] = Array.from({ length: numCards }, (_, i) =>
    createMockFlashcardTestItem({
      id: 100 + i + 1,
      flashcardId: 200 + i + 1,
      flashcard: createMockFlashcardData({
        id: 200 + i + 1,
        identificador: `FC-00${i + 1}`,
        descripcion: `Pregunta de flashcard ${i + 1}`,
        solucion: `Solución ${i + 1}`,
      }),
    })
  );

  return {
    id: 1,
    usuarioId: 1,
    status: TestStatus.EMPEZADO,
    flashcards,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    esDeRepaso: false,
    ...overrides,
  };
}

/** Creates a FlashcardTest where the first N cards are already answered. */
export function createMockFlashcardTestPartiallyAnswered(
  totalCards = 3,
  answeredCount = 1
): FlashcardTest {
  return createMockFlashcardTest(totalCards, {
    flashcards: Array.from({ length: totalCards }, (_, i) =>
      createMockFlashcardTestItem({
        id: 100 + i + 1,
        flashcardId: 200 + i + 1,
        flashcard: createMockFlashcardData({ id: 200 + i + 1 }),
        respuesta:
          i < answeredCount
            ? [
                {
                  id: 1000 + i,
                  flashcardId: 200 + i + 1,
                  testItemId: 100 + i + 1,
                  estado: EstadoFlashcard.BIEN,
                  createdAt: new Date('2024-01-15T10:00:00Z'),
                },
              ]
            : [],
      })
    ),
  });
}
