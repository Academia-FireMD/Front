import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../services/api-base.service';
import {
  CrearHorarioDisponibleDto,
  EstadoReserva,
  HorarioDisponible,
  Reserva,
  UpdateEstadoReservaDto,
  UpdateHorarioDisponibleDto
} from '../models/horario.model';

@Injectable({
  providedIn: 'root',
})
export class HorariosService extends ApiBaseService {
  constructor(private http: HttpClient) {
    super(http);
    this.controllerPrefix = '/horarios';
  }

  // Métodos para administradores
  public generarHorarios$(horarios: CrearHorarioDisponibleDto[]): Observable<any> {
    return this.post('/admin/generar-horarios', horarios);
  }

  public getHorarios$(): Observable<HorarioDisponible[]> {
    return this.get('/admin/mis-horarios') as Observable<HorarioDisponible[]>;
  }

  public updateHorarios$(horarios: UpdateHorarioDisponibleDto[]): Observable<any> {
    return this.put('/admin/actualizar-horarios', horarios);
  }

  public deleteHorario$(id: number): Observable<any> {
    return this.delete(`/admin/horario/${id}`);
  }

  public deleteHorariosPasados$(): Observable<any> {
    return this.delete('/admin/horarios-pasados');
  }

  // Métodos para alumnos
  public getHorariosDisponibles$(): Observable<HorarioDisponible[]> {
    return this.get('/alumno/horarios-disponibles') as Observable<HorarioDisponible[]>;
  }

  public reservarHorario$(horarioId: number): Observable<Reserva> {
    return this.post(`/alumno/reservar/${horarioId}`, {}) as Observable<Reserva>;
  }

  public getMisReservas$(): Observable<Reserva[]> {
    return this.get('/alumno/mis-reservas') as Observable<Reserva[]>;
  }

  public cancelarReservaAlumno$(reservaId: number, motivoCancelacion: string): Observable<any> {
    const dto: UpdateEstadoReservaDto = {
      reservaId,
      estado: EstadoReserva.CANCELADA,
      motivoCancelacion
    };
    return this.actualizarEstadoReserva$(dto);
  }

  // Métodos compartidos
  public actualizarEstadoReserva$(dto: UpdateEstadoReservaDto): Observable<Reserva> {
    return this.put('/reserva/estado', dto) as Observable<Reserva>;
  }
}

