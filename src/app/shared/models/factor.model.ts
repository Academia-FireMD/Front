export enum FactorName {
  PREGUNTAS_MALAS_PIVOT = 'PREGUNTAS_MALAS_PIVOT',
}
export interface Factor {
  name: FactorName;
  value?: number;
}
