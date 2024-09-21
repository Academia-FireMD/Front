import { Comunidad, Dificultad } from './pregunta.model';
import { TestStatus } from './test.model';

export interface FlashcardTest {
  id: number;
  usuarioId: number; // Relación con Usuario
  status: TestStatus; // CREADO, EMPEZADO, FINALIZADO
  flashcards: FlashcardTestItem[]; // Relación con las flashcards del test
  createdAt: Date;
  updatedAt: Date;
  esDeRepaso?: boolean;
}

export interface FlashcardTestItem {
  id: number;
  flashcardId: number; // Relación con FlashcardData
  testId: number; // Relación con FlashcardTest
  respuesta: FlashcardRespuesta[]; // Relación con FlashcardRespuesta
  flashcard: FlashcardData;
  createdAt: Date;
  mostrarSolucion?: boolean;
}

export interface FlashcardRespuesta {
  id: number;
  flashcardId: number; // Relación con FlashcardData
  testItemId: number; // Relación con FlashcardTestItem
  estado: EstadoFlashcard; // BIEN, MAL, REVISAR
  createdAt: Date;
}

export interface FlashcardData {
  id: number;
  identificador: string;
  relevancia: Comunidad[]; // Array de enum Comunidad
  dificultad: Dificultad; // Enum DificultadFlashcards
  temaId: number; // Relación con Tema
  descripcion: string;
  solucion: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum EstadoFlashcard {
  BIEN = 'BIEN',
  MAL = 'MAL',
  REVISAR = 'REVISAR',
}
