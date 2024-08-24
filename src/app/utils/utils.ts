import { Dificultad } from '../shared/models/pregunta.model';

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

export const getAllTemas = () => {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((entry) => {
    return {
      label: 'Tema ' + entry,
      code: entry,
    };
  });
};

export const getNumeroDePreguntas = () => {
  return [20, 40, 60, 80, 100].map((entry) => {
    return {
      label: entry + ' preguntas',
      code: entry,
    };
  });
};

export const getLetter = (index: number) => {
  return String.fromCharCode(97 + index);
};

export const getAllDifficultades = () => {
  return Object.keys(Dificultad).map((entry) => {
    const map = {
      [Dificultad.BASICO]: {
        label: 'Basico',
        stars: getStarsBasedOnDifficulty(Dificultad.BASICO),
        value: Dificultad.BASICO,
      },
      [Dificultad.INTERMEDIO]: {
        label: 'Intermedio',
        stars: getStarsBasedOnDifficulty(Dificultad.INTERMEDIO),
        value: Dificultad.INTERMEDIO,
      },
      [Dificultad.DIFICIL]: {
        label: 'Dificil',
        stars: getStarsBasedOnDifficulty(Dificultad.DIFICIL),
        value: Dificultad.DIFICIL,
      },
    } as any;
    return map[entry];
  });
};
