import type {
  IncidenciaImportacionPlantilla,
  PreviewCargaSemanas,
  ResultadoPublicacionSemanas,
} from './autoasignacion.model';

describe('contratos de importación de semanas', () => {
  it('mantiene celdas opcionales en incidencias y warnings opcionales en la preview', () => {
    const errorConCeldas: IncidenciaImportacionPlantilla = {
      hoja: 'CMI6-8',
      semana: 40,
      filaExcel: 12,
      celdas: ['A12', 'B12'],
      mensaje: 'La fecha no es válida.',
    };
    const errorAntiguo: IncidenciaImportacionPlantilla = {
      hoja: 'CMI6-8',
      semana: 40,
      filaExcel: 13,
      mensaje: 'La fecha no es válida.',
    };
    const preview: PreviewCargaSemanas = {
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [],
      warnings: [
        {
          hoja: 'CMI6-8',
          semana: 40,
          mensaje: 'Metadatos copiados de la pestaña.',
        },
      ],
    };
    const previewSinAvisos: PreviewCargaSemanas = {
      puedeAplicar: true,
      previewHash: 'a'.repeat(64),
      variantes: [],
    };

    expect(errorConCeldas.celdas).toEqual(['A12', 'B12']);
    expect(errorAntiguo.celdas).toBeUndefined();
    expect(preview.warnings?.[0].mensaje).toBe(
      'Metadatos copiados de la pestaña.',
    );
    expect(previewSinAvisos.warnings).toBeUndefined();
  });

  it('tipa la publicación con semana y semanas[] sin reutilizar numero de la preview', () => {
    const resultado: ResultadoPublicacionSemanas = {
      cargaId: 9,
      estado: 'PUBLICADA',
      variantes: [{ codigo: 'PCMI6-8H', planificacionId: 207 }],
      semanas: [
        {
          codigo: 'PCMI6-8H',
          hoja: 'CMI6-8',
          semana: 40,
          lunes: '2026-10-05',
          creados: 0,
          actualizados: 0,
          omitidos: 168,
          eliminados: 0,
          bloques: [],
        },
      ],
      warnings: [
        { hoja: 'CMI6-8', semana: 40, mensaje: 'Aviso de metadatos.' },
      ],
      mensaje: 'Publicada',
    };

    expect(resultado.semanas[0].semana).toBe(40);
    expect(resultado.semanas[0].omitidos).toBe(168);
    expect(resultado.warnings).toHaveLength(1);
  });
});
