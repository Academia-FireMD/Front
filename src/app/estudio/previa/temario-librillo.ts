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
  titulo: string;
  modulo: string;
  enBanco: boolean;
  documentos: DocumentoTemario[];
}

export function crearTemarioLibrillo(
  temas: Tema[],
  arbolDocumental: ModuloTemario[],
): TemaLibrillo[] {
  const catalogo = new Map<number, TemaLibrillo>();

  for (const { id, numero, descripcion, modulo } of temas) {
    const titulo = descripcion
      ? `${numero} · ${descripcion}`
      : `Tema ${numero}`;
    const nombre = modulo?.nombre || 'Otros temas';
    catalogo.set(id, {
      id,
      etiqueta: modulo?.nombre ? `${nombre} / ${titulo}` : titulo,
      titulo,
      modulo: nombre,
      enBanco: true,
      documentos: [],
    });
  }

  for (const modulo of arbolDocumental) {
    for (const { id, numero, descripcion, documentos } of modulo.temas) {
      const titulo = descripcion
        ? `${numero} · ${descripcion}`
        : `Tema ${numero}`;
      const anterior = catalogo.get(id);
      const porId = new Map(anterior?.documentos.map((doc) => [doc.id, doc]));
      for (const doc of documentos) porId.set(doc.id, doc);
      catalogo.set(id, {
        id,
        etiqueta: `${modulo.nombre} / ${titulo}`,
        titulo,
        modulo: modulo.nombre,
        enBanco: anterior?.enBanco ?? false,
        documentos: [...porId.values()],
      });
    }
  }

  return [...catalogo.values()];
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
    : (documentos.find((doc) => pdfDisponible(doc) && doc.librillo) ??
      documentos.find(pdfDisponible) ??
      documentos.find((doc) => doc.isDownloadable) ??
      documentos[0]);

  return {
    tema,
    documento,
    temaInaccesible: !tema && (params.has('tema') || params.has('doc')),
    documentoInaccesible: !!tema && params.has('doc') && !documento,
  };
}

export function pdfDisponible(documento: DocumentoTemario): boolean {
  // La extensión de la URL se conserva como metadato de archivos antiguos.
  // Las descargas y la lectura siempre usan el ID autorizado del árbol.
  const nombre = documento.fileName?.trim() || documento.url;
  return documento.isDownloadable && /\.pdf(?:$|[?#])/i.test(nombre);
}
