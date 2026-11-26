import { convertToParamMap } from '@angular/router';
import {
  DocumentoTemario,
  ModuloTemario,
} from '../../shared/models/documentacion.model';
import {
  crearBibliotecaDocumentos,
  crearTemarioLibrillo,
  filtrarBibliotecaDocumentos,
  pdfDisponible,
  seleccionLibrillo,
  tituloDeBiblioteca,
} from './temario-librillo';

function recurso(
  id: number,
  overrides: Partial<DocumentoTemario> = {},
): DocumentoTemario {
  return {
    id,
    identificador: 'Material ' + id,
    fileName: 'material.pdf',
    url: '',
    esPublico: true,
    creadoPorId: 1,
    creadoEn: new Date(0),
    actualizadoEn: new Date(0),
    isNew: false,
    isDownloadable: true,
    ...overrides,
  };
}

describe('Temario del Librillo', () => {
  const pdf = recurso(510);
  const interactivo = recurso(511, {
    librillo: { edicion: 'R07', titulo: 'Edición revisada' },
  });
  const bloqueado = recurso(512, { isDownloadable: false });
  const otroTema = recurso(520);
  const arbol: ModuloTemario[] = [
    {
      id: 80,
      nombre: 'Específico',
      temas: [
        {
          id: 101,
          numero: 1,
          descripcion: 'Reglamento',
          documentos: [bloqueado, pdf, interactivo],
        },
        {
          id: 102,
          numero: 2,
          descripcion: 'Prevención',
          documentos: [otroTema],
        },
        {
          id: 999,
          numero: 3,
          descripcion: 'Anexos del temario',
          documentos: [recurso(900)],
        },
      ],
    },
  ];
  const temas = crearTemarioLibrillo(
    [
      { id: 101, numero: 1, descripcion: 'Reglamento' },
      { id: 102, numero: 2, descripcion: 'Prevención' },
      { id: 103, numero: 3, descripcion: 'Mercancías peligrosas' },
    ],
    arbol,
  );

  it('incluye todos los temas del banco, aunque todavía no tengan documentos', () => {
    expect(temas.map(({ id }) => id)).toEqual([101, 102, 103, 999]);
    expect(
      seleccionLibrillo(temas, convertToParamMap({ tema: '103' })),
    ).toMatchObject({
      tema: { id: 103 },
      documento: undefined,
      temaInaccesible: false,
    });
  });

  it('prefiere una edición interactiva autorizada y permite volver al PDF elegido', () => {
    expect(
      seleccionLibrillo(temas, convertToParamMap({ tema: '101' })).documento,
    ).toBe(interactivo);
    expect(
      seleccionLibrillo(temas, convertToParamMap({ tema: '101', doc: '510' }))
        .documento,
    ).toBe(pdf);
    expect(
      seleccionLibrillo(temas, convertToParamMap({ doc: '512' })).documento,
    ).toBe(bloqueado);
  });

  it('conserva temas del árbol aunque no estén habilitados en el banco de práctica', () => {
    const seleccion = seleccionLibrillo(
      temas,
      convertToParamMap({ doc: '900' }),
    );
    expect(seleccion.tema).toMatchObject({
      id: 999,
      enBanco: false,
      modulo: 'Específico',
    });
    expect(seleccion.documento?.id).toBe(900);
  });

  it('rechaza temas ajenos y documentos que no pertenecen al tema seleccionado', () => {
    expect(
      seleccionLibrillo(temas, convertToParamMap({ tema: '888', doc: '900' })),
    ).toMatchObject({
      temaInaccesible: true,
      documento: undefined,
    });
    expect(
      seleccionLibrillo(temas, convertToParamMap({ tema: '101', doc: '520' })),
    ).toMatchObject({
      documentoInaccesible: true,
      documento: undefined,
    });
  });

  it('distingue PDF de Word y aplica el permiso del árbol', () => {
    expect(
      pdfDisponible(
        recurso(1, { fileName: 'cuaderno.DOCX', url: 'legacy.pdf' }),
      ),
    ).toBe(false);
    expect(
      pdfDisponible(
        recurso(1, { fileName: 'cuaderno.pdf', isDownloadable: false }),
      ),
    ).toBe(false);
    expect(
      pdfDisponible(
        recurso(1, { fileName: null, url: 'legacy.PDF?version=2' }),
      ),
    ).toBe(true);
  });
});

describe('Mis documentos', () => {
  it('prefiere la descripción si el identificador repite el tema y conserva el nombre de los demás', () => {
    const tema = 'Término municipal de VLC';
    const pdf = recurso(21, {
      identificador: '01.5_Ayto. VLC_ TERMINO MUNICIPAL DE VLC',
      descripcion: '01.5_Puentes',
    });
    const otroPdf = recurso(22, {
      identificador: 'Mapa de zonas inundables',
      descripcion: 'Versión ampliada',
    });

    expect(tituloDeBiblioteca(pdf, tema)).toBe('01.5_Puentes');
    expect(tituloDeBiblioteca(otroPdf, tema)).toBe('Mapa de zonas inundables');
  });

  it('indexa documentos del árbol por módulo, tema, título, descripción y nombre de archivo', () => {
    const guia = recurso(21, {
      identificador: 'Tema 4',
      descripcion: 'Guía de actuación',
      fileName: 'incendios-urbanos.DOCX',
      isLocked: true,
    });
    const bloqueado = recurso(23, {
      identificador: 'Otro documento',
      isDownloadable: false,
      isLocked: true,
    });
    const biblioteca = crearBibliotecaDocumentos([
      {
        id: 1,
        nombre: 'Intervención',
        temas: [
          {
            id: 4,
            numero: 4,
            descripcion: 'Evacuación',
            documentos: [guia],
          },
        ],
      },
      {
        id: 2,
        nombre: 'Anexos',
        temas: [{ id: 9, numero: 9, descripcion: '', documentos: [bloqueado] }],
      },
    ]);

    expect(tituloDeBiblioteca(guia)).toBe('Guía de actuación');
    expect(filtrarBibliotecaDocumentos(biblioteca, '', null)).toEqual({
      documentos: [guia, bloqueado],
      disponibles: 1,
      bloqueados: 1,
    });
    expect(
      filtrarBibliotecaDocumentos(
        biblioteca,
        'EVACUACION intervención tema 4 guia DOCX',
        4,
      ).documentos,
    ).toEqual([guia]);
    expect(
      filtrarBibliotecaDocumentos(biblioteca, 'GUIA', 9).documentos,
    ).toEqual([]);
    expect(filtrarBibliotecaDocumentos(biblioteca, 'anexos', null)).toEqual({
      documentos: [bloqueado],
      disponibles: 0,
      bloqueados: 1,
    });
  });
});
