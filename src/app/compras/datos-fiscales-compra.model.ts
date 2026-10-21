export const COMPRA_DATOS_FISCALES_ENDPOINT = '/compras/datos-fiscales';

export type CampoFiscalCompra =
  | 'nombre'
  | 'apellidos'
  | 'empresa'
  | 'direccion'
  | 'direccion2'
  | 'poblacion'
  | 'provincia'
  | 'codigoPostal'
  | 'pais'
  | 'nif';

export interface DatosFiscalesCompra {
  nombre: string;
  apellidos: string;
  empresa: string;
  direccion: string;
  direccion2: string;
  poblacion: string;
  provincia: string;
  codigoPostal: string;
  pais: string;
  nif: string;
}

export interface EstadoDatosFiscalesCompra {
  datos: DatosFiscalesCompra;
  faltantes: CampoFiscalCompra[];
  invalidos: CampoFiscalCompra[];
  conflictos: CampoFiscalCompra[];
  completo: boolean;
  version: string;
  /** La sincronización de la ficha todavía está en curso en el servidor. */
  fiscalSyncPending?: boolean;
  /** Cuenta local sin cliente Woo vinculado: completar la compra en el checkout. */
  requiereCheckout?: boolean;
}

export interface RequisitoDatosFiscalesCompra {
  success: false;
  requiereDatosFiscales: true;
  codigo: 'DATOS_FISCALES_INCOMPLETOS' | 'DATOS_FISCALES_CONFLICTIVOS';
  mensaje: string;
}

export const CAMPOS_FISCALES_COMPRA: ReadonlyArray<{
  campo: CampoFiscalCompra;
  etiqueta: string;
  obligatorio: boolean;
}> = [
  { campo: 'nombre', etiqueta: 'Nombre', obligatorio: false },
  { campo: 'apellidos', etiqueta: 'Apellidos', obligatorio: false },
  { campo: 'empresa', etiqueta: 'Empresa o razón social', obligatorio: false },
  { campo: 'direccion', etiqueta: 'Dirección', obligatorio: true },
  { campo: 'direccion2', etiqueta: 'Dirección (línea 2)', obligatorio: false },
  { campo: 'poblacion', etiqueta: 'Población', obligatorio: true },
  { campo: 'provincia', etiqueta: 'Provincia', obligatorio: false },
  { campo: 'codigoPostal', etiqueta: 'Código postal', obligatorio: true },
  { campo: 'pais', etiqueta: 'País', obligatorio: true },
  { campo: 'nif', etiqueta: 'NIF / CIF', obligatorio: true },
];

export const CAMPOS_FISCALES_COMPRA_VALIDOS: ReadonlySet<string> = new Set(
  CAMPOS_FISCALES_COMPRA.map(({ campo }) => campo),
);
