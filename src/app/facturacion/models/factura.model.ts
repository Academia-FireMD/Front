export type FacturaTipo = 'NORMAL' | 'RECTIFICATIVA';
export type FacturaEstado =
  | 'PENDIENTE'
  | 'EMITIDA'
  | 'ANULADA'
  | 'ELIMINADA_LOCAL'
  | 'OMITIDA_PRUEBA'
  | 'ERROR';
export type OrigenAnulacion = 'LOCAL' | 'CONTASIMPLE';

export type EstadoTrabajoFiscal =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'REINTENTO'
  | 'REVISION'
  | 'COMPLETADO';

export interface TrabajoFiscal {
  estado: EstadoTrabajoFiscal;
  intentos: number;
  proximoIntento: string | null;
  ultimoError: string | null;
}

export interface MotivoRevisionFiscal {
  codigo: string;
  campos?: string[];
}

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
  clienteProvincia?: string;
  clienteCodigoPostal?: string;
  clientePais?: string;
  concepto?: string;
  baseImponible: number;
  tipoIva: number;
  cuotaIva: number;
  total: number;
  pdfUrl?: string;
  errorMessage?: string;
  motivoOmision?: string;
  dryRun: boolean;
  origenAnulacion?: OrigenAnulacion;
  fechaAnulacion?: string;
  requiereRevisionFiscal: boolean;
  motivosRevisionFiscal?: MotivoRevisionFiscal[];
  /** Extensión opcional del backend para el plan de sincronización fiscal. */
  trabajoFiscal?: TrabajoFiscal;
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
  clienteNif: string;
  clienteDireccion: string;
  clientePoblacion: string;
  clienteProvincia: string;
  clienteCodigoPostal: string;
  clientePais: string;
  concepto: string;
  baseImponible: number;
  tipoIva?: number;
  usuarioId?: number;
  serie?: string;
}

export interface CompletarFiscalDto {
  clienteNif: string;
  clienteNombre?: string;
  clienteDireccion?: string;
  clientePoblacion?: string;
  clienteProvincia?: string;
  clienteCodigoPostal?: string;
  clientePais?: string;
}

export interface CrearRectificativaDto {
  motivo: string;
}

export interface CrearDevolucionDto {
  importeTotal: number;
  motivo: string;
  idempotencyKey: string;
}

export type DevolucionEstado =
  | 'PENDING'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'RECTIFYING'
  | 'COMPLETED'
  | 'NEEDS_REVIEW'
  | 'FAILED';

export interface DevolucionOperacion {
  id: number;
  estado: DevolucionEstado;
  importeTotal: number;
  baseImponible: number;
  cuotaIva: number;
  tipoIva: number;
  wooRefundId?: string | null;
  rectificativaId?: number | null;
  rectificativaNumero?: string | null;
  contasimpleId?: string | null;
  ultimoError?: string | null;
}

export interface ReconciliacionResult {
  logId: number;
  totalRevisadas: number;
  anuladas: number;
  renumeradas: number;
  errores: number;
  estado: 'OK' | 'ABORTED' | 'ERROR';
  duracionMs: number;
  lockSkipped?: boolean;
}

export interface EliminarFacturaResult {
  id: number;
  remoteStatus: 'deleted' | 'not_found' | 'skipped';
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

// ─────────────────────────────────────────────────────────────
// Sincronización fiscal WooCommerce ↔ ContaSimple
// ─────────────────────────────────────────────────────────────

export type EstadoSincronizacionCliente =
  | 'SIN_CAMBIOS'
  | 'SINCRONIZABLE'
  | 'REVISION'
  | 'NO_DISPONIBLE';

export type EstadoSincronizacionFactura =
  | 'ELEGIBLE'
  | 'YA_EMITIDA'
  | 'REVISION'
  | 'FUERA_PERIODO'
  | 'NO_FACTURABLE'
  | 'ESPERA_PROVEEDOR';

export type OrigenDatoFiscal = 'PLATAFORMA' | 'WOOCOMMERCE' | 'CONTASIMPLE';

export interface CambioFiscal {
  campo: string;
  origen: OrigenDatoFiscal;
  destino: OrigenDatoFiscal;
  valorActual: string | null;
  valorPropuesto: string;
}

export interface SincronizacionFiscalCliente {
  usuarioId: number;
  wooCustomerId: number | null;
  estado: EstadoSincronizacionCliente;
  faltantes: string[];
  conflictos: string[];
  cambios: CambioFiscal[];
}

export interface SincronizacionFiscalFactura {
  id: number;
  woocommerceOrderId: string | null;
  total: number;
  estado: EstadoSincronizacionFactura;
  motivos: string[];
}

export interface SincronizacionFiscalTotales {
  clientes: number;
  facturasElegibles: number;
  importeElegible: number;
  revisionManual: number;
}

export interface SincronizacionFiscalAutomatismos {
  sincronizacionHabilitada: boolean;
  recuperacionHabilitada: boolean;
}

export interface SincronizacionFiscalPreviewRequest {
  usuarioIds?: number[];
  facturaIds?: number[];
}

export interface SincronizacionFiscalPreview {
  version: string;
  usuarioIds: number[];
  facturaIds: number[];
  automatismos: SincronizacionFiscalAutomatismos;
  clientes: SincronizacionFiscalCliente[];
  facturas: SincronizacionFiscalFactura[];
  totales: SincronizacionFiscalTotales;
}

export interface AplicarSincronizacionFiscalRequest {
  version: string;
  usuarioIds: number[];
  facturaIds: number[];
  recuperarFacturas: boolean;
}

export interface EncoladoFiscalResponse {
  trabajosEncolados: number;
  ids: string[];
  procesamientoPausado: boolean;
}

export type AplicarSincronizacionFiscalResponse = EncoladoFiscalResponse;
export type ReprocesarFacturaFiscalResponse = EncoladoFiscalResponse;
