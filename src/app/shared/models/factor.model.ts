export enum FactorName {
  PREGUNTAS_MALAS_PIVOT = 'PREGUNTAS_MALAS_PIVOT',
  FLASHCARDS_MAL_PRIVOT = 'FLASHCARDS_MAL_PRIVOT',
  FLASHCARDS_REPASAR_PIVOT = 'FLASHCARDS_REPASAR_PIVOT',
}
export interface Factor {
  name: FactorName;
  value?: number;
}
