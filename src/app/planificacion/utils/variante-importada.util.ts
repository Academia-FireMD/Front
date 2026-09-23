import { NivelOposicion } from '../../shared/models/pregunta.model';
import {
  getPlanificacionOposicionLabel,
  Oposicion,
} from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import {
  getFranjaPlanificacionLabel,
  getNivelOposicionLabel,
} from '../../shared/utils/planificacion-labels.util';

export interface IdentidadVarianteImportada {
  oposicion: Oposicion;
  nivel: NivelOposicion;
  franja: TipoDePlanificacionDeseada;
}

const IDENTIDADES_HOJA: Record<
  string,
  Pick<IdentidadVarianteImportada, 'oposicion' | 'nivel'>
> = {
  GI: { oposicion: Oposicion.GENERAL, nivel: NivelOposicion.INICIACION },
  GA: { oposicion: Oposicion.GENERAL, nivel: NivelOposicion.AVANZADO },
  CBAI: {
    oposicion: Oposicion.ALICANTE_CPBA,
    nivel: NivelOposicion.INICIACION,
  },
  CBAA: { oposicion: Oposicion.ALICANTE_CPBA, nivel: NivelOposicion.AVANZADO },
  AYVI: {
    oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
    nivel: NivelOposicion.INICIACION,
  },
  AYVA: {
    oposicion: Oposicion.VALENCIA_AYUNTAMIENTO,
    nivel: NivelOposicion.AVANZADO,
  },
  CMI: { oposicion: Oposicion.MADRID, nivel: NivelOposicion.INICIACION },
  CMA: { oposicion: Oposicion.MADRID, nivel: NivelOposicion.AVANZADO },
};

/** Normaliza los alias históricos sin alterar el código que identifica la hoja. */
export function codigoPlantillaImportada(
  codigoHoja: string | null | undefined,
): string {
  const codigo = codigoHoja?.trim().toUpperCase().replace(/\s+/g, '') ?? '';
  if (/^H(?:4-6|6-8)H?$/.test(codigo)) return codigo;
  const coincidencia = codigo.match(/^([A-Z]+)(4-6|6-8)H?$/);
  if (!coincidencia) return codigo;
  const alias: Record<string, string> = {
    CAI: 'CBAI',
    CAA: 'CBAA',
    AVI: 'AYVI',
    AVA: 'AYVA',
  };
  return `${alias[coincidencia[1]] ?? coincidencia[1]}${coincidencia[2]}H`;
}

export function identidadVarianteImportada(
  codigoHoja: string | null | undefined,
): IdentidadVarianteImportada | null {
  const coincidencia =
    codigoPlantillaImportada(codigoHoja).match(/^([A-Z]+)(4-6|6-8)H$/);
  if (!coincidencia) return null;
  const base = IDENTIDADES_HOJA[coincidencia[1]];
  if (!base) return null;
  return {
    ...base,
    franja:
      coincidencia[2] === '4-6'
        ? TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS
        : TipoDePlanificacionDeseada.FRANJA_SEIS_A_OCHO_HORAS,
  };
}

export function etiquetaVarianteImportada(
  codigoHoja: string,
  identidad = identidadVarianteImportada(codigoHoja),
): string {
  if (!identidad) return 'Variante sin identificar';
  return [
    getPlanificacionOposicionLabel(identidad.oposicion),
    getNivelOposicionLabel(identidad.nivel),
    getFranjaPlanificacionLabel(identidad.franja),
  ].join(' · ');
}
