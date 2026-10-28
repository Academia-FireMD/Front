import { Curso, CursoDetail, Leccion, Seccion } from '../models/curso.model';
import { esLeccionAplicacionValida, resolverCtaCurso } from './curso-cta.util';

function leccion(id: number, overrides: Partial<Leccion> = {}): Leccion {
  return {
    id,
    seccionId: 1,
    titulo: `Lección ${id}`,
    orden: id,
    tipo: 'TEXTO',
    ...overrides,
  };
}

function curso(
  lecciones: Leccion[],
  overrides: Partial<CursoDetail> = {},
): CursoDetail {
  const seccion: Seccion = {
    id: 1,
    cursoId: 10,
    titulo: 'Sección',
    orden: 0,
    lecciones,
  };
  return {
    id: 10,
    titulo: 'Curso',
    slug: 'curso',
    estado: 'PUBLICADO',
    secciones: [seccion],
    ...overrides,
  };
}

const bloqueHidraulica = (id: number): NonNullable<Leccion['bloques']>[0] => ({
  id,
  leccionId: 95,
  orden: id,
  tipo: 'INTERACTIVO',
  aplicacionCodigo: 'HIDRAULICA',
});

function cursoEscalar(
  overrides: Partial<Curso> & { secciones?: Seccion[] } = {},
): Curso & { secciones?: Seccion[] } {
  return {
    id: 10,
    titulo: 'Curso',
    slug: 'curso',
    estado: 'PUBLICADO',
    ...overrides,
  };
}

describe('resolverCtaCurso', () => {
  it('APLICACION con entrada válida lanza SIEMPRE la lección configurada', () => {
    const c = curso([leccion(94), leccion(95)], {
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
    });
    const destino = resolverCtaCurso(c, [], 100);
    expect(destino).toMatchObject({
      aplicacion: true,
      etiqueta: 'Abrir aplicación',
      leccionId: 95,
      disponible: true,
      motivo: null,
    });
  });

  it('catálogo escalar sin jerarquía: un id de entrada positivo habilita Abrir aplicación', () => {
    const c = cursoEscalar({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
    });
    expect(c.secciones).toBeUndefined();
    const destino = resolverCtaCurso(c, [], 100);
    expect(destino).toMatchObject({
      aplicacion: true,
      etiqueta: 'Abrir aplicación',
      leccionId: 95,
      disponible: true,
      motivo: null,
    });
  });

  it('catálogo escalar con entrada no positiva queda deshabilitado', () => {
    for (const entry of [null, 0, -1, Number.NaN, 1.5]) {
      const destino = resolverCtaCurso(
        cursoEscalar({
          modoPresentacion: 'APLICACION',
          leccionAplicacionId: entry,
        }),
      );
      expect(destino.aplicacion).toBe(true);
      expect(destino.disponible).toBe(false);
      expect(destino.leccionId).toBeNull();
    }
  });

  it('jerarquía explícita completa pero entrada ausente: deshabilitado (sin fallback)', () => {
    const c = curso([leccion(94)], {
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
    });
    const destino = resolverCtaCurso(c, [], 50);
    expect(destino.disponible).toBe(false);
    expect(destino.leccionId).toBeNull();
    expect(destino.motivo).toContain('ya no está disponible');
  });

  it('jerarquía explícitamente vacía: deshabilitado (no es un catálogo escalar)', () => {
    const c = cursoEscalar({
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
      secciones: [],
    });
    expect(resolverCtaCurso(c).disponible).toBe(false);
  });

  it('APLICACION sin entrada queda deshabilitada sin fallback a la intro', () => {
    const c = curso([leccion(94), leccion(95)], {
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: null,
    });
    const destino = resolverCtaCurso(c, [], 0);
    expect(destino.aplicacion).toBe(true);
    expect(destino.disponible).toBe(false);
    expect(destino.leccionId).toBeNull();
    expect(destino.etiqueta).toBe('Aplicación no disponible');
    expect(destino.motivo).toBeTruthy();
  });

  it('APLICACION con entrada que ya no existe queda deshabilitada', () => {
    const c = curso([leccion(94)], {
      modoPresentacion: 'APLICACION',
      leccionAplicacionId: 95,
    });
    const destino = resolverCtaCurso(c, [], 50);
    expect(destino.disponible).toBe(false);
    expect(destino.leccionId).toBeNull();
  });

  it('APLICACION con pila mixta en la proyección queda deshabilitada', () => {
    const c = curso(
      [
        leccion(95, {
          bloques: [
            bloqueHidraulica(1),
            {
              id: 2,
              leccionId: 95,
              orden: 2,
              tipo: 'TEXTO',
              contenidoMarkdown: 'no',
            },
          ],
        }),
      ],
      { modoPresentacion: 'APLICACION', leccionAplicacionId: 95 },
    );
    expect(resolverCtaCurso(c).disponible).toBe(false);
  });

  it('ESTANDAR conserva Continuar/Empezar y la lección de continuidad', () => {
    const c = curso([leccion(1), leccion(2)], {
      modoPresentacion: 'ESTANDAR',
      leccionAplicacionId: null,
    });
    expect(resolverCtaCurso(c, [], 0)).toMatchObject({
      aplicacion: false,
      etiqueta: 'Empezar',
      leccionId: 1,
      disponible: true,
    });
    expect(resolverCtaCurso(c, [], 40)).toMatchObject({
      aplicacion: false,
      etiqueta: 'Continuar',
      leccionId: 1,
    });
  });

  it('ESTANDAR sin lecciones queda deshabilitado con motivo', () => {
    const destino = resolverCtaCurso(curso([]));
    expect(destino.disponible).toBe(false);
    expect(destino.leccionId).toBeNull();
    expect(destino.motivo).toBeTruthy();
  });

  it('sin campo de modo (cliente/backend antiguo) se comporta como ESTANDAR', () => {
    const destino = resolverCtaCurso(curso([leccion(1)]));
    expect(destino.aplicacion).toBe(false);
    expect(destino.etiqueta).toBe('Empezar');
  });
});

describe('esLeccionAplicacionValida', () => {
  it('acepta únicamente bloques INTERACTIVO del mismo código aprobado', () => {
    expect(
      esLeccionAplicacionValida(
        leccion(95, { bloques: [bloqueHidraulica(1), bloqueHidraulica(2)] }),
      ),
    ).toBe(true);
  });

  it('rechaza pila vacía, mixta, código distinto o desconocido', () => {
    expect(esLeccionAplicacionValida(leccion(95, { bloques: [] }))).toBe(false);
    expect(
      esLeccionAplicacionValida(
        leccion(95, {
          bloques: [
            bloqueHidraulica(1),
            { id: 2, leccionId: 95, orden: 2, tipo: 'TEXTO' },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      esLeccionAplicacionValida(
        leccion(95, {
          bloques: [{ ...bloqueHidraulica(1), aplicacionCodigo: 'OTRA' }],
        }),
      ),
    ).toBe(false);
  });

  it('sin proyección de bloques no invalida (la valida el aula al cargar)', () => {
    expect(esLeccionAplicacionValida(leccion(95))).toBe(true);
  });
});
