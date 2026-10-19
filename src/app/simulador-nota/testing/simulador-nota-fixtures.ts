import { SimuladorNotaSnapshot } from '../models/simulador-nota.model';

export function makeValidSimulationState(): Record<string, unknown> {
  return {
    v: 1,
    nombre: '',
    sexo: 'H',
    test: {
      modo: 'calc',
      n: 100,
      aciertos: null,
      errores: null,
      pen: 3,
      nota: null,
    },
    supuesto: { nota: null },
    psico: 'pend',
    medico: 'pend',
    fisicas: {
      cuerda: null,
      r3000: null,
      v60: null,
      nat100: null,
      press: null,
      noApto: [],
      torre: { incluir: true, preset: '', puntos: null, tiempo: null },
      madrid: { press40: null, m300: null, m2000: null, suma: null },
      modo: 'pruebas',
      nota: null,
    },
    convocatoria: '',
    ambito: '',
    tipo: '',
    meritos: {
      exp: {
        a: { meses: 0, jornada: 100 },
        b: { meses: 0, jornada: 100 },
        c: { meses: 0 },
        d: { meses: 0 },
      },
      titulos: {
        bach: 0,
        gs: 0,
        gmepc: 0,
        gsepc: 0,
        gsfor: 0,
        grado: 0,
        arqing: 0,
        gradomaster: 0,
        master: 0,
      },
      cursos: { h200: 0, h100: 0, h50: 0, h40: 0, h30: 0, h20: 0 },
      valenciano: '',
      idiomas: [{ idioma: 'Inglés', nivel: '' }],
    },
    objetivo: null,
  };
}

export function makeValidWireState(
  ambito = '',
  tipo = '',
): Record<string, unknown> {
  const state = makeValidSimulationState();
  delete state['psico'];
  delete state['medico'];
  return { ...state, ambito, tipo };
}

export function makeValidSnapshot(): SimuladorNotaSnapshot {
  return {
    v: 1,
    actual: makeValidWireState(),
    guardadas: [],
    tab: 'examenes',
    plazas: {},
  };
}
