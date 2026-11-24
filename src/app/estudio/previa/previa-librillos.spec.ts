import { convertToParamMap, DefaultUrlSerializer } from '@angular/router';
import {
  parametrosPracticaLibrillo,
  retornoDePracticaLibrillo,
  temaDePracticaLibrillo,
} from './previa-librillos';

describe('Navegación de práctica desde el Librillo', () => {
  const url = new DefaultUrlSerializer();

  it('precarga el tema conocido y propaga solo su referencia', () => {
    const tema = temaDePracticaLibrillo(
      convertToParamMap({
        desdeLibrillo: 'altura',
        tema: 47,
        volver: '/externo',
      }),
      true,
    );
    expect(tema?.id).toBe(49);
    expect(parametrosPracticaLibrillo(tema)).toEqual({
      desdeLibrillo: 'altura',
    });
  });

  it('recupera el tema al finalizar la práctica', () => {
    const resultado = url.parse(
      '/app/test/alumno/stats-test-flashcard/234?desdeLibrillo=estatutos',
    );
    expect(retornoDePracticaLibrillo(resultado, true)?.id).toBe(47);
  });

  it('limita el retorno a las pantallas de práctica de la previa', () => {
    const perfil = url.parse('/app/profile?desdeLibrillo=altura');
    const ruta = url.parse(
      '/app/test/alumno/realizar-test?desdeLibrillo=altura',
    );
    expect(retornoDePracticaLibrillo(perfil, true)).toBeUndefined();
    expect(retornoDePracticaLibrillo(ruta, false)).toBeUndefined();
    expect(
      temaDePracticaLibrillo(convertToParamMap({ desdeLibrillo: '54' }), true),
    ).toBeUndefined();
  });
});
