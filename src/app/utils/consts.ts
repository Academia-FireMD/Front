import { Comunidad } from "../shared/models/pregunta.model";
import { Oposicion } from "../shared/models/subscription.model";

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
export const oposiciones: Record<Oposicion, { icon: string; name: string; image: string }> = {
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
};

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
  { name: 'Zaragoza', code: 'Z' }
];

export const paises = [
  { name: 'España', code: 'ES' },
]
