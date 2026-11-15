import { GestionAlumno } from './alumno-admin.model';
import { Suscripcion } from './subscription.model';

export type EstadoAviso =
  | 'NO_SOLICITADO'
  | 'PENDIENTE'
  | 'ENVIANDO'
  | 'ACEPTADO_POR_PROVEEDOR'
  | 'FALLIDO'
  | 'INCIERTO';
export interface ResultadoManual {
  usuarioId: number;
  operacionId: string;
  mensaje?: string;
  replay?: boolean;
  sinCambios?: boolean;
  eliminado?: boolean;
  enlaceAcceso?: string;
  caducaEn?: string;
  avisoEstado: EstadoAviso;
  suscripcion?: Suscripcion;
}
export interface CapacidadesRecurso {
  editar: boolean;
  retirar: boolean;
  motivo: string | null;
}
export interface CursoAdministrable {
  id: number | null;
  cursoId: number;
  version: number;
  curso: { id: number; titulo: string; estado: string };
  expiraEn: string | null;
  manualExpiraEn: string | null;
  manualConcedido: boolean;
  origenes: string[];
  efectivo: boolean;
  capacidades: CapacidadesRecurso;
}
export interface SimulacroAdministrable {
  id: number;
  version: number;
  examenId: number | null;
  examen: { id: number; titulo: string } | null;
  origen: string;
  estadoEfectivo: string;
  expiraEn: string | null;
  efectivo: boolean;
  capacidades: CapacidadesRecurso;
}
export interface CreditoAdministrable {
  id: number;
  version: number;
  origen: string;
  estadoEfectivo: string;
  validoDesde: string;
  validoHasta: string;
  disponible: boolean;
  reservaId: number | null;
  capacidades: CapacidadesRecurso;
}
export interface InvitacionAdministrable {
  id: number;
  titulo: string;
  visibleA: string;
  fechaSesion: string;
  invitado: boolean;
  efectivo: boolean;
  origen: string;
  capacidades: CapacidadesRecurso;
}
export interface ReservaAdministrable {
  id: number;
  estado: string;
  horarioDisponibleId: number;
  horarioDisponible: {
    id: number;
    horaInicio: string;
    horaFin: string;
    tipo: string;
    admin: { nombre: string; apellidos: string };
  };
  creditoTutoria: { id: number } | null;
  comprasTutoria: { id: number; estado: string }[];
  capacidades: { gestionar: boolean; motivo: string | null };
}
export interface InventarioExterno {
  usuarioId: number;
  gestion: GestionAlumno;
  capacidades: {
    crearPlan: boolean;
    habilitarLocal: boolean;
    enlaceLocal: boolean;
    curso: boolean;
    simulacro: boolean;
    invitacion: boolean;
    credito: boolean;
    reserva: boolean;
    motivo: string | null;
  };
  cursos: CursoAdministrable[];
  simulacros: SimulacroAdministrable[];
  tutorias: {
    invitaciones: InvitacionAdministrable[];
    creditos: CreditoAdministrable[];
    reservas: ReservaAdministrable[];
    compras: { id: number; estado: string; reservaId: number | null }[];
  };
}
export interface ItemCatalogoExterno {
  id: number;
  titulo: string;
  asignable: boolean;
  comprable: boolean;
  motivo?: string;
  tipo?: 'GENERAL' | 'TUTORIA_MADRID';
  horaInicio?: string;
  horaFin?: string;
  plazasDisponibles?: number;
}
export interface CatalogoExterno {
  items: ItemCatalogoExterno[];
  total: number;
  skip: number;
  take: number;
}
export function mensajeErrorManual(error: any): string {
  const mensaje = error?.error?.message ?? error?.message;
  return Array.isArray(mensaje)
    ? mensaje.join('. ')
    : mensaje || 'No se pudo completar la operación. Actualiza la ficha.';
}
export function etiquetaAviso(estado: EstadoAviso): string {
  return {
    NO_SOLICITADO: 'Sin aviso solicitado',
    PENDIENTE: 'Aviso pendiente',
    ENVIANDO: 'Aviso en curso',
    ACEPTADO_POR_PROVEEDOR: 'Aviso aceptado por el proveedor',
    FALLIDO: 'No se pudo enviar el aviso',
    INCIERTO: 'Aviso pendiente de verificar; pudo haber sido aceptado',
  }[estado];
}
