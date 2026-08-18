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
