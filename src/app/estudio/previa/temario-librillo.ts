import { ParamMap } from '@angular/router';
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';
import {
  DocumentoTemario,
  ModuloTemario,
} from '../../shared/models/documentacion.model';
import { Tema } from '../../shared/models/pregunta.model';
import { slugify } from '../../shared/utils/slugify.util';

export interface TemaLibrillo {
  id: number;
  etiqueta: string;
  titulo: string;
  descripcion?: string;
  modulo: string;
  enBanco: boolean;
  documentos: DocumentoTemario[];
}

export interface DocumentoBiblioteca {
  documento: DocumentoTemario;
  tema: TemaLibrillo;
  titulo: string;
  textoBusqueda: string;
}

function normalizarBusqueda(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function crearBibliotecaDocumentos(arbol: ModuloTemario[]) {
  const biblioteca = new Map<number, DocumentoBiblioteca>();
  for (const tema of crearTemarioLibrillo([], arbol)) {
    for (const documento of tema.documentos) {
      if (biblioteca.has(documento.id)) continue;
      biblioteca.set(documento.id, {
        documento,
        tema,
        titulo: tituloDeBiblioteca(documento, tema.descripcion),
        textoBusqueda: normalizarBusqueda(
          [
            documento.identificador,
            documento.descripcion,
            documento.fileName,
            documento.librillo?.titulo,
            tema.titulo,
            tema.modulo,
          ].join(' '),
        ),
      });
    }
  }
  return biblioteca;
}

export function filtrarBibliotecaDocumentos(
  biblioteca: ReadonlyMap<number, DocumentoBiblioteca>,
  busqueda: string,
  temaId: number | null,
) {
  const palabras = normalizarBusqueda(busqueda).match(/\S+/g) ?? [];
  const documentos: DocumentoTemario[] = [];
  let disponibles = 0;
  for (const { documento, tema, textoBusqueda } of biblioteca.values()) {
    if (temaId !== null && temaId !== tema.id) continue;
    if (!palabras.every((palabra) => textoBusqueda.includes(palabra))) continue;
    documentos.push(documento);
    if (documento.isDownloadable) disponibles++;
  }
  return {
    documentos,
    disponibles,
    bloqueados: documentos.length - disponibles,
  };
}

export function tituloDeBiblioteca(
  documento: DocumentoTemario,
  descripcionTema?: string,
) {
  const nombre = documento.identificador?.trim();
  const descripcion = documento.descripcion?.trim();
  if (nombre && !/^tema\s+\d+(?:[.-]\d+)*$/i.test(nombre)) {
    const tema = slugify(descripcionTema ?? '');
    const ultimoSegmento = nombre.split(/[_/|·]|\s[-–—]\s/).pop() ?? nombre;
    return tema && descripcion && slugify(ultimoSegmento) === tema
      ? descripcion
      : nombre;
  }
  return (
    descripcion ||
    documento.librillo?.titulo?.trim() ||
    documento.fileName?.trim() ||
    nombre ||
    'Documento'
  );
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
      descripcion,
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
        descripcion,
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
