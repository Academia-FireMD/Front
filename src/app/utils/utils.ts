import { CalendarEvent } from 'angular-calendar';
import { EstadoExamen, TipoAcceso } from '../examen/models/examen.model';
import {
  EstadoFlashcard,
  FlashcardTest,
} from '../shared/models/flashcard.model';
import {
  Dificultad,
  SeguridadAlResponder,
  Tema,
} from '../shared/models/pregunta.model';
import { Test } from '../shared/models/test.model';
import { forOwn, isObjectLike } from 'lodash';

export const colorCorrectas = '#00eb003d';
export const colorIncorretas = '#ff9c9c';
export const colorSinResponder = '#c5c5c5';

export const colorFlashcardsCorrectas = '#00eb003d';
export const colorFlashcardsIncorretas = '#ff9c9c';
export const colorFlashcardsRevisar = '#FFD54F';

export const getColorClass = (posicion: number): string => {
  if (posicion === 1) return 'first-place';
  if (posicion === 2) return 'second-place';
  if (posicion === 3) return 'third-place';
  return '';
};

export const getNotaClass = (nota: number | null): string => {
  if (nota === null) return 'nota-na';
  if (nota >= 9) return 'nota-excelente';
  if (nota >= 7) return 'nota-notable';
  if (nota >= 5) return 'nota-aprobado';
  return 'nota-suspenso';
};

export const getAllInArrays = (obj: any) => {
  const result: any[] = [];

  function traverse(o: any) {
    forOwn(o, (val, key) => {
      if (key === 'in' && Array.isArray(val)) {
        result.push(val);
      } else if (isObjectLike(val)) {
        traverse(val);
      }
    });
  }

  traverse(obj);
  return result;
};

export const duracionOptions = [
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '3 horas', value: 180 },
  { label: '4 horas', value: 240 },
  { label: '5 horas', value: 300 },
  { label: '6 horas', value: 360 },
];

export const estadoExamenOptions = [
  { label: 'Borrador', value: EstadoExamen.BORRADOR },
  { label: 'Publicado', value: EstadoExamen.PUBLICADO },
  { label: 'Archivado', value: EstadoExamen.ARCHIVADO },
];

export const tipoAccesoOptions = [
  { label: 'Público', value: TipoAcceso.PUBLICO },
  { label: 'Simulacro', value: TipoAcceso.SIMULACRO },
];

export const universalEditorConfig = {
  height: '300px',
  initialEditType: 'markdown',
  previewStyle: 'vertical',
  autofocus: false,
};

export interface StatType {
  correctas: number;
  incorrectas: number;
}

export const getStartOfWeek = (date: Date): Date => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Ajustar al lunes de la semana
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0); // Eliminar información de tiempo
  return startOfWeek;
};

export const getDateForDayOfWeek = (
  dayIndex: number,
  startOfWeek: Date
): Date => {
  const targetDate = new Date(startOfWeek);
  targetDate.setDate(startOfWeek.getDate() + dayIndex);
  return targetDate;
};

export const getDataFromFlashcards = (data: any) => {
  const dataParsed = data as {
    estado: any;
  };
  const bien = dataParsed.estado[EstadoFlashcard.BIEN].count;
  const revisar = dataParsed.estado[EstadoFlashcard.REVISAR].count;
  const mal = dataParsed.estado[EstadoFlashcard.MAL].count;
  const totalRespuestas = bien + revisar + mal;

  const bienPorcentaje =
    totalRespuestas > 0 ? ((bien / totalRespuestas) * 100).toFixed(2) : '0';
  const revisarPorcentaje =
    totalRespuestas > 0 ? ((revisar / totalRespuestas) * 100).toFixed(2) : '0';
  const malPorcentaje =
    totalRespuestas > 0 ? ((mal / totalRespuestas) * 100).toFixed(2) : '0';

  return {
    labels: ['Bien', 'Repasar', 'Mal'],
    datasets: [
      {
        data: [bien, revisar, mal],
        backgroundColor: [
          colorFlashcardsCorrectas,
          colorFlashcardsRevisar,
          colorFlashcardsIncorretas,
        ],
      },
    ],
    percentages: [bienPorcentaje, revisarPorcentaje, malPorcentaje],
  };
};

