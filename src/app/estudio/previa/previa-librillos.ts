import { ParamMap, UrlTree } from '@angular/router';
import { environment } from '../../../environments/environment';
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';

export const RUTA_PREVIA_LIBRILLOS = '/app/librillos';
export const ORIGEN_BIBLIOTECA = 'mis-documentos';

const PREVIA_ANTERIOR = new Map<string, ContextoLibrillo>([
  ['estatutos', { id: 47, documentoId: 145 }],
  ['altura', { id: 49, documentoId: 148 }],
]);

export interface ContextoLibrillo {
  id: number;
  documentoId?: number;
}

export function temaDePracticaLibrillo(
  params: ParamMap | undefined,
  habilitada = environment.librillosMenu,
): ContextoLibrillo | undefined {
  const origen = params?.get('desdeLibrillo');
  if (!habilitada || !origen) return undefined;
  const anterior = PREVIA_ANTERIOR.get(origen);
  if (anterior) return anterior;

  const id = usuarioIdDeSubject(origen);
  if (id === null) return undefined;
  const documentoId = usuarioIdDeSubject(params?.get('documentoLibrillo'));
  return documentoId === null ? { id } : { id, documentoId };
}

export function parametrosPracticaLibrillo(
  tema?: ContextoLibrillo,
): { desdeLibrillo: number; documentoLibrillo?: number } | undefined {
  if (!tema) return undefined;
  return tema.documentoId === undefined
    ? { desdeLibrillo: tema.id }
    : { desdeLibrillo: tema.id, documentoLibrillo: tema.documentoId };
}

export function parametrosVistaLibrillo(tema: ContextoLibrillo) {
  return { tema: tema.id, doc: tema.documentoId };
}

export function retornoDePracticaLibrillo(
  url: UrlTree,
  habilitada = environment.librillosMenu,
): ContextoLibrillo | undefined {
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

export type VistaTemario = 'documentos' | 'librillo';

export function vistaDeTemario(valor: string | null): VistaTemario | undefined {
  return valor === 'documentos' || valor === 'librillo' ? valor : undefined;
}

export function retornoDeEdicionInteractiva(
  params: ParamMap,
  documento: string | null,
  habilitado: boolean,
) {
  if (habilitado && params.get('desde') === ORIGEN_BIBLIOTECA) {
    return {
      ruta: RUTA_PREVIA_LIBRILLOS,
      parametros: { tema: null, doc: null, vista: 'documentos' as const },
    };
  }

  const tema = usuarioIdDeSubject(params.get('tema'));
  const doc = usuarioIdDeSubject(documento);
  const vista = vistaDeTemario(params.get('vista'));
  const desdeTemario = habilitado && params.get('desde') === 'librillos';

  return {
    ruta: desdeTemario ? RUTA_PREVIA_LIBRILLOS : '/app/documentacion/alumno',
    parametros: { tema, doc, vista: desdeTemario ? vista : undefined },
  };
}
