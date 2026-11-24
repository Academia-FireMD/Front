import { ParamMap, UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';

export const RUTA_PREVIA_LIBRILLOS =
  '/app/documentacion/alumno/previa-librillos';

export const TEMAS_PREVIA_LIBRILLOS = [
  {
    clave: 'estatutos',
    id: 47,
    documentoId: 145,
    titulo: 'Estatutos del CPBA',
  },
  {
    clave: 'altura',
    id: 49,
    documentoId: 148,
    titulo: 'Trabajos en altura',
  },
] as const;

type TemaPreviaLibrillos = (typeof TEMAS_PREVIA_LIBRILLOS)[number];

export function temaDePracticaLibrillo(
  params: ParamMap | undefined,
  habilitada = environment.librillosMenu,
): TemaPreviaLibrillos | undefined {
  if (!habilitada) return undefined;

  return TEMAS_PREVIA_LIBRILLOS.find(
    ({ clave }) => clave === params?.get('desdeLibrillo'),
  );
}

export function parametrosPracticaLibrillo(
  tema?: TemaPreviaLibrillos,
): { desdeLibrillo: string } | undefined {
  return tema ? { desdeLibrillo: tema.clave } : undefined;
}

export function retornoDePracticaLibrillo(
  url: UrlTree,
  habilitada = environment.librillosMenu,
): TemaPreviaLibrillos | undefined {
  const ruta = url.root.children['primary']?.segments
    .map(({ path }) => path)
    .join('/');
  if (
    !ruta ||
    !/^app\/test\/alumno\/(realizar-test|realizar-flash-cards-test|stats-test|stats-test-flashcard)(\/\d+)?$/.test(
      ruta,
    )
  ) {
    return undefined;
  }

  return temaDePracticaLibrillo(url.queryParamMap, habilitada);
}
