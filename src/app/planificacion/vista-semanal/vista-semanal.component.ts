import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CalendarEvent,
  CalendarEventTimesChangedEvent,
  CalendarView,
} from 'angular-calendar';
import { cloneDeep, debounce } from 'lodash';
import { Memoize } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { ContextMenu } from 'primeng/contextmenu';
import { map, Subject } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import {
  PlanificacionBloque,
  SubBloque,
} from '../../shared/models/planificacion.model';
import {
  getDateForDayOfWeek,
  getStartOfWeek
} from '../../utils/utils';
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
  
  private _viewDate = new Date();
  @Input() 
  set viewDate(value: Date) {
    // Validar que la fecha sea válida
    if (value && value instanceof Date && !isNaN(value.getTime())) {
      this._viewDate = value;
    } else {
      console.warn('Invalid viewDate provided, using current date');
      this._viewDate = new Date();
    }
  }
  
  get viewDate(): Date {
    return this._viewDate;
  }
  
  @Input() mode: 'picker' | 'edit' = 'edit';
  private onTimeClickedDate!: Date;
  public triggerSaveUpdateProgress = new Subject();
  private activatedRoute = inject(ActivatedRoute);
  @Memoize()
  getMenuItems(role: 'ADMIN' | 'ALUMNO') {
    const addNewPersonalizado = {
      label: 'Añadir evento personal',
      icon: 'pi pi-plus-circle',
      command: () => {
        this.selectedEvent = null;
        const nuevoEvento = {
          id: undefined,
          horaInicio: this.onTimeClickedDate,
          duracion: 60,
          nombre: '',
          descripcion: '',
          color: '#4caf50', // Color diferente para distinguir
          planificacionId: Number(
            this.activatedRoute?.snapshot?.paramMap?.get('id')
          ),
        };

        this.selectedEvent = {
          title: nuevoEvento.nombre,
          start: this.onTimeClickedDate,
          draggable: true,
          end: new Date(
            this.onTimeClickedDate.getTime() + nuevoEvento.duracion * 60000
          ),
          color: {
            primary: nuevoEvento.color,
            secondary: nuevoEvento.color,
          },
          meta: {
            tipo: 'personalizado',
            eventoPersonalizado: nuevoEvento,
          },
        };

        this.editEventoPersonalizadoData = nuevoEvento;
        this.isEventoPersonalizadoDialogVisible = true;
      },
    };

    const addNew = {
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
    };

    const aplicarBloqueAsignable = {
      label: 'Aplicar bloque asignable',
      icon: 'pi pi-book',
      command: () => (this.seleccionandoBloquesAsignables = true),
    };

    if (role == 'ADMIN') {
      return [addNew, aplicarBloqueAsignable];
    }

    // Para alumnos, mostrar opción de agregar evento personal
    return [addNewPersonalizado];
  }
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

  async cloneEventsToTargetDay(): Promise<void> {
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
  toast = inject(ToastrService);

  constructor() {
    this.triggerSaveUpdateProgress.subscribe(() => this.saveChanges.emit());
  }

  ngOnInit(): void {}

  onEventClicked(event: CalendarEvent): void {
    this.selectedEvent = event;

    if (event.meta?.esPersonalizado) {
      this.editEventoPersonalizadoData = {
        id: event.meta.subBloque.id,
        planificacionId: Number(this.activatedRoute.snapshot.params['id']),
        nombre: event.title,
        descripcion: event.meta.subBloque.comentarios,
        horaInicio: event.start,
        duracion: event.meta.subBloque.duracion,
        color: event.meta.subBloque.color,
        importante: event.meta.subBloque.importante,
        tiempoAviso: event.meta.subBloque.tiempoAviso,
        realizado: event.meta.subBloque.realizado,
      };
      this.isEventoPersonalizadoDialogVisible = true;
    } else {
      this.editSubBloqueData = {
        ...event.meta.subBloque,
        nombre: event.title,
      };
      this.isDialogVisible = true;
    }
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
            importante: subbloque.importante,
            tiempoAviso: subbloque.tiempoAviso,
          },
        },
      };
      const isNewlyAdded = !this.events.find((e) => e === this.selectedEvent);
      if (isNewlyAdded) {
        this.events.push(updatedEvent as CalendarEvent);
      } else {
        for (let i = 0; i < this.events.length; i++) {
          const event = this.events[i];
          if (event === this.selectedEvent) {
            this.events[i] = cloneDeep(updatedEvent) as CalendarEvent;
            this.events = [...this.events];
          }
        }
      }
      this.refresh.next();
      this.eventsChange.emit(this.events);
      this.displayDialog = false;
      //Como el alumno no tiene botón de guardar... se autoguarda al añadir
      if (this.role == 'ALUMNO') this.saveChanges.emit();
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

    // Verificamos el tipo de evento usando la nueva estructura con esPersonalizado
    if (event.meta?.esPersonalizado) {
      // Es un evento personalizado, actualizar en la base de datos
      const subBloque = event.meta.subBloque;
      if (subBloque && subBloque.id) {
        this.planificacionesService
          .actualizarEventoPersonalizado$({
            id: subBloque.id,
            planificacionId: Number(this.activatedRoute.snapshot.params['id']),
            nombre: event.title,
            descripcion: subBloque.comentarios || '',
            horaInicio: newStart,
            duracion: subBloque.duracion,
            color: subBloque.color,
            importante: subBloque.importante || false,
            tiempoAviso: subBloque.tiempoAviso
          })
          .subscribe({
            next: () => {
              // Actualizar localmente
              event.meta.subBloque.horaInicio = newStart;
              this.refresh.next();
            },
            error: (err) => {
              this.toast.error(
                'Error al guardar la posición del evento personal'
              );
              console.error('Error:', err);
            },
          });
      }
    } else if ((event as any)['tieneTemplate'] || event.meta?.template) {
      // Aplicar template (código existente)
      this.applyPlanificacionBloque(event as any, newStart);
    } else if (this.role === 'ALUMNO' && event?.meta?.subBloque?.id) {
      // Actualizar posición personalizada (código existente)
      this.planificacionesService
        .actualizarProgresoSubBloque$({
          subBloqueId: event.meta.subBloque.id,
          planificacionId: Number(this.activatedRoute.snapshot.params['id']),
          posicionPersonalizada: newStart,
        })
        .subscribe({
          next: () => {
            console.log('Posición personalizada guardada');
          },
          error: (err) => {
            this.toast.error('Error al guardar la posición personalizada');
            console.error('Error al guardar posición:', err);
          },
        });
    }

    this.events = [...this.events];
    if (this.view === 'month') {
      this.viewDate = newStart;
      this.activeDayIsOpen = true;
    }
    this.refresh.next();
    if (this.role === 'ADMIN' && !!autoSave) {
      this.saveChanges.emit();
    }
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

  async saveComment(): Promise<void> {
    const event = this.events.find(
      (event) =>
        event?.meta?.subBloque?.id === (this.selectedSubBloque as SubBloque)?.id
    );

    const subBloque = event?.meta.subBloque;

    if (!subBloque || !subBloque.id) {
      this.toast.error('No se pudo guardar el comentario');
      this.isCommentDialogVisible = false;
      return;
    }

    if (this.role === 'ALUMNO') {
      // Para alumnos, usar el nuevo servicio
      this.planificacionesService
        .actualizarProgresoSubBloque$({
          subBloqueId: subBloque.id,
          planificacionId: Number(this.activatedRoute.snapshot.params['id']),
          comentariosAlumno: this.selectedSubBloque.comentariosAlumno,
        })
        .subscribe({
          next: () => {
            // Actualizar localmente
            subBloque.comentariosAlumno =
              this.selectedSubBloque.comentariosAlumno;
            this.isCommentDialogVisible = false;
            this.refresh.next();
            this.toast.success('Comentario guardado correctamente');
          },
          error: (err) => {
            this.toast.error('Error al guardar el comentario');
            console.error('Error al guardar comentario:', err);
            this.isCommentDialogVisible = false;
          },
        });
    } else {
      // Para admin, comportamiento previo
      subBloque.comentariosAlumno = this.selectedSubBloque.comentariosAlumno;
      this.isCommentDialogVisible = false;
      this.refresh.next();
      this.eventsChange.emit(this.events);
    }
  }

  onTimeClicked({ date, sourceEvent }: any, cm: ContextMenu): void {
    sourceEvent.stopPropagation();
    this.onTimeClickedDate = date;
    cm.show(sourceEvent);
  }

  // Propiedades para manejar eventos personalizados
  public isEventoPersonalizadoDialogVisible: boolean = false;
  public editEventoPersonalizadoData: any = null;

  // Guardar evento personalizado
  async saveEventoPersonalizado(evento: any): Promise<void> {
    if (!evento) return;

    // Determinar si es nuevo o existente
    const isNew = !evento.id;

    // Preparar para guardar en base de datos
    const dto = {
      id: evento.id,
      planificacionId: Number(this.activatedRoute.snapshot.params['id']),
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      horaInicio: evento.horaInicio,
      duracion: evento.duracion,
      color: evento.color,
      importante: evento.importante,
      tiempoAviso: evento.tiempoAviso,
      realizado: evento.realizado,
    };

    // Llamada al servicio
    const observable = isNew
      ? this.planificacionesService.crearEventoPersonalizado$(dto)
      : this.planificacionesService.actualizarEventoPersonalizado$(dto);

    observable.subscribe({
      next: (response) => {
        // Crear objeto para el evento
        const eventoData = {
          ...dto,
          id: isNew ? response.id : dto.id,
        };

        // Crear el evento del calendario con estructura unificada
        const updatedEvent = {
          title: eventoData.nombre,
          start: new Date(eventoData.horaInicio),
          end: new Date(
            new Date(eventoData.horaInicio).getTime() +
              eventoData.duracion * 60000
          ),
          color: {
            primary: eventoData.color || '#4caf50',
            secondary: eventoData.color || '#4caf50',
          },
          draggable: true,
          meta: {
            esPersonalizado: true,
            subBloque: {
              id: eventoData.id,
              nombre: eventoData.nombre,
              horaInicio: eventoData.horaInicio,
              duracion: eventoData.duracion,
              comentarios: eventoData.descripcion || '',
              color: eventoData.color || '#4caf50',
              importante: eventoData.importante || false,
              tiempoAviso: eventoData.tiempoAviso,
              realizado: eventoData.realizado || false,
              planificacionId: Number(this.activatedRoute.snapshot.params['id']),
              esPersonalizado: true,
            },
          },
        };

        if (isNew) {
          this.events.push(updatedEvent as CalendarEvent);
        } else {
          // Reemplazar el evento existente
          for (let i = 0; i < this.events.length; i++) {
            if (
              this.events[i].meta?.esPersonalizado &&
              this.events[i].meta?.subBloque?.id === eventoData.id
            ) {
              this.events[i] = updatedEvent as CalendarEvent;
              break;
            }
          }
        }

        this.events = [...this.events];
        this.refresh.next();
        this.isEventoPersonalizadoDialogVisible = false;
        this.toast.success(
          `Evento personal ${isNew ? 'creado' : 'actualizado'} correctamente`
        );
      },
      error: (err) => {
        this.toast.error(
          `Error al ${isNew ? 'crear' : 'actualizar'} el evento personal`
        );
        console.error('Error:', err);
      },
    });
  }

  // Eliminar evento personalizado
  deleteEventoPersonalizado(event: CalendarEvent, domEvent: Event): void {
    domEvent.stopPropagation();

    if (!event.meta?.subBloque?.id || !event.meta?.esPersonalizado) {
      this.toast.error('No se puede eliminar este evento');
      return;
    }

    this.planificacionesService
      .eliminarEventoPersonalizado$(event.meta.subBloque.id)
      .subscribe({
        next: () => {
          this.events = this.events.filter(
            (e) =>
              !(
                e.meta?.esPersonalizado &&
                e.meta?.subBloque?.id === event.meta?.subBloque?.id
              )
          );
          this.refresh.next();
          this.toast.success('Evento personal eliminado correctamente');
        },
        error: (err) => {
          this.toast.error('Error al eliminar el evento personal');
          console.error('Error:', err);
        },
      });
  }

  // Función unificada para actualizar realizado en cualquier tipo de evento
  updateEventProgress(event: CalendarEvent, realizado?: boolean): void {
    // Si no se proporciona valor, toggled el valor actual
    const nuevoEstado =
      realizado !== undefined ? realizado : !event.meta?.subBloque?.realizado;

    // Verificar si tenemos ID
    if (!event?.meta?.subBloque?.id) {
      console.error('No se puede actualizar: falta el ID del evento');
      return;
    }

    // Verificar si es un evento personalizado
    const esPersonalizado = event.meta?.esPersonalizado || false;

    if (esPersonalizado) {
      // Crear un objeto DTO simplificado
      const dto = {
        id: event.meta.subBloque.id,
        planificacionId: Number(this.activatedRoute.snapshot.params['id']),
        realizado: nuevoEstado,
      };

      this.planificacionesService
        .actualizarEventoPersonalizadoRealizado$(
          dto.id,
          dto.planificacionId,
          dto.realizado
        )
        .subscribe({
          next: () => {
            // Actualizar localmente
            event.meta.subBloque.realizado = nuevoEstado;
            this.refresh.next();
            this.toast.success(
              `Evento marcado como ${nuevoEstado ? 'realizado' : 'pendiente'}`
            );
          },
          error: (err) => {
            console.error('Error al actualizar el evento:', err);
            this.toast.error('Error al actualizar el estado del evento');
          },
        });
    } else {
      // Es un subbloque normal
      if (this.role === 'ALUMNO') {
        this.planificacionesService
          .actualizarProgresoSubBloque$({
            subBloqueId: event.meta.subBloque.id,
            planificacionId: Number(this.activatedRoute.snapshot.params['id']),
            realizado: nuevoEstado,
          })
          .subscribe({
            next: () => {
              event.meta.subBloque.realizado = nuevoEstado;
              this.refresh.next();
            },
            error: (err) => {
              event.meta.subBloque.realizado = !nuevoEstado;
              this.refresh.next();
              this.toast.error(
                'Error al actualizar el progreso. Inténtalo de nuevo.'
              );
              console.error('Error actualizar progreso:', err);
            },
          });
      } else {
        // Para el modo ADMIN
        event.meta.subBloque.realizado = nuevoEstado;
        this.refresh.next();
      }
    }
  }
}
