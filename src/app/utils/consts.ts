import { Comunidad } from '../shared/models/pregunta.model';
import { Oposicion } from '../shared/models/subscription.model';

// Mapping para Comunidades geográficas (perfil de usuario)
export const comunidades: Record<Comunidad, { image: string; name: string }> = {
  [Comunidad.MADRID]: {
    image: 'comunidades/MADRID.png',
    name: 'Madrid',
  },
  [Comunidad.VALENCIA]: {
    image: 'comunidades/VALENCIA.png',
    name: 'Valencia',
  },
  [Comunidad.MURCIA]: {
    image: 'comunidades/MURCIA.png',
    name: 'Murcia',
  },
  [Comunidad.CANARIAS]: {
    image: 'comunidades/CANARIAS.png',
    name: 'Canarias',
  },
  [Comunidad.CEUTA]: {
    image: 'comunidades/CEUTA.png',
    name: 'Ceuta',
  },
  [Comunidad.MELILLA]: {
    image: 'comunidades/MELILLA.png',
    name: 'Melilla',
  },
  [Comunidad.GALICIA]: {
    image: 'comunidades/GALICIA.png',
    name: 'Galicia',
  },
  [Comunidad.ASTURIAS]: {
    image: 'comunidades/ASTURIAS.png',
    name: 'Asturias',
  },
  [Comunidad.VASCO]: {
    image: 'comunidades/VASCO.png',
    name: 'País Vasco',
  },
  [Comunidad.NAVARRA]: {
    image: 'comunidades/NAVARRA.png',
    name: 'Navarra',
  },
  [Comunidad.BALEARES]: {
    image: 'comunidades/BALEARES.png',
    name: 'Baleares',
  },
  [Comunidad.ANDALUCIA]: {
    image: 'comunidades/ANDALUCIA.png',
    name: 'Andalucía',
  },
  [Comunidad.ARAGON]: {
    image: 'comunidades/ARAGON.png',
    name: 'Aragón',
  },
  [Comunidad.CASTILLALAMANCHA]: {
    image: 'comunidades/CASTILLALAMANCHA.png',
    name: 'Castilla-La Mancha',
  },
  [Comunidad.CASTILLAYLEON]: {
    image: 'comunidades/CASTILLAYLEON.png',
    name: 'Castilla y León',
  },
  [Comunidad.CATALUNYA]: {
    image: 'comunidades/CATALUNYA.png',
    name: 'Cataluña',
  },
  [Comunidad.EXTREMADURA]: {
    image: 'comunidades/EXTREMADURA.png',
    name: 'Extremadura',
  },
};

// Mapping para Oposiciones (suscripciones y contenido)
export const oposiciones: Record<
  Oposicion,
  { icon: string; name: string; image: string | null }
> = {
  [Oposicion.GENERAL]: {
    icon: '🔥',
    name: 'Todas las oposiciones (incluye Madrid)',
    image: null,
  },
  [Oposicion.VALENCIA_AYUNTAMIENTO]: {
    icon: '🏛️',
    name: 'Valencia Ayuntamiento',
    image: 'oposiciones/valencia.png',
  },
  [Oposicion.ALICANTE_CPBA]: {
    icon: '🏢',
    name: 'CPBA Alicante',
    image: 'oposiciones/alicante.png',
  },
  [Oposicion.MADRID]: {
    icon: '🏙️',
    name: 'Madrid',
    image: 'oposiciones/madrid.png',
  },
};

/**
 * Grupo de oposiciones = azúcar de UI para poder marcar de una sola vez un conjunto
 * de oposiciones reales (p.ej. "toda la Comunidad Valenciana" = Valencia + Alicante).
 *
 * IMPORTANTE: `code` es un marcador SINTÉTICO, NUNCA se persiste ni es un valor del enum
 * `Oposicion`. El picker siempre emite/guarda `members` (valores reales del enum).
 * La estructura es una lista para poder añadir futuras comunidades sin tocar el componente.
 */
export interface GrupoOposicion {
  /** Marcador sintético (no es un valor de enum, nunca se guarda). */
  code: string;
  name: string;
  icon: string;
  image: string | null;
  /** Oposiciones reales que representa este grupo. */
  members: Oposicion[];
}

