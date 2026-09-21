import { NivelOposicion } from '../models/pregunta.model';
import { TipoDePlanificacionDeseada } from '../models/user.model';
import {
  getFranjaPlanificacionLabel,
  getNivelOposicionLabel,
} from './planificacion-labels.util';

describe('planificacion-labels', () => {
  it('presenta los niveles con etiquetas humanas', () => {
    expect(getNivelOposicionLabel(NivelOposicion.INICIACION)).toBe(
      'Iniciación',
    );
    expect(getNivelOposicionLabel(NivelOposicion.AVANZADO)).toBe('Avanzado');
    expect(getNivelOposicionLabel('DESCONOCIDO')).toBe('—');
  });

  it('presenta las franjas sin exponer el valor técnico', () => {
    expect(
      getFranjaPlanificacionLabel(
        TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
      ),
    ).toBe('4-6 horas');
    expect(
      getFranjaPlanificacionLabel(
        TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
      ),
    ).toBe('6-8 horas');
    expect(getFranjaPlanificacionLabel(null)).toBe('—');
  });
});
