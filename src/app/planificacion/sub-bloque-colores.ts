export const COLORES_TIPO_SUBBLOQUE = {
  entrenamiento: '#fdd6b3', // Naranja pastel
  especificoSpeis: '#b8fcd1', // Verde menta
  general: '#b8f6fb', // Azul cielo
  especifico: '#fbf3c0', // Amarillo suave
  psicotecnico: '#f7d794', // Amarillo más fuerte
  varios: '#ffffff', // Blanco
  examen: '#ffcdd2', // Rojo suave
} as const;

export const POSIBLES_TIPOS_SUBBLOQUE = [
  {
    label: 'Entrenamiento',
    value: COLORES_TIPO_SUBBLOQUE.entrenamiento,
  },
  {
    label: 'Específico SPEIS',
    value: COLORES_TIPO_SUBBLOQUE.especificoSpeis,
  },
  {
    label: 'General',
    value: COLORES_TIPO_SUBBLOQUE.general,
  },
  {
    label: 'Específico',
    value: COLORES_TIPO_SUBBLOQUE.especifico,
  },
  {
    label: 'Psicotécnico',
    value: COLORES_TIPO_SUBBLOQUE.psicotecnico,
  },
  {
    label: 'Varios',
    value: COLORES_TIPO_SUBBLOQUE.varios,
  },
  {
    label: 'Examen',
    value: COLORES_TIPO_SUBBLOQUE.examen,
  },
];
