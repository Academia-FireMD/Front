import { Dificultad } from '../shared/models/pregunta.model';

export const getStarsBasedOnDifficulty = (difficulty: Dificultad) => {
  console.log(difficulty)
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
