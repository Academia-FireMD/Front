import { Injectable } from '@angular/core';
import { EstadoReserva, HorarioDisponible, Reserva } from '../models/horario.model';
import { DiaEstado } from '../components/calendario-horarios/calendario-horarios.component';

@Injectable({
  providedIn: 'root'
})
export class HorariosUtilsService {
  toDate(date: Date | string): Date {
    if (date instanceof Date) {
      return date;
    }
    return new Date(date);
  }

  getDateKey(date: Date): string {
    const d = this.toDate(date);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  parseDateKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month, day);
  }

  esHorarioPasado(horario: HorarioDisponible): boolean {
    const ahora = new Date();
    const fechaHorario = this.toDate(horario.fecha);
    const horaInicio = this.toDate(horario.horaInicio);
    
    const fechaHoraCompleta = new Date(
      fechaHorario.getFullYear(),
      fechaHorario.getMonth(),
      fechaHorario.getDate(),
      horaInicio.getHours(),
      horaInicio.getMinutes(),
      horaInicio.getSeconds()
    );
    
    return fechaHoraCompleta < ahora;
  }

  getDisponibles(horario: HorarioDisponible): number {
    const reservasActivas = (horario.reservas || []).filter(
      r => r.estado !== EstadoReserva.CANCELADA
    ).length;
    return horario.capacidad - reservasActivas;
  }

  getEstadoLabel(estado: EstadoReserva): string {
    const estados: Record<EstadoReserva, string> = {
      [EstadoReserva.PENDIENTE]: 'Pendiente',
      [EstadoReserva.CONFIRMADA]: 'Confirmada',
      [EstadoReserva.CANCELADA]: 'Cancelada',
      [EstadoReserva.COMPLETADA]: 'Completada',
      [EstadoReserva.AUSENTE]: 'Ausente'
    };
    return estados[estado] || estado;
  }

  puedeCancelarReserva(reserva: Reserva): boolean {
    return reserva.estado !== EstadoReserva.COMPLETADA && 
           reserva.estado !== EstadoReserva.AUSENTE && 
           reserva.estado !== EstadoReserva.CANCELADA;
  }

  calcularDiasEstados(
    horarios: HorarioDisponible[],
    reservas: Reserva[],
    filtrarPasados: boolean = false
  ): DiaEstado[] {
    const estados: DiaEstado[] = [];
    const diasMap = new Map<string, { total: number; disponibles: number }>();

    const horariosFiltrados = filtrarPasados 
      ? horarios.filter(h => !this.esHorarioPasado(h))
      : horarios;

    horariosFiltrados.forEach(horario => {
      const fecha = this.toDate(horario.fecha);
      const fechaKey = this.getDateKey(fecha);
      if (!diasMap.has(fechaKey)) {
        diasMap.set(fechaKey, { total: 0, disponibles: 0 });
      }
      const dia = diasMap.get(fechaKey)!;
      dia.total += horario.capacidad;
      dia.disponibles += horario.capacidad;
    });

    reservas.forEach(reserva => {
      if (reserva.horarioDisponible && reserva.estado !== EstadoReserva.CANCELADA) {
        const fecha = this.toDate(reserva.horarioDisponible.fecha);
        const fechaKey = this.getDateKey(fecha);
        if (diasMap.has(fechaKey)) {
          diasMap.get(fechaKey)!.disponibles--;
        }
      }
    });

    diasMap.forEach((valor, fechaKey) => {
      const fecha = this.parseDateKey(fechaKey);
      let estado: DiaEstado['estado'] = 'sin-datos';
      
      if (valor.disponibles === valor.total && valor.total > 0) {
        estado = 'disponible';
      } else if (valor.disponibles > 0) {
        estado = 'parcial';
      } else if (valor.total > 0) {
        estado = 'completo';
      }
      
      estados.push({ fecha, estado });
    });

    return estados;
  }

  esReservaPasada(reserva: Reserva): boolean {
    if (!reserva.horarioDisponible?.fecha || !reserva.horarioDisponible?.horaInicio) return false;
    const ahora = new Date();
    const fechaHorario = this.toDate(reserva.horarioDisponible.fecha);
    const horaInicio = this.toDate(reserva.horarioDisponible.horaInicio);
    const fechaHoraCompleta = new Date(
      fechaHorario.getFullYear(),
      fechaHorario.getMonth(),
      fechaHorario.getDate(),
      horaInicio.getHours(),
      horaInicio.getMinutes()
    );
    return fechaHoraCompleta < ahora;
  }

  formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  getHorarioLabel(horario: HorarioDisponible): string {
    return `${this.formatTime(horario.horaInicio)} - ${this.formatTime(horario.horaFin)}`;
  }
}

