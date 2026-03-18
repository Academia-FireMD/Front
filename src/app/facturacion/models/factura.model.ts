export type FacturaTipo = 'NORMAL' | 'RECTIFICATIVA';
export type FacturaEstado = 'PENDIENTE' | 'EMITIDA' | 'ANULADA' | 'ERROR';

export interface Factura {
  id: number;
  contasimpleId?: string;
  numero?: string;
  serie?: string;
  tipo: FacturaTipo;
  estado: FacturaEstado;
  usuarioId?: number;
  usuario?: { id: number; nombre: string; apellidos: string; email: string };
  woocommerceOrderId?: string;
  facturaRectificadaId?: number;
  facturaRectificada?: { id: number; numero: string };
  clienteNombre?: string;
  clienteEmail?: string;
  clienteNif?: string;
  clienteDireccion?: string;
  clientePoblacion?: string;
  clienteCodigoPostal?: string;
  clientePais?: string;
  concepto?: string;
  baseImponible: number;
  tipoIva: number;
  cuotaIva: number;
  total: number;
  pdfUrl?: string;
  errorMessage?: string;
  dryRun: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FacturasResponse {
  facturas: Factura[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
}

export interface CrearFacturaManualDto {
  clienteNombre: string;
  clienteEmail?: string;
  clienteNif?: string;
  clienteDireccion?: string;
  clientePoblacion?: string;
  clienteCodigoPostal?: string;
  clientePais?: string;
  concepto: string;
  baseImponible: number;
  tipoIva?: number;
  usuarioId?: number;
  serie?: string;
}

export interface CrearRectificativaDto {
  motivo: string;
}

export interface ListarFacturasParams {
  pagina?: number;
  porPagina?: number;
  desde?: string;
  hasta?: string;
  tipo?: FacturaTipo;
  estado?: FacturaEstado;
  usuarioId?: number;
}
