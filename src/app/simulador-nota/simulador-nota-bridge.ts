import {
  SimuladorNotaSnapshot,
} from './models/simulador-nota.model';

export const SIMULADOR_NOTA_CHANNEL = 'tkf-simulador-nota-v1';
export const SIMULADOR_NOTA_MAX_BYTES = 1024 * 1024;
const MAX_GUARDADAS = 200;
const PRIVATE_ONLY_FIELDS = new Set([
  'psico',
  'medico',
  'correo',
  'email',
  'aviso',
]);
const MAX_PLAZAS_POR_CONVOCATORIA: Record<string, number> = {
  cpbv2023: 533,
  cpba: 721,
  ayto2022: 155,
  ayto2024: 380,
  cpbv2018: 189,
  madrid2023: 267,
  madrid2022: 124,
};

export type SimuladorNotaMessage =
  | { channel: typeof SIMULADOR_NOTA_CHANNEL; type: 'ready' }
  | {
      channel: typeof SIMULADOR_NOTA_CHANNEL;
      type: 'change';
      estado: SimuladorNotaSnapshot;
    }
  | { channel: typeof SIMULADOR_NOTA_CHANNEL; type: 'delete' };

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === 'string' && keys.includes(key))
  );
}

function utf8Length(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function isNumber(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && isNumber(value, min, max);
}

function isNullableNumber(value: unknown, min: number, max: number): boolean {
  return value === null || isNumber(value, min, max);
}

function isNullableInteger(value: unknown, min: number, max: number): boolean {
  return value === null || isInteger(value, min, max);
}

function isOneOf(value: unknown, values: readonly unknown[]): boolean {
  return values.includes(value);
}

/** Whitelist derivada del objeto de estado de TKFCore.estadoVacio/sanear. */
function isSimulationState(value: unknown): value is Record<string, unknown> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'v',
      'nombre',
      'sexo',
      'test',
      'supuesto',
      'fisicas',
      'convocatoria',
      'ambito',
      'tipo',
      'meritos',
      'objetivo',
    ]) ||
    value['v'] !== 1 ||
    typeof value['nombre'] !== 'string' ||
    value['nombre'].length > 60 ||
    !isOneOf(value['sexo'], ['H', 'M']) ||
    typeof value['convocatoria'] !== 'string' ||
    value['convocatoria'].length > 30 ||
    !isOneOf(value['ambito'], ['', 'cv', 'madrid']) ||
    !isOneOf(value['tipo'], ['', 'consorcio', 'ayuntamiento']) ||
    (value['ambito'] === 'madrid' && value['tipo'] !== '') ||
    (value['ambito'] === 'cv' &&
      !isOneOf(value['tipo'], ['consorcio', 'ayuntamiento'])) ||
    !isNullableNumber(value['objetivo'], 0, 50)
  ) {
    return false;
  }

  const test = value['test'];
  if (
    !isRecord(test) ||
    !hasExactKeys(test, ['modo', 'n', 'aciertos', 'errores', 'pen', 'nota']) ||
    !isOneOf(test['modo'], ['calc', 'nota']) ||
    !isInteger(test['n'], 1, 500) ||
    !isNullableInteger(test['aciertos'], 0, 500) ||
    !isNullableInteger(test['errores'], 0, 500) ||
    !isOneOf(test['pen'], [0, 2, 3, 4]) ||
    !isNullableNumber(test['nota'], 0, 10)
  ) {
    return false;
  }

  const supuesto = value['supuesto'];
  if (
    !isRecord(supuesto) ||
    !hasExactKeys(supuesto, ['nota']) ||
    !isNullableNumber(supuesto['nota'], 0, 10)
  ) {
    return false;
  }

  const fisicas = value['fisicas'];
  if (
    !isRecord(fisicas) ||
    !hasExactKeys(fisicas, [
      'cuerda',
      'r3000',
      'v60',
      'nat100',
      'press',
      'noApto',
      'torre',
      'madrid',
      'modo',
      'nota',
    ]) ||
    !isNullableNumber(fisicas['cuerda'], 0.01, 999) ||
    !isNullableNumber(fisicas['r3000'], 0.01, 5999) ||
    !isNullableNumber(fisicas['v60'], 0.01, 999) ||
    !isNullableNumber(fisicas['nat100'], 0.01, 5999) ||
    !isNullableInteger(fisicas['press'], 0, 200) ||
    !Array.isArray(fisicas['noApto']) ||
    fisicas['noApto'].length > 5 ||
    new Set(fisicas['noApto']).size !== fisicas['noApto'].length ||
    fisicas['noApto'].some(
      (id) => !isOneOf(id, ['cuerda', 'r3000', 'v60', 'nat100', 'press']),
    ) ||
    !isOneOf(fisicas['modo'], ['pruebas', 'nota']) ||
    !isNullableNumber(fisicas['nota'], 0, 10)
  ) {
    return false;
  }

  const torre = fisicas['torre'];
  if (
    !isRecord(torre) ||
    !hasExactKeys(torre, ['incluir', 'preset', 'puntos', 'tiempo']) ||
    typeof torre['incluir'] !== 'boolean' ||
    typeof torre['preset'] !== 'string' ||
    torre['preset'].length > 40 ||
    !(torre['puntos'] === null ||
      torre['puntos'] === 0 ||
      (isNumber(torre['puntos'], 5, 10) &&
        Number.isInteger((torre['puntos'] as number) * 2))) ||
    !isNullableNumber(torre['tiempo'], 0.01, 5999)
  ) {
    return false;
  }

  const madrid = fisicas['madrid'];
  if (
    !isRecord(madrid) ||
    !hasExactKeys(madrid, ['press40', 'm300', 'm2000', 'suma']) ||
    !isNullableInteger(madrid['press40'], 0, 200) ||
    !isNullableNumber(madrid['m300'], 0.01, 999) ||
    !isNullableNumber(madrid['m2000'], 0.01, 5999) ||
    !isNullableNumber(madrid['suma'], 0, 30)
  ) {
    return false;
  }

  const meritos = value['meritos'];
  if (
    !isRecord(meritos) ||
    !hasExactKeys(meritos, ['exp', 'titulos', 'cursos', 'valenciano', 'idiomas'])
  ) {
    return false;
  }

  const exp = meritos['exp'];
  if (!isRecord(exp) || !hasExactKeys(exp, ['a', 'b', 'c', 'd'])) return false;
  for (const id of ['a', 'b', 'c', 'd']) {
    const item = exp[id];
    const keys = id === 'a' || id === 'b' ? ['meses', 'jornada'] : ['meses'];
    if (
      !isRecord(item) ||
      !hasExactKeys(item, keys) ||
      !isInteger(item['meses'], 0, 600) ||
      ((id === 'a' || id === 'b') && !isNumber(item['jornada'], 1, 100))
    ) {
      return false;
    }
  }

  const tituloIds = [
    'bach',
    'gs',
    'gmepc',
    'gsepc',
    'gsfor',
    'grado',
    'arqing',
    'gradomaster',
    'master',
  ];
  const titulos = meritos['titulos'];
  if (
    !isRecord(titulos) ||
    !hasExactKeys(titulos, tituloIds) ||
    tituloIds.some((id) => !isInteger(titulos[id], 0, 9))
  ) {
    return false;
  }

  const cursoIds = ['h200', 'h100', 'h50', 'h40', 'h30', 'h20'];
  const cursos = meritos['cursos'];
  if (
    !isRecord(cursos) ||
    !hasExactKeys(cursos, cursoIds) ||
    cursoIds.some((id) => !isInteger(cursos[id], 0, 99))
  ) {
    return false;
  }

  const niveles = ['', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!isOneOf(meritos['valenciano'], niveles)) return false;
  const idiomas = meritos['idiomas'];
  if (
    !Array.isArray(idiomas) ||
    idiomas.length < 1 ||
    idiomas.length > 6 ||
    idiomas.some(
      (idioma) =>
        !isRecord(idioma) ||
        !hasExactKeys(idioma, ['idioma', 'nivel']) ||
        typeof idioma['idioma'] !== 'string' ||
        idioma['idioma'].length > 30 ||
        !isOneOf(idioma['nivel'], niveles),
    )
  ) {
    return false;
  }

  return true;
}

function isCanonicalIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isSnapshot(value: unknown): value is SimuladorNotaSnapshot {
  if (!isRecord(value)) return false;
  if (!hasExactKeys(value, ['v', 'actual', 'guardadas', 'tab', 'plazas']))
    return false;
  if (
    value['v'] !== 1 ||
    (value['actual'] !== null && !isSimulationState(value['actual'])) ||
    !Array.isArray(value['guardadas']) ||
    value['guardadas'].length > MAX_GUARDADAS ||
    (value['tab'] !== null &&
      !isOneOf(value['tab'], [
        'examenes',
        'fisicas',
        'meritos',
        'resultado',
        'oposiciones',
    ])) ||
    !isRecord(value['plazas']) ||
    Object.entries(value['plazas']).some(
      ([id, plazas]) =>
        MAX_PLAZAS_POR_CONVOCATORIA[id] === undefined ||
        !isInteger(plazas, 1, MAX_PLAZAS_POR_CONVOCATORIA[id]),
    )
  ) {
    return false;
  }

  for (const guardada of value['guardadas']) {
    if (
      !isRecord(guardada) ||
      !hasExactKeys(guardada, ['id', 'nombre', 'fecha', 'origen', 'estado']) ||
      typeof guardada['id'] !== 'string' ||
      !/^g[a-z0-9]{1,49}$/.test(guardada['id']) ||
      typeof guardada['nombre'] !== 'string' ||
      guardada['nombre'].length > 60 ||
      typeof guardada['fecha'] !== 'string' ||
      !isCanonicalIsoDate(guardada['fecha']) ||
      !['propia', 'importada'].includes(String(guardada['origen'])) ||
      !isSimulationState(guardada['estado'])
    ) {
      return false;
    }
  }

  try {
    const serialized = JSON.stringify(value);
    return (
      typeof serialized === 'string' &&
      utf8Length(serialized) <= SIMULADOR_NOTA_MAX_BYTES
    );
  } catch {
    return false;
  }
}

