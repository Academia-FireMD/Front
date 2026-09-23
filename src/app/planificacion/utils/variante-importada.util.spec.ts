import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import {
  codigoPlantillaImportada,
  etiquetaVarianteImportada,
  identidadVarianteImportada,
} from './variante-importada.util';

describe('variante importada', () => {
  it('muestra el nombre de negocio y conserva el código técnico de la hoja', () => {
    expect(codigoPlantillaImportada('cai6-8')).toBe('CBAI6-8H');
    expect(etiquetaVarianteImportada('cai6-8')).toBe(
      'Consorcio de Alicante · Iniciación · 6-8 horas',
    );
    expect(identidadVarianteImportada('CMI4-6H')).toMatchObject({
      oposicion: Oposicion.MADRID,
      franja: TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    });
  });

  it('no presenta un código desconocido como si fuera una variante válida', () => {
    expect(identidadVarianteImportada('XYZ')).toBeNull();
    expect(etiquetaVarianteImportada('XYZ')).toBe('Variante sin identificar');
  });
});
