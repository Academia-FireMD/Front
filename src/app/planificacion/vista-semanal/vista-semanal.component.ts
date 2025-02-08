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
import { cloneDeep, debounce } from 'lodash';
import { MenuItem } from 'primeng/api';
import { ContextMenu } from 'primeng/contextmenu';
import { BehaviorSubject, debounceTime, map, Subject } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import {
  PlanificacionBloque,
  SubBloque,
} from '../../shared/models/planificacion.model';
import { getDateForDayOfWeek, getStartOfWeek } from '../../utils/utils';
import { EventsService } from '../services/events.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  public seleccionandoBloquesAsignables = false;
  @Input() public set events(data: CalendarEvent[]) {
    data.forEach((e) => {
      if (this.mode == 'edit') e.draggable = true;
    });
    this._events = data;
  }
  public get events() {
    return this._events;
  }

  private _events: CalendarEvent[] = [];
  @Output() eventsChange = new EventEmitter<CalendarEvent[]>();
  @Output() saveChanges = new EventEmitter<void>();
  @Input() viewDate = new Date();
  @Input() mode: 'picker' | 'edit' = 'edit';
  private onTimeClickedDate!: Date;
  public triggerSaveUpdateProgress = new Subject();
  menuItems: MenuItem[] = [
    {
      label: 'Añadir nuevo',
      icon: 'pi pi-plus',
      command: () => {
        this.selectedEvent = null;
        const nuevoSubBloque: SubBloque = {
          id: undefined, // Se generará al guardar
          horaInicio: this.onTimeClickedDate, // Usa la fecha/hora seleccionada
          duracion: 60, // Valor predeterminado
          nombre: '',
          comentarios: '',
          color: '#ffffff', // Color predeterminado
        };
        this.selectedEvent = {
          title: nuevoSubBloque.nombre,
          start: this.onTimeClickedDate,
          draggable: true,
          end: new Date(
            this.onTimeClickedDate.getTime() + nuevoSubBloque.duracion * 60000
          ),
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
      },
    },
    {
      label: 'Aplicar bloque asignable',
      icon: 'pi pi-book',
      command: () => (this.seleccionandoBloquesAsignables = true),
    },
  ];
  public getEventsForDay = this.eventsService.getEventsForDay;
  public getProgressBarColor = this.eventsService.getProgressBarColor;
  public getCompletedSubBlocksForDay =
    this.eventsService.getCompletedSubBlocksForDay;
  public getProgressPercentageForDay =
    this.eventsService.getProgressPercentageForDay;
  isCloneDialogVisible: boolean = false;
  selectedDayForCloning: Date | null = null;
  targetDayForCloning: number | null = null;

  daysOfWeek = [
    { label: 'Lunes', value: 0 },
    { label: 'Martes', value: 1 },
    { label: 'Miércoles', value: 2 },
    { label: 'Jueves', value: 3 },
    { label: 'Viernes', value: 4 },
    { label: 'Sábado', value: 5 },
    { label: 'Domingo', value: 6 },
  ];

  openCloneDialog(day: Date): void {
    this.selectedDayForCloning = day;
    this.isCloneDialogVisible = true;
  }

  cloneEventsToTargetDay(): void {
    if (!this.selectedDayForCloning || this.targetDayForCloning == null) {
      console.error('Faltan el día seleccionado o el día objetivo.');
      return;
    }

    // Convertir el día objetivo en una fecha dentro de la semana actual
    const weekStart = getStartOfWeek(this.viewDate); // Inicio de la semana actual
    const targetDayDate = getDateForDayOfWeek(
      this.targetDayForCloning,
      weekStart
    );

    // Obtener eventos del día seleccionado
    const eventsToClone = cloneDeep(
      this.getEventsForDay(this.events, this.selectedDayForCloning)
    );

    if (eventsToClone.length === 0) {
      console.warn(
        `No hay eventos para clonar desde ${this.selectedDayForCloning}.`
      );
      this.isCloneDialogVisible = false;
      return;
    }

    // Crear clones de los eventos con la nueva fecha
    const clonedEvents = eventsToClone.map((event) => {
      event.meta.subBloque.id = undefined;
      return {
        ...event,
        start: new Date(
          targetDayDate.getFullYear(),
          targetDayDate.getMonth(),
          targetDayDate.getDate(),
          event.start.getHours(),
          event.start.getMinutes()
        ),
        end: new Date(
          targetDayDate.getFullYear(),
          targetDayDate.getMonth(),
          targetDayDate.getDate(),
          event.end.getHours(),
          event.end.getMinutes()
        ),
        id: undefined, // Eliminar el ID para que el backend cree uno nuevo
      };
    });

    // Agregar los eventos clonados a la lista de eventos actual
    this.events = cloneDeep([
      ...cloneDeep(this.events),
      ...cloneDeep(clonedEvents),
    ]);
    this.eventsChange.emit(this.events);
    console.log(
      `Clonados ${clonedEvents.length} eventos de ${this.selectedDayForCloning} a ${targetDayDate}.`
    );

    // Cerrar el diálogo y reiniciar las variables
    this.isCloneDialogVisible = false;
    this.targetDayForCloning = null;

    // Aquí podrías hacer una llamada al backend si los datos se guardan en un servidor:
    // this.eventService.saveEvents(clonedEvents).subscribe(() => { ... });
  }
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

  constructor() {
    this.triggerSaveUpdateProgress
      .pipe(debounceTime(1000), takeUntilDestroyed())
      .subscribe(() => this.saveChanges.emit());
  }

  ngOnInit(): void {}

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

  public bloqueAsignableSeleccionado(planificacionBloque: PlanificacionBloque) {
    this.applyPlanificacionBloque(planificacionBloque, this.onTimeClickedDate);
    this.events = [...this.events];
    if (this.view === 'month') {
      this.viewDate = this.onTimeClickedDate;
      this.activeDayIsOpen = true;
    }
    this.eventsChange.emit(this.events);
    this.refresh.next();
    this.onTimeClickedDate = null as any;
    this.seleccionandoBloquesAsignables = false;
  }

  private applyPlanificacionBloque(
    planificacionBloque: PlanificacionBloque,
    newStart: Date
  ) {
    // Supongamos que el `CalendarEvent` tiene una referencia al `PlanificacionBloque`

    if (planificacionBloque) {
      // Establecemos la hora de inicio base en newStart
      let currentStartDate = new Date(newStart);
      let clonedPlanificacion = cloneDeep(planificacionBloque);
      // Iteramos sobre los subBloques y creamos eventos basados en ellos
      clonedPlanificacion.subBloques.forEach((subBloque) => {
        subBloque.id = null;
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
          draggable: true,
        };

        // Añadimos el sub-evento a los eventos
        this.events.push(subEvent);

        // Actualizamos currentStart para el próximo subBloque
        currentStartDate = new Date(subEvent.end as Date);
      });
    }
  }

  eventDropped(
    { event, newStart, newEnd, allDay }: CalendarEventTimesChangedEvent,
    autoSave = false
  ): void {
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
      this.applyPlanificacionBloque(event as any, newStart);
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
    if (!!autoSave) this.saveChanges.emit();
  }

  cancelEdit(): void {
    this.displayDialog = false;
  }

  ngAfterViewInit(): void {
    // if (
    //   document.getElementsByClassName('cal-time') !== undefined &&
    //   document.getElementsByClassName('cal-time').length > 0
    // ) {
    //   let scrollbar = document.getElementsByClassName('cal-time')[16];
    //   scrollbar.scrollIntoView({ behavior: 'smooth' });
    //   scrollbar.scrollIntoView(true);
    // }
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

  public deleteEvent(calendarEvent: CalendarEvent, event: Event) {
    event.stopPropagation();
    this.events = this.events.filter((event) => event != calendarEvent);
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

  onTimeClicked({ date, sourceEvent }: any, cm: ContextMenu): void {
    sourceEvent.stopPropagation();
    this.onTimeClickedDate = date;
    cm.show(sourceEvent);
  }
}
