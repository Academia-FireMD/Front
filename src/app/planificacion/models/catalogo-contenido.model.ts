/**
 * Fase 3: catálogo de contenido para rellenar sub-bloques desde códigos
 * tipo T01, L04, I05…
 */

export interface CatalogoContenidoItem {
  id: number;
  codigo: string;
  nombreCorto: string;
  color: string;
}

export type TipoTrabajoCatalogo = 'ESTUDIO' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface ComponerContenidoResponse {
  codigo: string;
  nombre: string;
  color: string;
  comentarios: string;
}

export interface CatalogoContenidoCompleto extends CatalogoContenidoItem {
  nombreDescriptivo?: string | null;
  puntosImportantes?: string | null;
  version: number;
  activa: boolean;
}

export interface CatalogoTrabajo {
  trabajo: TipoTrabajoCatalogo;
  descripcion: string;
  version: number;
}

export interface CatalogoLista {
  filas: CatalogoContenidoCompleto[];
  trabajos: CatalogoTrabajo[];
}

export interface CatalogoFilaEditable {
  codigo: string;
  nombreCorto: string;
  nombreDescriptivo?: string;
  puntosImportantes?: string;
  color: string;
}

export interface CatalogoPreview {
  previewHash: string | null;
  cambios?: Array<{
    codigo: string;
    estado: 'creada' | 'actualizada' | 'sinCambios';
    camposCambiados: string[];
    anterior: CatalogoFilaEditable | null;
    nueva: CatalogoFilaEditable;
  }>;
  cambiosTrabajo?: Array<{
    trabajo: TipoTrabajoCatalogo;
    anterior: string | null;
    nueva: string;
  }>;
  impacto?: {
    usos: number;
    bloques: number;
    plantillas: number;
    borradores: number;
    publicadas: number;
  };
  requiereConfirmacion?: boolean;
  errores?: Array<{ hoja?: string; fila?: number; mensaje: string }>;
  warnings?: Array<{ hoja?: string; fila?: number; mensaje: string }>;
}
