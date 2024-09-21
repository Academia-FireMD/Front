import { FlashcardTest } from '../shared/models/flashcard.model';
import {
  Dificultad,
  SeguridadAlResponder,
  Tema,
} from '../shared/models/pregunta.model';
import { Test } from '../shared/models/test.model';

export const colorCorrectas = '#00eb003d';
export const colorIncorretas = '#ff9c9c';
export const colorSinResponder = '#c5c5c5';

export interface StatType {
  correctas: number;
  incorrectas: number;
}

export const obtenerTipoDeTest = (
  testItem: Test | FlashcardTest,
  type: 'TESTS' | 'FLASHCARDS'
): 'Practica' | 'Examen' | 'Repaso' => {
  if (type == 'TESTS') {
    testItem = testItem as Test;
    const isRepaso = !!testItem.esDeRepaso;
    if (isRepaso) return 'Repaso';
    const isExamen = !!testItem.duration;
    if (isExamen) return 'Examen';
    return 'Practica';
  } else {
    testItem = testItem as FlashcardTest;
    const isRepaso = !!testItem.esDeRepaso;
    if (isRepaso) return 'Repaso';
    return 'Practica';
  }
};

export const getStats = (statsRaw: any) => {
  const stats100 = statsRaw.seguridad[SeguridadAlResponder.CIEN_POR_CIENTO];
  const stats75 =
    statsRaw.seguridad[SeguridadAlResponder.SETENTA_Y_CINCO_POR_CIENTO];
  const stats50 = statsRaw.seguridad[SeguridadAlResponder.CINCUENTA_POR_CIENTO];
  return { stats100, stats75, stats50 };
};

export const calcular100y50 = (
  stats100: StatType,
  stats50: StatType,
  total: number
) => {
  return calcularCalificacion(
    stats100.correctas + stats50.correctas,
    stats100.incorrectas + stats50.incorrectas,
    total
  );
};

export const calcular100y75y50 = (
  stats100: StatType,
  stats75: StatType,
  stats50: StatType,
  total: number,
  identifier?: string
) => {
  return calcularCalificacion(
    stats100.correctas + stats75.correctas + stats50.correctas,
    stats100.incorrectas + stats75.incorrectas + stats50.incorrectas,
    total,
    identifier
  );
};

export const calcularCalificacion = (
  A: number,
  E: number,
  N: number,
  identificador?: string
): number => {
  if (identificador) console.table([identificador, A, E, N]);
  if (A == 0 && E == 0 && N == 0) return 0;
  const Q = ((A - E / 3) * 10) / N;
  return Q;
};

export const getStarsBasedOnDifficulty = (difficulty: Dificultad) => {
  switch (difficulty) {
    case Dificultad.BASICO:
      return ['star-fill', 'star', 'star'];

    case Dificultad.INTERMEDIO:
      return ['star-fill', 'star-fill', 'star'];

    case Dificultad.DIFICIL:
      return ['star-fill', 'star-fill', 'star-fill'];

    default:
      return ['star-fill', 'star', 'star'];
  }
};

export const getNumeroDePreguntas = () => {
  return [20, 40, 60, 80, 100].map((entry) => {
    return {
      label: entry + ' preguntas',
      code: entry,
    };
  });
};

export const toPascalCase = (str: string): string => {
  return str.replace(/(^\w|[\s_-]\w)/g, (match) =>
    match.replace(/[\s_-]/, '').toUpperCase()
  );
};

export const getLetter = (index: number) => {
  return String.fromCharCode(97 + index);
};

export const groupedTemas = (temas: Array<Tema>) => {
  return Object.entries(
    temas.reduce((acc, tema) => {
      const categoria = tema.categoria;
      if (!acc[categoria as any]) {
        acc[categoria as any] = [];
      }
      acc[categoria as any].push({
        label: tema.numero + ' - ' + tema.descripcion ?? '',
        value: tema.id,
      });
      return acc;
    }, {} as { [key: string]: { label: string; value: number }[] })
  ).map(([categoria, items]) => ({
    label: categoria,
    value: categoria.toLowerCase(), // Puedes ajustar el valor según tus necesidades
    items,
  }));
};

export const getAllDifficultades = (isFlashcards = false) => {
  return Object.keys(Dificultad).map((entry) => {
    const map = {
      [Dificultad.BASICO]: {
        label: isFlashcards ? 'Datos Básicos' : 'Basico',
        stars: getStarsBasedOnDifficulty(Dificultad.BASICO),
        value: Dificultad.BASICO,
      },
      [Dificultad.INTERMEDIO]: {
        label: isFlashcards ? 'Datos' : 'Intermedio',
        stars: getStarsBasedOnDifficulty(Dificultad.INTERMEDIO),
        value: Dificultad.INTERMEDIO,
      },
      [Dificultad.DIFICIL]: {
        label: isFlashcards ? 'Tarjetas' : 'Dificil',
        stars: getStarsBasedOnDifficulty(Dificultad.DIFICIL),
        value: Dificultad.DIFICIL,
      },
    } as any;
    return map[entry];
  });
};
