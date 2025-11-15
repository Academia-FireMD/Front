export enum EstadoHorario {
  ACTIVO = 'ACTIVO',
  CANCELADO = 'CANCELADO',
  COMPLETADO = 'COMPLETADO'
}

export enum EstadoReserva {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  CANCELADA = 'CANCELADA',
  COMPLETADA = 'COMPLETADA',
  AUSENTE = 'AUSENTE'
}

export interface Usuario {
  id: number;
  nombre: string;
  apellidos: string;
  email: string;
}

export interface HorarioDisponible {
  id: number;
  adminId: number;
  admin?: Usuario;
  fecha: Date;
  horaInicio: Date;
  horaFin: Date;
  capacidad: number;
  estado: EstadoHorario;
  descripcion?: string;
  reservas?: Reserva[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Reserva {
  id: number;
  alumnoId: number;
  alumno?: Usuario;
  horarioDisponibleId: number;
  horarioDisponible?: HorarioDisponible;
  estado: EstadoReserva;
  notas?: string;
  canceladoPor?: Usuario;
  motivoCancelacion?: string;
  createdAt: Date;
  updatedAt: Date;
  confirmadoEn?: Date;
  canceladoEn?: Date;
}

export interface CrearHorarioDisponibleDto {
  fecha: Date;
  horaInicio: Date;
  horaFin: Date;
  capacidad: number;
  descripcion?: string;
}

export interface UpdateHorarioDisponibleDto extends CrearHorarioDisponibleDto {
  id: number;
  estado: EstadoHorario;
}

export interface UpdateEstadoReservaDto {
  reservaId: number;
  estado: EstadoReserva;
  motivoCancelacion?: string;
}

