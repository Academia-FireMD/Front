import { ParamMap } from '@angular/router';
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';
import {
  DocumentoTemario,
  ModuloTemario,
} from '../../shared/models/documentacion.model';
import { Tema } from '../../shared/models/pregunta.model';

export interface TemaLibrillo {
  id: number;
  etiqueta: string;
  documentos: DocumentoTemario[];
}

export function crearTemarioLibrillo(
  temas: Tema[],
  arbolDocumental: ModuloTemario[],
): TemaLibrillo[] {
  const documentosPorTema = new Map(
    arbolDocumental.flatMap(({ temas }) =>
      temas.map(({ id, documentos }) => [id, documentos] as const),
    ),
  );

  return temas.map(({ id, numero, descripcion, modulo }) => ({
    id,
    etiqueta: [
      modulo?.nombre,
      descripcion ? `${numero} · ${descripcion}` : `Tema ${numero}`,
    ]
      .filter(Boolean)
      .join(' / '),
    documentos: documentosPorTema.get(id) ?? [],
  }));
}

export function seleccionLibrillo(temas: TemaLibrillo[], params: ParamMap) {
  const temaId = usuarioIdDeSubject(params.get('tema'));
  const documentoId = usuarioIdDeSubject(params.get('doc'));
  const tema = params.has('tema')
    ? temas.find(({ id }) => id === temaId)
    : temas.find(({ documentos }) =>
        documentos.some(({ id }) => id === documentoId),
      );
  const documentos = tema?.documentos ?? [];
  const documento = params.has('doc')
    ? documentos.find(({ id }) => id === documentoId)
    : (documentos.find((doc) => doc.isDownloadable && doc.librillo) ??
      documentos.find((doc) => doc.isDownloadable && esPdfDeLibrillo(doc)) ??
      documentos[0]);

  return {
    tema,
    documento,
    temaInaccesible: !tema && (params.has('tema') || params.has('doc')),
    documentoInaccesible: !!tema && params.has('doc') && !documento,
  };
}

export function esPdfDeLibrillo(documento: DocumentoTemario) {
  return /\.pdf(?:$|[?#])/i.test(documento.fileName || documento.url || '');
}