/** Valida emisor, origen y el sobre exacto de cada mensaje iframe → padre. */
export function validateSimuladorMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  expectedOrigin: string,
  expectedSource: MessageEventSource,
): SimuladorNotaMessage | null {
  if (event.origin !== expectedOrigin || event.source !== expectedSource) return null;
  if (!isRecord(event.data)) return null;
  const data = event.data;
  if (data['channel'] !== SIMULADOR_NOTA_CHANNEL) return null;

  if (data['type'] === 'ready' || data['type'] === 'delete') {
    if (!hasExactKeys(data, ['channel', 'type'])) return null;
    return data['type'] === 'ready'
      ? { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' }
      : { channel: SIMULADOR_NOTA_CHANNEL, type: 'delete' };
  }

  if (
    data['type'] !== 'change' ||
    !hasExactKeys(data, ['channel', 'type', 'estado']) ||
    !isSnapshot(data['estado'])
  ) {
    return null;
  }
  return {
    channel: SIMULADOR_NOTA_CHANNEL,
    type: 'change',
    estado: data['estado'],
  };
}

function removeSessionOnlyFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSessionOnlyFields);
  if (!isRecord(value)) return value;

  return Object.entries(value).reduce<Record<string, unknown>>(
    (result, [key, nested]) => {
      if (!PRIVATE_ONLY_FIELDS.has(key.toLowerCase())) {
        result[key] = removeSessionOnlyFields(nested);
      }
      return result;
    },
    {},
  );
}

/** Copia wire segura: no persiste estados médicos/psicotécnicos ni captación. */
export function sanitizeSimuladorSnapshot(
  value: unknown,
): SimuladorNotaSnapshot {
  const sanitized = removeSessionOnlyFields(value);
  if (!isSnapshot(sanitized)) {
    throw new Error('El estado del simulador no cumple el contrato de guardado.');
  }
  return sanitized;
}
