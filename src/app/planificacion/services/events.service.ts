import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { SubBloque } from '../../shared/models/planificacion.model';
import { colors } from '../vista-semanal/vista-semanal.component';

@Injectable({
  providedIn: 'root',
})
export class EventsService {
  constructor() {}

  public fromEventsToSubbloques(events: CalendarEvent[]): Partial<SubBloque>[] {
    return events.map((event: any) => ({
      id: event.meta?.subBloque?.id,
      realizado: event.meta?.subBloque?.realizado ?? false,
      comentariosAlumno: event.meta?.subBloque?.comentariosAlumno ?? null,
      horaInicio: event.start, // Fecha y hora completa del evento
      duracion: event.meta?.subBloque?.duracion || event.duracion, // Duración del evento
      nombre: event.title, // Título del sub-bloque o evento
      comentarios: event.meta?.subBloque?.comentarios || event.comentarios, // Comentarios opcionales
      color: event.color?.primary || '', // Color del evento si está definido
    }));
  }

  public fromSubbloquesToEvents(subbloques: SubBloque[]): CalendarEvent[] {
    return subbloques.map((subBloque) => ({
      title: subBloque.nombre,
      start: new Date(subBloque.horaInicio), // Convertir la hora de inicio a Date
      end: new Date(
        new Date(subBloque.horaInicio).getTime() + subBloque.duracion * 60000
      ), // Calcular la hora de finalización
      color: {
        primary: subBloque.color || colors.yellow.primary,
        secondary: subBloque.color || colors.yellow.secondary,
      },
      draggable: true, // Si los eventos pueden ser arrastrados
      meta: { subBloque }, // Adjuntar el subBloque original para referencia
    }));
  }

  public calculateMinDate(events: CalendarEvent[]) {
    return events.reduce((earliest, event) => {
      return event.start < earliest ? event.start : earliest;
    }, events[0]?.start || new Date());
  }
}
