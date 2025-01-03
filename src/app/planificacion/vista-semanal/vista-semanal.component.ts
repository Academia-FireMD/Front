import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import {
  CalendarEvent,
  CalendarEventTimesChangedEvent,
  CalendarView,
} from 'angular-calendar';
import { debounce } from 'lodash';
import { map, Subject } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import {
  PlanificacionBloque,
  SubBloque,
} from '../../shared/models/planificacion.model';
import { EventsService } from '../services/events.service';
export const colors: any = {
  yellow: {
    primary: '#e3bc08',
    secondary: '#fdf1ba',
  },
  blue: {
    primary: '#1e90ff',
    secondary: '#d1e8ff',
  },
};
@Component({
  selector: 'app-vista-semanal',
  templateUrl: './vista-semanal.component.html',
  styleUrl: './vista-semanal.component.scss',
})
export class VistaSemanalComponent {
  planificacionesService = inject(PlanificacionesService);
  eventsService = inject(EventsService);
  public searchTerm = signal('');
  isCommentDialogVisible: boolean = false;
  selectedSubBloque!: SubBloque;
  @Input() role: 'ADMIN' | 'ALUMNO' = 'ALUMNO';

  refresh = new Subject<void>();

  // Propiedad para gestionar el estado del diálogo
  displayDialog = false;

  // Propiedad para almacenar el evento seleccionado
  selectedEvent: CalendarEvent | null = null;
  public editSubBloqueData!: SubBloque;
  activeDayIsOpen = false;
  view = CalendarView.Month;
  public isDialogVisible: boolean = false;
  @Input() events: CalendarEvent[] = [];
  @Output() eventsChange = new EventEmitter<CalendarEvent[]>();
  @Output() saveChanges = new EventEmitter<void>();
  @Input() viewDate = new Date();
  @Input() mode: 'picker' | 'edit' = 'edit';
  public getEventsForDay = this.eventsService.getEventsForDay;
  public getProgressBarColor = this.eventsService.getProgressBarColor;
  public getCompletedSubBlocksForDay =
    this.eventsService.getCompletedSubBlocksForDay;
  public getProgressPercentageForDay =
    this.eventsService.getProgressPercentageForDay;

  public getAllBloques$ = computed(() => {
    return this.planificacionesService
      .getBloques$({
        skip: 0,
        take: 10,
        searchTerm: this.searchTerm(),
      })
      .pipe(
        map((e) => {
          e.data.forEach((e: any) => (e['tieneTemplate'] = true));
          return e;
        })
      );
  });
  public valueChanged = (event: any) => {
    this.searchTerm.set(event.target.value);
  };
  public debouncedValueChanged = debounce(this.valueChanged, 300);
  public colors = colors;
  onEventClicked(event: CalendarEvent): void {
    this.selectedEvent = event;
    this.editSubBloqueData = event.meta.subBloque;
    this.isDialogVisible = true;
  }

  saveEvent(subbloque: SubBloque): void {
    if (this.selectedEvent && subbloque) {
      const updatedEvent = {
        ...this.selectedEvent,
        title: subbloque.nombre,
        color: {
          primary: subbloque.color,
          secondary: subbloque.color,
        },
        end: new Date(
          new Date(this.selectedEvent.start).getTime() +
            subbloque.duracion * 60000
        ),
        meta: {
          ...this.selectedEvent.meta,
          subBloque: {
            ...this.selectedEvent.meta?.subBloque,
            comentarios: subbloque.comentarios,
            color: subbloque.color,
            duracion: subbloque.duracion,
          },
        },
      };
      const isNewlyAdded = !this.events.find((e) => e === this.selectedEvent);
      if (isNewlyAdded) {
        this.events.push(updatedEvent as CalendarEvent);
      } else {
        this.events = this.events.map((event) =>
          event === this.selectedEvent ? updatedEvent : event
        ) as CalendarEvent<any>[];
      }
      this.refresh.next();
      this.eventsChange.emit(this.events);
      this.displayDialog = false;
    }
  }

