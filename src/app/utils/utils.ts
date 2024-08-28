import { Dificultad, Tema } from '../shared/models/pregunta.model';

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
