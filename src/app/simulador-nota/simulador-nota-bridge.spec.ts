import {
  SIMULADOR_NOTA_CHANNEL,
  sanitizeSimuladorSnapshot,
  validateSimuladorMessage,
} from './simulador-nota-bridge';
import {
  makeValidSimulationState,
  makeValidSnapshot,
  makeValidWireState,
} from './testing/simulador-nota-fixtures';

describe('bridge del simulador de nota', () => {
  const expectedOrigin = 'https://app.example.test';
  const expectedSource = {} as MessageEventSource;

  it('solo acepta mensajes del iframe esperado y del origen exacto', () => {
    const data = { channel: SIMULADOR_NOTA_CHANNEL, type: 'ready' };
    const event = { origin: expectedOrigin, source: expectedSource, data };

    expect(
      validateSimuladorMessage(event, expectedOrigin, expectedSource),
    ).toEqual(data);
    expect(
      validateSimuladorMessage(
        { ...event, origin: 'https://evil.example' },
        expectedOrigin,
        expectedSource,
      ),
    ).toBeNull();
    expect(
      validateSimuladorMessage(
        { ...event, source: {} as MessageEventSource },
        expectedOrigin,
        expectedSource,
      ),
    ).toBeNull();
  });

  it('valida estrictamente tipo y forma del sobre antes de aceptarlo', () => {
    const event = {
      origin: expectedOrigin,
      source: expectedSource,
      data: {
        channel: SIMULADOR_NOTA_CHANNEL,
        type: 'ready',
        estado: {},
      },
    };

    expect(
      validateSimuladorMessage(event, expectedOrigin, expectedSource),
    ).toBeNull();
  });

  it('quita los campos psicotécnicos y médicos de actual y guardadas', () => {
    const actual = makeValidSimulationState();
    actual['ambito'] = 'cv';
    actual['tipo'] = 'consorcio';
    actual['sexo'] = 'M';
    actual['correo'] = { email: 'no-persistir@example.test' };
    actual['aviso'] = true;
    const snapshot = {
      v: 1 as const,
      actual,
      guardadas: [
        {
          id: 'gs1',
          nombre: 'Simulación',
          fecha: '2026-10-19T12:00:00.000Z',
          origen: 'propia' as const,
          estado: {
            ...makeValidSimulationState(),
            ambito: 'madrid',
            psico: 'apto',
            medico: 'no',
          },
        },
      ],
      tab: 'examenes',
      plazas: { cpbv2023: 18 },
    };

    const result = sanitizeSimuladorSnapshot(snapshot);

    expect(result.actual).toMatchObject({ ambito: 'cv', sexo: 'M' });
    expect(result.guardadas[0].estado).toMatchObject({ ambito: 'madrid' });
    expect(JSON.stringify(result)).not.toMatch(/psico|medico|correo|email|aviso/i);
  });

  it('rechaza snapshots sobre el límite del contrato o con forma incompleta', () => {
    const guardadas = Array.from({ length: 200 }, (_, index) => ({
      id: `g${index.toString(36)}`,
      nombre: 'Guardada',
      fecha: '2026-10-19T12:00:00.000Z',
      origen: 'propia' as const,
      estado: makeValidWireState(),
    }));
    const maximo = {
      v: 1 as const,
      actual: null,
      guardadas,
      tab: null,
      plazas: {},
    };
    expect(sanitizeSimuladorSnapshot(maximo).guardadas).toHaveLength(200);
    expect(() =>
      sanitizeSimuladorSnapshot({
        v: 1,
        actual: null,
        guardadas: [...guardadas, {
          id: 'g5k',
          nombre: 'Guardada',
          fecha: '2026-10-19T12:00:00.000Z',
          origen: 'propia',
          estado: makeValidWireState(),
        }],
        tab: null,
        plazas: {},
      }),
    ).toThrow();
    expect(() => sanitizeSimuladorSnapshot({ v: 1 })).toThrow();
  });

  it('acepta rangos de test iguales al validador del backend', () => {
    const snapshot = makeValidSnapshot();
    const test = snapshot.actual?.['test'] as Record<string, unknown>;
    test['n'] = 100;
    test['aciertos'] = 80;
    test['errores'] = 30;

    expect(sanitizeSimuladorSnapshot(snapshot).actual?.['test']).toMatchObject({
      n: 100,
      aciertos: 80,
      errores: 30,
    });
  });

  it('rechaza campos de estado desconocidos y valores fuera de rango', () => {
    const unknown = makeValidSnapshot();
    (unknown.actual as Record<string, unknown>)['dni'] = 'no-persistir';
    expect(() => sanitizeSimuladorSnapshot(unknown)).toThrow();

    const outOfRange = makeValidSnapshot();
    ((outOfRange.actual as Record<string, any>)['test'] as Record<string, unknown>)[
      'n'
    ] = 501;
    expect(() => sanitizeSimuladorSnapshot(outOfRange)).toThrow();
  });

  it('aplica al cliente los mismos límites de plazas y estructura de guardadas que el API', () => {
    const invalidPlazas = makeValidSnapshot();
    invalidPlazas.plazas = { cpbv2023: 534 };
    expect(() => sanitizeSimuladorSnapshot(invalidPlazas)).toThrow();

    const invalidConvocatoria = makeValidSnapshot();
    invalidConvocatoria.plazas = { desconocida: 1 };
    expect(() => sanitizeSimuladorSnapshot(invalidConvocatoria)).toThrow();

    const invalidSaved = makeValidSnapshot();
    invalidSaved.guardadas = [
      {
        id: 'legacy-id',
        nombre: 'Guardada',
        fecha: '2026-10-19T12:00:00Z',
        origen: 'propia',
        estado: { ...makeValidSimulationState(), ambito: 'madrid' },
      },
    ];
    expect(() => sanitizeSimuladorSnapshot(invalidSaved)).toThrow();
  });
});
