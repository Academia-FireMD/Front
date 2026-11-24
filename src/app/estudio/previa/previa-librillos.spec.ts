import { convertToParamMap, DefaultUrlSerializer } from '@angular/router';
import {
  parametrosPracticaLibrillo,
  parametrosVistaLibrillo,
  retornoDePracticaLibrillo,
  temaDePracticaLibrillo,
} from './previa-librillos';

describe('Navegación de práctica desde el Librillo', () => {
  const url = new DefaultUrlSerializer();

  it('recupera el tema y documento de cualquier tema del banco', () => {
    const tema = temaDePracticaLibrillo(
      convertToParamMap({
        desdeLibrillo: '309',
        documentoLibrillo: '987',
        volver: '/externo',
      }),
      true,
    );
    expect(tema).toEqual({ id: 309, documentoId: 987 });
    expect(parametrosPracticaLibrillo(tema)).toEqual({
      desdeLibrillo: 309,
      documentoLibrillo: 987,
    });
    expect(parametrosVistaLibrillo(tema!)).toEqual({ tema: 309, doc: 987 });
  });

  it('conserva la vuelta de prácticas abiertas antes del cambio', () => {
    const resultado = url.parse(
      '/app/test/alumno/stats-test-flashcard/234?desdeLibrillo=estatutos',
    );
    expect(retornoDePracticaLibrillo(resultado, true)).toEqual({
      id: 47,
      documentoId: 145,
    });
  });

  it('permite practicar temas que todavía no tienen documento', () => {
    const resultado = url.parse(
      '/app/test/alumno/stats-test/123?desdeLibrillo=309',
    );
    expect(retornoDePracticaLibrillo(resultado, true)).toEqual({ id: 309 });
  });

  it('limita el retorno a prácticas del campus, con un tema numérico válido', () => {
    const perfil = url.parse('/app/profile?desdeLibrillo=309');
    const ruta = url.parse('/app/test/alumno/realizar-test?desdeLibrillo=309');
    expect(retornoDePracticaLibrillo(perfil, true)).toBeUndefined();
    expect(retornoDePracticaLibrillo(ruta, false)).toBeUndefined();
    expect(
      temaDePracticaLibrillo(
        convertToParamMap({ desdeLibrillo: '309/externo' }),
        true,
      ),
    ).toBeUndefined();
    expect(
      temaDePracticaLibrillo(convertToParamMap({ desdeLibrillo: '0' }), true),
    ).toBeUndefined();
  });
});