  eventDropped({
    event,
    newStart,
    newEnd,
    allDay,
  }: CalendarEventTimesChangedEvent): void {
    if (event instanceof MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (typeof allDay !== 'undefined') {
      event.allDay = allDay;
    }

    // Actualizamos las fechas del evento original
    event.start = newStart;
    if (newEnd) {
      event.end = newEnd;
    }
    // Verificamos si el evento tiene `template: true` para decidir si ejecutar el bucle de subBloques
    if ((event as any)['tieneTemplate'] || event.meta?.template) {
      // Supongamos que el `CalendarEvent` tiene una referencia al `PlanificacionBloque`
      const planificacionBloque: PlanificacionBloque = event as any;

      if (planificacionBloque) {
        // Establecemos la hora de inicio base en newStart
        let currentStartDate = new Date(newStart);

        // Iteramos sobre los subBloques y creamos eventos basados en ellos
        planificacionBloque.subBloques.forEach((subBloque) => {
          const subEvent: CalendarEvent = {
            title: subBloque.nombre,
            color: {
              primary: subBloque.color || this.colors.yellow.primary,
              secondary: subBloque.color || this.colors.yellow.secondary,
            },
            start: new Date(currentStartDate),
            end: new Date(
              currentStartDate.getTime() + subBloque.duracion * 60000
            ),
            meta: { subBloque },
          };

          // Añadimos el sub-evento a los eventos
          this.events.push(subEvent);

          // Actualizamos currentStart para el próximo subBloque
          currentStartDate = new Date(subEvent.end as Date);
        });
      }
    } else {
      // El evento simplemente se movió dentro del calendario, por lo que no necesitamos crear sub-eventos
      console.log('Movimiento de evento existente dentro del calendario');
    }
    this.events = [...this.events];
    if (this.view === 'month') {
      this.viewDate = newStart;
      this.activeDayIsOpen = true;
    }
    this.eventsChange.emit(this.events);
    this.refresh.next();
  }

  cancelEdit(): void {
    this.displayDialog = false;
  }

  ngAfterViewInit(): void {
    if (
      document.getElementsByClassName('cal-time') !== undefined &&
      document.getElementsByClassName('cal-time').length > 0
    ) {
      let scrollbar = document.getElementsByClassName('cal-time')[16];
      scrollbar.scrollIntoView({ behavior: 'smooth' });
      scrollbar.scrollIntoView(true);
    }
  }

  toggleComplete(event: CalendarEvent): void {
    event.meta = { ...event.meta, completado: !event.meta?.completado };
    this.refresh.next(); // Refresca la vista del calendario
  }

  openCommentDialog(subBloque: any, event: Event): void {
    event.stopPropagation(); // Evita que el clic abra otros elementos
    this.selectedSubBloque = { ...subBloque }; // Clona el sub-bloque para edición
    this.isCommentDialogVisible = true;
  }

  public deleteEvent(subBloque: SubBloque, event: Event) {
    event.stopPropagation();
    this.events = this.events.filter(
      (event) => event.meta?.subBloque?.id != subBloque.id
    );
    this.eventsChange.emit(this.events);
  }

  saveComment(): void {
    const event = this.events.find(
      (event) =>
        event?.meta?.subBloque?.id === (this.selectedSubBloque as SubBloque)?.id
    );

    const subBloque = event?.meta.subBloque;

    if (subBloque) {
      subBloque.comentariosAlumno = this.selectedSubBloque.comentariosAlumno;
    }

    this.isCommentDialogVisible = false;
    this.refresh.next();
    this.eventsChange.emit(this.events);
    setTimeout(() => {
      this.saveChanges.emit();
    }, 0);
  }

  onTimeClicked({ date, sourceEvent }: any): void {
    sourceEvent.stopPropagation();
    this.selectedEvent = null;

    const nuevoSubBloque: SubBloque = {
      id: undefined, // Se generará al guardar
      horaInicio: date, // Usa la fecha/hora seleccionada
      duracion: 60, // Valor predeterminado
      nombre: '',
      comentarios: '',
      color: '#ffffff', // Color predeterminado
    };

    this.selectedEvent = {
      title: nuevoSubBloque.nombre,
      start: date,
      end: new Date(date.getTime() + nuevoSubBloque.duracion * 60000),
      meta: {
        subBloque: {
          comentarios: nuevoSubBloque.comentarios,
          color: nuevoSubBloque.color,
          duracion: nuevoSubBloque.duracion,
        },
      },
    };

    this.editSubBloqueData = nuevoSubBloque;
    this.isDialogVisible = true;
  }
}