export const obtainSecurityEmojiBasedOnEnum = (
  data: SeguridadAlResponder | undefined
) => {
  switch (data) {
    case SeguridadAlResponder.CIEN_POR_CIENTO:
      return '⭐';
    case SeguridadAlResponder.CINCUENTA_POR_CIENTO:
      return '👎';
    case SeguridadAlResponder.CERO_POR_CIENTO:
      return '🛑';
    default:
      return '👍';
  }
};

export const obtenerTemas = (
  testItem: (Test & any) | FlashcardTest,
  type: 'TESTS' | 'FLASHCARDS',
  simplified = false
) => {
  if (type == 'TESTS') {
    const preguntasTest = (testItem.testPreguntas ?? []) as Array<any>;
    const temas = preguntasTest.reduce((prev, next) => {
      const tema = next.pregunta.tema;
      if (!prev.has(tema.numero)) {
        prev.set(tema.numero, {
          numero: tema.numero,
          nombre: tema.categoria,
        });
      }
      return prev;
    }, new Map());
    const listaUnicaTemas = Array.from(temas.values());
    return listaUnicaTemas.length > 3
      ? 'Temas variados'
      : listaUnicaTemas
          .map(
            (tema: any) =>
              `Tema ${tema.numero} ${simplified ? '' : '- ' + tema.nombre} `
          )
          .join(', ');
  } else {
    const preguntasTest = (testItem.flashcards ?? []) as Array<any>;
    const temas = preguntasTest.reduce((prev, next) => {
      const tema = next.flashcard.tema;
      if (!prev.has(tema.numero)) {
        prev.set(tema.numero, {
          numero: tema.numero,
          nombre: tema.categoria,
        });
      }
      return prev;
    }, new Map());
    const listaUnicaTemas = Array.from(temas.values());
    return listaUnicaTemas.length > 3
      ? 'Temas variados'
      : listaUnicaTemas
          .map(
            (tema: any) =>
              `Tema ${tema.numero} ${
                simplified
                  ? ''
                  : !!tema?.modulo?.nombre
                  ? '- ' + tema?.modulo?.nombre
                  : ''
              } `
          )
          .join(', ');
  }
};

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



/**
 * Calcula la calificación usando la fórmula A1, E1/3, B0
 * Q = ((A - E/3) * 10) / N
 * Donde:
 * - A = Aciertos (suman 1 punto cada uno)
 * - E = Errores (restan 1/3 punto cada uno)
 * - N = Total de preguntas
 * - B = Preguntas en blanco (implícitas, no se consideran)
 */
