import { NivelOposicion } from '../models/pregunta.model';
import { TipoDePlanificacionDeseada } from '../models/user.model';

export function getNivelOposicionLabel(
  nivel: NivelOposicion | string | null | undefined,
): string {
  if (nivel === NivelOposicion.INICIACION) return 'Iniciación';
  if (nivel === NivelOposicion.AVANZADO) return 'Avanzado';
  return '—';
}

export function getFranjaPlanificacionLabel(
  franja: TipoDePlanificacionDeseada | string | null | undefined,
): string {
  if (franja === TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS) {
    return '4-6 horas';
  }
  if (franja === TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS) {
    return '6-8 horas';
  }
  return '—';
}
