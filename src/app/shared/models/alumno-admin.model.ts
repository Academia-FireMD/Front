import { AccesoConCurso } from '../../cursos/models/curso.model';
import { Usuario } from './user.model';
export type UsuarioVistaAlumno = Omit<Usuario, 'contrasenya'> & {
  tutor?: { id: number; nombre: string; apellidos: string } | null;
};
export interface GestionAlumno {
  tipo: 'EXTERNA' | 'WOOCOMMERCE' | 'MIXTA' | 'POR_VERIFICAR';
  comprobadaEn: string | null;
  motivo: string | null;
  capacidades: {
    puedeDarBajaExterna: boolean;
    puedeEliminar: boolean;
    puedeGestionarWoo: boolean;
    suscripcionesExternas: number[];
  };
}
export interface FichaAlumno {
  accionesPlanificacion?: { puedeDesvincular: boolean };
  usuario: UsuarioVistaAlumno;
  gestion: GestionAlumno;
  cursos: AccesoConCurso[];
  resumenEliminacion: {
    suscripciones: number;
    consumibles: number;
    cursos: number;
    progresos: number;
    invitaciones: number;
    reservas?: number;
    creditos?: number;
    comprasTutoria?: number;
  };
  consultadoEn: string;
}
export interface ActividadAlumno {
  id: string;
  tipo: string;
  estado: string;
  actorId: number | null;
  descripcion: string;
  createdAt: string;
}
export interface PaginaActividadAlumno {
  items: ActividadAlumno[];
  total: number;
  page: number;
  take: number;
}
export type EstadoOperacionAlumno =
  | 'EN_CURSO'
  | 'COMPLETADA'
  | 'RECHAZADA'
  | 'INCIERTA';
export interface OperacionAlumno {
  id: string;
  tipo: string;
  estado: EstadoOperacionAlumno;
  usuarioId: number;
  suscripcionId?: string;
  pedidoId?: string;
  sincronizacionPendiente?: boolean;
  createdAt: string;
  updatedAt: string;
  mensaje?: string;
  avisoEstado?: import('./alumno-externo.model').EstadoAviso;
  resultado?: { mensaje?: string; usuario?: { id: number }; caducaEn?: string };
}
export interface RenovacionAlumno {
  id: number;
  status: string;
  pagado?: boolean;
  importeCentimos?: number;
  moneda?: string;
  tarjeta?: string | null;
  puedeReintentar: boolean;
  motivo?: string | null;
}
export interface SuscripcionWooAlumno {
  id: number;
  status: string;
  fechaSiguientePago: string | null;
  fechaFin: string | null;
  metodo: string;
  discrepancia: boolean;
  puedeCancelarAhora: boolean;
  puedeCancelarFinPeriodo: boolean;
  locales: {
    id: number;
    status: string;
    fechaFin: string | null;
    tipo: string;
    oposicion: string;
  }[];
  renovaciones: RenovacionAlumno[];
}
export interface WooAlumno {
  customerId: number;
  consultadoEn: string;
  suscripciones: SuscripcionWooAlumno[];
  operaciones: OperacionAlumno[];
}