export const GRUPO_COMUNIDAD_VALENCIANA: GrupoOposicion = {
  code: '__GRUPO_COMUNIDAD_VALENCIANA__',
  name: 'Comunidad Valenciana',
  icon: '🟠', // fallback si no cargara la imagen
  image: 'comunidades/VALENCIA.png', // Senyera de la Comunidad Valenciana
  members: [Oposicion.VALENCIA_AYUNTAMIENTO, Oposicion.ALICANTE_CPBA],
};

/** Grupos agrupadores disponibles en el selector de oposiciones (extensible). */
export const gruposOposicion: GrupoOposicion[] = [GRUPO_COMUNIDAD_VALENCIANA];

/** Item de display ya colapsado (una oposición individual o un grupo agrupador). */
export interface OposicionColapsada {
  code: string;
  label: string;
  icon: string;
  image: string | null;
  /** Presente solo si es un grupo agrupador (p.ej. Comunidad Valenciana). */
  members?: Oposicion[];
}

function mismoConjuntoOposiciones(a: Oposicion[], b: Oposicion[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

/**
 * Colapsa una lista de oposiciones reales a items de display, con la MISMA regla
 * que usa el badge del picker (fuente única, para que no diverja entre el picker
 * y las tarjetas/overviews): si el conjunto coincide EXACTAMENTE con un grupo
 * agrupador (p.ej. Valencia + Alicante), se muestra el grupo como un solo item
 * ("Comunidad Valenciana"); si no, se muestran las oposiciones individuales.
 * @param opts.excluirGeneral si true, quita GENERAL de la lista antes de colapsar.
 */
export function colapsarOposiciones(
  ops: Oposicion[],
  opts: { excluirGeneral?: boolean } = {},
): OposicionColapsada[] {
  const lista = opts.excluirGeneral
    ? (ops ?? []).filter((o) => o !== Oposicion.GENERAL)
    : ops ?? [];
  const grupo = gruposOposicion.find((g) =>
    mismoConjuntoOposiciones(g.members, lista),
  );
  if (grupo) {
    return [
      {
        code: grupo.code,
        label: grupo.name,
        icon: grupo.icon,
        image: grupo.image,
        members: grupo.members,
      },
    ];
  }
  return lista.map((o) => ({
    code: o,
    label: oposiciones[o]?.name ?? o,
    icon: oposiciones[o]?.icon ?? '📋',
    image: oposiciones[o]?.image ?? null,
  }));
}

/**
 * Nodo del árbol del selector de oposiciones.
 * `nivel`: 0 = raíz (comodín GENERAL), 1 = comunidad, 2 = provincia.
 * `tipo`: WILDCARD (GENERAL, exclusivo, "todas"), GRUPO (agrupadora con members),
 * OPOSICION (valor real del enum, hoja).
 */
export interface NodoOposicion {
  code: string;
  label: string;
  icon: string;
  image: string | null;
  nivel: 0 | 1 | 2;
  tipo: 'WILDCARD' | 'GRUPO' | 'OPOSICION';
  members?: Oposicion[];
}

/** Marcador del comodín "todas las oposiciones" (valor real del enum). */
export const OPOSICION_WILDCARD = Oposicion.GENERAL;

/**
 * Árbol de oposiciones del selector (dos niveles bajo el comodín GENERAL):
 *   Todas las oposiciones (GENERAL)   ← raíz/comodín, exclusivo
 *     Comunidad de Madrid             ← comunidad sin provincias (hoja)
 *     Comunidad Valenciana            ← comunidad (grupo)
 *       Valencia Ayuntamiento         ← provincia
 *       CPBA Alicante                 ← provincia
 * El orden de este array ES el orden en que se pintan las filas.
 */
export const ARBOL_OPOSICIONES: NodoOposicion[] = [
  {
    code: OPOSICION_WILDCARD,
    label: 'Todas las oposiciones',
    icon: oposiciones[Oposicion.GENERAL].icon,
    image: null,
    nivel: 0,
    tipo: 'WILDCARD',
  },
  {
    code: Oposicion.MADRID,
    label: 'Comunidad de Madrid',
    icon: oposiciones[Oposicion.MADRID].icon,
    image: oposiciones[Oposicion.MADRID].image,
    nivel: 1,
    tipo: 'OPOSICION',
  },
  {
    code: GRUPO_COMUNIDAD_VALENCIANA.code,
    label: GRUPO_COMUNIDAD_VALENCIANA.name,
    icon: GRUPO_COMUNIDAD_VALENCIANA.icon,
    image: GRUPO_COMUNIDAD_VALENCIANA.image,
    nivel: 1,
    tipo: 'GRUPO',
    members: GRUPO_COMUNIDAD_VALENCIANA.members,
  },
  {
    code: Oposicion.VALENCIA_AYUNTAMIENTO,
    label: oposiciones[Oposicion.VALENCIA_AYUNTAMIENTO].name,
    icon: oposiciones[Oposicion.VALENCIA_AYUNTAMIENTO].icon,
    image: oposiciones[Oposicion.VALENCIA_AYUNTAMIENTO].image,
    nivel: 2,
    tipo: 'OPOSICION',
  },
  {
    code: Oposicion.ALICANTE_CPBA,
    label: oposiciones[Oposicion.ALICANTE_CPBA].name,
    icon: oposiciones[Oposicion.ALICANTE_CPBA].icon,
    image: oposiciones[Oposicion.ALICANTE_CPBA].image,
    nivel: 2,
    tipo: 'OPOSICION',
  },
];

export const provinciasEspanolas = [
  { name: 'Álava', code: 'VI' },
  { name: 'Albacete', code: 'AB' },
  { name: 'Alicante', code: 'A' },
  { name: 'Almería', code: 'AL' },
  { name: 'Asturias', code: 'O' },
  { name: 'Ávila', code: 'AV' },
  { name: 'Badajoz', code: 'BA' },
  { name: 'Barcelona', code: 'B' },
  { name: 'Burgos', code: 'BU' },
  { name: 'Cáceres', code: 'CC' },
  { name: 'Cádiz', code: 'CA' },
  { name: 'Cantabria', code: 'S' },
  { name: 'Castellón', code: 'CS' },
  { name: 'Ciudad Real', code: 'CR' },
  { name: 'Córdoba', code: 'CO' },
  { name: 'Cuenca', code: 'CU' },
  { name: 'Girona', code: 'GI' },
  { name: 'Granada', code: 'GR' },
  { name: 'Guadalajara', code: 'GU' },
  { name: 'Guipúzcoa', code: 'SS' },
  { name: 'Huelva', code: 'H' },
  { name: 'Huesca', code: 'HU' },
  { name: 'Islas Baleares', code: 'PM' },
  { name: 'Jaén', code: 'J' },
  { name: 'La Coruña', code: 'C' },
  { name: 'La Rioja', code: 'LO' },
  { name: 'Las Palmas', code: 'GC' },
  { name: 'León', code: 'LE' },
  { name: 'Lleida', code: 'L' },
  { name: 'Lugo', code: 'LU' },
  { name: 'Madrid', code: 'M' },
  { name: 'Málaga', code: 'MA' },
  { name: 'Murcia', code: 'MU' },
  { name: 'Navarra', code: 'NA' },
  { name: 'Ourense', code: 'OR' },
  { name: 'Palencia', code: 'P' },
  { name: 'Pontevedra', code: 'PO' },
  { name: 'Salamanca', code: 'SA' },
  { name: 'Santa Cruz de Tenerife', code: 'TF' },
  { name: 'Segovia', code: 'SG' },
  { name: 'Sevilla', code: 'SE' },
  { name: 'Soria', code: 'SO' },
  { name: 'Tarragona', code: 'T' },
  { name: 'Teruel', code: 'TE' },
  { name: 'Toledo', code: 'TO' },
  { name: 'Valencia', code: 'V' },
  { name: 'Valladolid', code: 'VA' },
  { name: 'Vizcaya', code: 'BI' },
  { name: 'Zamora', code: 'ZA' },
  { name: 'Zaragoza', code: 'Z' },
];

export const paises = [{ name: 'España', code: 'ES' }];