export const calcularCalificacionA1E1_3B0 = (
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

/**
 * Calcula la calificación usando la fórmula A1, E1/4, B0
 * Q = (A - (E/P) + B*PB) * 10 / N
 * Donde:
 * - A = Aciertos (suman 1 punto cada uno)
 * - E = Errores (restan 1/4 punto cada uno, por lo que P = 4)
 * - B = Preguntas en blanco (se calculan automáticamente: B = N - A - E)
 * - N = Total de preguntas
 * - La calificación se redondea hasta la segunda cifra decimal
 */
export const calcularCalificacionA1E1_4B0 = (
  A: number,
  E: number,
  N: number,
  identificador?: string
): number => {
  if (identificador) console.table([identificador, A, E, N]);
  if (A == 0 && E == 0 && N == 0) return 0;
  
  const P = 4; // Penalización por fallo (1/4)
  const PB = 0; // Penalización por preguntas en blanco
  const B = N - A - E; // Preguntas en blanco calculadas automáticamente
  
  const Q = ((A - (E / P) + B * PB) * 10) / N;
  
  // Redondear hasta la segunda cifra decimal como especifica la fórmula
  return Math.round(Q * 100) / 100;
};

/**
 * Calcula la calificación usando el método básico (aciertos/total * 10)
 * Q = (A * 10) / N
 * Donde:
 * - A = Aciertos
 * - N = Total de preguntas
 * - No se penalizan errores ni preguntas en blanco
 */
export const calcularCalificacionBasico = (
  A: number,
  E: number,
  N: number,
  identificador?: string
): number => {
  if (identificador) console.table([identificador, A, E, N]);
  if (A == 0 && E == 0 && N == 0) return 0;
  if (N == 0) return 0;
  
  return parseFloat(((A * 10) / N).toFixed(2));
};

/**
 * Calcula la calificación usando el método especificado
 * @param A Número de aciertos
 * @param E Número de errores
 * @param N Total de preguntas
 * @param metodoCalificacion Método de calificación a usar
 * @param identificador Identificador opcional para debug
 * @returns Calificación calculada
 */
export const calcularCalificacionPorMetodo = (
  A: number,
  E: number,
  N: number,
  metodoCalificacion: 'A1_E1_3_B0' | 'A1_E1_4_B0' | 'BASICO' = 'A1_E1_3_B0',
  identificador?: string
): number => {
  switch (metodoCalificacion) {
    case 'A1_E1_4_B0':
      return calcularCalificacionA1E1_4B0(A, E, N, identificador);
    case 'BASICO':
      return calcularCalificacionBasico(A, E, N, identificador);
    case 'A1_E1_3_B0':
    default:
      return calcularCalificacionA1E1_3B0(A, E, N, identificador);
  }
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

export const getAlumnoDificultad = (difficulty: Dificultad) => {
  switch (difficulty) {
    case Dificultad.PRIVADAS:
      return { icon: 'pi-eye-slash', label: 'Privado/a' };
    case Dificultad.PUBLICAS:
      return { icon: 'pi-eye', label: 'Publico/a' };
  }
  return null;
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

export const groupedTemas = (temas: Array<Tema>, isAdmin: boolean = false) => {
  return Object.entries(
    temas.reduce((acc, tema) => {
      const categoria = tema.modulo?.nombre;
      if (tema.modulo?.esPublico || isAdmin) {
        if (!acc[categoria as any]) {
          acc[categoria as any] = [];
        }
        acc[categoria as any].push({
          label: tema.numero + ' - ' + tema.descripcion,
          value: tema.id,
          numero: tema.numero,
        });
      }
      return acc;
    }, {} as { [key: string]: { label: string; value: number; numero: number }[] })
  ).map(([categoria, items]) => ({
    label: categoria,
    value: categoria.toLowerCase(), // Puedes ajustar el valor según tus necesidades
    items: items.sort((a, b) => a.numero - b.numero), // Ordenar los ítems por 'numero'
  }));
};

export const getAllDifficultades = (
  isFlashcards = false,
  isCreatingTest = false
) => {
  const privada = getAlumnoDificultad(Dificultad.PRIVADAS);
  const publica = getAlumnoDificultad(Dificultad.PUBLICAS);

  const allDificultades = [
    {
      label: isFlashcards ? 'Datos Básicos' : 'Basico',
      stars: getStarsBasedOnDifficulty(Dificultad.BASICO),
      value: Dificultad.BASICO,
    },
    {
      label: isFlashcards ? 'Datos' : 'Intermedio',
      stars: getStarsBasedOnDifficulty(Dificultad.INTERMEDIO),
      value: Dificultad.INTERMEDIO,
    },
    {
      label: isFlashcards ? 'Tarjetas' : 'Dificil',
      stars: getStarsBasedOnDifficulty(Dificultad.DIFICIL),
      value: Dificultad.DIFICIL,
    },
  ];
  const alumnoOnly = [
    {
      label: isCreatingTest
        ? isFlashcards
          ? 'Solo mis flashcards'
          : 'Solo mis preguntas'
        : privada?.label,
      icon: privada?.icon,
      value: Dificultad.PRIVADAS,
    },
    {
      label: isCreatingTest
        ? isFlashcards
          ? 'Solo flashcards publicos'
          : 'Solo preguntas publicas'
        : publica?.label,
      icon: publica?.icon,
      value: Dificultad.PUBLICAS,
    },
  ];
  if (!isFlashcards) {
    if (!!isCreatingTest)
      alumnoOnly.push({
        label: 'Tecnika Fire',
        icon: 'pi-check-square',
        value: Dificultad.INTERMEDIO,
      });

    return alumnoOnly;
  }
  return [...allDificultades, ...alumnoOnly];
};

export const crearEventoCalendario = (
  evento: any,
  esPersonalizado: boolean = false
): CalendarEvent => {
  const inicio = new Date(evento.horaInicio);
  const duracion = evento.duracion || 60;
  const fin = new Date(inicio.getTime() + duracion * 60000);

  // Crear una estructura unificada
  return {
    title: evento.nombre,
    start: inicio,
    end: fin,
    color: {
      primary: evento.color || (esPersonalizado ? '#4caf50' : '#ffffff'),
      secondary: evento.color || (esPersonalizado ? '#4caf50' : '#ffffff'),
    },
    draggable: true,
    meta: {
      esPersonalizado: esPersonalizado, // Flag para identificar el tipo
      subBloque: {
        id: evento.id,
        comentarios: evento.comentarios || '',
        comentariosAlumno: evento.comentariosAlumno || '',
        color: evento.color || (esPersonalizado ? '#4caf50' : '#ffffff'),
        duracion: evento.duracion,
        importante: evento.importante || false,
        tiempoAviso: evento.tiempoAviso,
        realizado: evento.realizado || false,
        planificacionId: evento.planificacionId, // Añadimos planificacionId para eventos personalizados
        esPersonalizado: esPersonalizado, // Duplicamos el flag dentro del subBloque para facilitar el acceso
      },
    },
  };
};

export function isDateInRange(
  date: Date,
  startDate: Date,
  endDate: Date
): boolean {
  const dateToCheck = new Date(date);
  return dateToCheck >= startDate && dateToCheck <= endDate;
}

export function getNextWeekIfFriday(date: Date): Date {
  const today = new Date(date);
  const dayOfWeek = today.getDay();
  const endDate = new Date(today);

  // If it's Friday (5), Saturday (6) or Sunday (0), show next week
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    endDate.setDate(endDate.getDate() + 7);
  }

  return endDate;
}

/**
 * Funciones de cálculo de calificaciones que admiten método de calificación
 */
export const calcular100 = (
  stats100: StatType, 
  total: number,
  metodoCalificacion: 'A1_E1_3_B0' | 'A1_E1_4_B0' | 'BASICO' = 'A1_E1_3_B0'
) => {
  return calcularCalificacionPorMetodo(stats100.correctas, stats100.incorrectas, total, metodoCalificacion);
};

export const calcular100y75 = (
  stats100: StatType,
  stats75: StatType,
  total: number,
  metodoCalificacion: 'A1_E1_3_B0' | 'A1_E1_4_B0' | 'BASICO' = 'A1_E1_3_B0'
) => {
  return calcularCalificacionPorMetodo(
    stats100.correctas + stats75.correctas,
    stats100.incorrectas + stats75.incorrectas,
    total,
    metodoCalificacion
  );
};

export const calcular100y75y50 = (
  stats100: StatType,
  stats75: StatType,
  stats50: StatType,
  total: number,
  metodoCalificacion: 'A1_E1_3_B0' | 'A1_E1_4_B0' | 'BASICO' = 'A1_E1_3_B0',
  identifier?: string
) => {
  return calcularCalificacionPorMetodo(
    stats100.correctas + stats75.correctas + stats50.correctas,
    stats100.incorrectas + stats75.incorrectas + stats50.incorrectas,
    total,
    metodoCalificacion,
    identifier
  );
};
