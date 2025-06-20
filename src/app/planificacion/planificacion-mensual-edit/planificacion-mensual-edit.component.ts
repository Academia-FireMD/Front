import { Component, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { ToastrService } from 'ngx-toastr';
import { PrimeNGConfig } from 'primeng/api';
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  tap,
} from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { UserService } from '../../services/user.service';
import { ViewportService } from '../../services/viewport.service';
import {
  PlantillaSemanal,
  SubBloque,
} from '../../shared/models/planificacion.model';
import {
  Comunidad,
  duracionesDisponibles,
} from '../../shared/models/pregunta.model';
import {
  TipoDePlanificacionDeseada,
  Usuario,
} from '../../shared/models/user.model';
import { getNextWeekIfFriday, getStartOfWeek } from '../../utils/utils';
import { EventsService } from '../services/events.service';

@Component({
  selector: 'app-planificacion-mensual-edit',
  templateUrl: './planificacion-mensual-edit.component.html',
  styleUrl: './planificacion-mensual-edit.component.scss',
})
export class PlanificacionMensualEditComponent {
  fb = inject(FormBuilder);
  formGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: ['', Validators.required],
    mes: [0, Validators.required],
    ano: [0, Validators.required],
    relevancia: this.fb.array([] as Array<Comunidad>),
    esPorDefecto: [false],
    tipoDePlanificacion: [
      TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    ],
  });
  public get relevancia(): FormArray {
    return this.formGroup.get('relevancia') as FormArray;
  }
  public get esPorDefecto() {
    return this.formGroup.get('esPorDefecto') as FormControl;
  }

  public get tipoDePlanificacion() {
    return this.formGroup.get('tipoDePlanificacion') as FormControl;
  }
  public updateCommunitySelection(communities: Comunidad[]) {
    this.relevancia.clear();
    communities.forEach((code) => this.relevancia.push(new FormControl(code)));
  }
  viewportService = inject(ViewportService);
  activedRoute = inject(ActivatedRoute);
  planificacionesService = inject(PlanificacionesService);
  activatedRoute = inject(ActivatedRoute);
  userService = inject(UserService);
  toast = inject(ToastrService);
  router = inject(Router);
  allUsers$ = this.userService
    .getAllUsers$({
      take: 9999999,
      skip: 0,
      searchTerm: '',
    })
    .pipe(map((e) => (e.data ?? []) as Array<Usuario>)) as Observable<any>;
  events: CalendarEvent[] = [];
  viewDate = new Date();
  view: CalendarView = CalendarView.Week;
  public calendarView = CalendarView;
  eventsService = inject(EventsService);
  public isDialogVisible = false;
  public isDialogAsignacionUsuarioVisible = false;
  public pickedEvents: CalendarEvent[] = [];
  public pickedEventsViewDate: Date = new Date();
  private calculatedInitialDate = false;
  public activeStepSeleccionPlantilla = 0;
  public usuariosSeleccionadosId = [] as Array<number>;
  searchTerm: string = ''; // Término de búsqueda
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  public getEventsForDay = this.eventsService.getEventsForDay;
  public getProgressBarColor = this.eventsService.getProgressBarColor;
  public getCompletedSubBlocksForDay =
    this.eventsService.getCompletedSubBlocksForDay;
  public getProgressPercentageForDay =
    this.eventsService.getProgressPercentageForDay;
  duracionesDisponibles = duracionesDisponibles;

  // Add properties for date range
  public startDate: Date | null = null;
  public endDate: Date | null = null;

  filterUsers(users: Array<Usuario>): Array<Usuario> {
    const term = this.searchTerm.toLowerCase();
    return (users ?? []).filter(
      (user) =>
        (user.nombre && user.nombre.toLowerCase().includes(term)) ||
        user.email.toLowerCase().includes(term)
    );
  }

  public uniqueEventsForDay = (events: CalendarEvent[], date: Date) => {
    const res = this.getEventsForDay(events, date);
    const uniqueEvents = new Map();
    res.forEach((event) => {
      if (!uniqueEvents.has(event.title)) {
        uniqueEvents.set(event.title, event);
      }
    });

    return Array.from(uniqueEvents.values());
  };

  public alternarVista = () => {
    this.view =
      this.view == CalendarView.Week ? CalendarView.Month : CalendarView.Week;
  };

  exportToGoogleCalendar(): void {
    const icsContent = this.generateICalendar();
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'calendar-export.ics';
    link.click();

    window.URL.revokeObjectURL(url);
  }

  public generateICalendar = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tecnika Fire//Calendar Export//EN',
    ];
    this.events.forEach((event, index) => {
      const start = new Date(event.start)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0];
      const end = event.end
        ? new Date(event.end).toISOString().replace(/[-:]/g, '').split('.')[0]
        : start;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${
          event.id ||
          `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
        }`,
        `DTSTAMP:${
          new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
        }`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${
          event.meta?.subBloque?.comentarios ||
          'Evento exportado desde Tecnika Fire'
        }`,
        `LOCATION:${event.meta?.location || ''}`,
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  };
  items() {
    return [
      {
        icon: 'fa-solid fa-user-pen',
        tooltipOptions: {
          tooltipLabel: 'Asignar a usuarios',
          position: 'right',
        },
        command: () => {
          this.isDialogAsignacionUsuarioVisible = true;
        },
      },
      {
        disabled: this.view != CalendarView.Week,
        icon: 'fa-regular fa-hand-pointer',
        tooltipOptions: {
          position: 'right',
          tooltipLabel: 'Seleccionar una plantilla semanal',
        },
        command: () => {
          this.activeStepSeleccionPlantilla = 0;
          this.pickedEvents = [];
          this.isDialogVisible = true;
        },
      },
    ];
  }

  private getPlanificacion() {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      tap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        this.expectedRole = expectedRole;
      })
    );
  }

  async confirmarSeleccion() {
    this.isDialogAsignacionUsuarioVisible = false;
    try {
      const res = await firstValueFrom(
        this.planificacionesService.asignarPlanificacionMensual$(
          Number(this.activedRoute.snapshot.paramMap.get('id')),
          this.usuariosSeleccionadosId
        )
      );
      this.toast.success(
        `Planificación asignada exitosamente a ${
          this.usuariosSeleccionadosId.length ?? 0
        } usuarios!`
      );
      this.load();
      this.usuariosSeleccionadosId = [];
    } catch (error) {
      this.toast.error('Hubo un error al asignar la planificación');
    }
  }

  public async pickedPlantilla(plantillaOverview: Partial<PlantillaSemanal>) {
    try {
      // Limpiar datos anteriores
      this.pickedEvents = [];
      this.pickedEventsViewDate = new Date();

      const fullPlantilla = await firstValueFrom(
        this.planificacionesService.getPlantillaSemanalById(
          plantillaOverview.id ?? 0
        )
      );

      if (fullPlantilla && fullPlantilla.subBloques) {
        this.pickedEvents = this.eventsService
          .fromSubbloquesToEvents(fullPlantilla.subBloques)
          .map((e) => {
            e.draggable = false;
            e.resizable = {
              beforeStart: false,
              afterEnd: false,
            };
            return e;
          });

        // Solo calcular la fecha mínima si hay eventos
        if (this.pickedEvents.length > 0) {
          this.pickedEventsViewDate = this.eventsService.calculateMinDate(
            this.pickedEvents
          );
        }
      }
    } catch (error) {
      console.error('Error al cargar la plantilla:', error);
      this.toast.error('Error al cargar la plantilla seleccionada');
      this.pickedEvents = [];
      this.pickedEventsViewDate = new Date();
    }
  }

  onDayClicked(data: any): void {
    const startOfWeek = getStartOfWeek(data.day.date);
    this.viewDate = startOfWeek;

    this.view = CalendarView.Week;
  }

  public applyEventsToCurrentWeek(
    eventsToApplyToCurrentWeek: CalendarEvent[]
  ): void {
    const startOfWeek = getStartOfWeek(this.viewDate); // Inicio de la semana actual
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Fin de la semana actual

    // Filtrar eventos actuales que NO pertenecen a la semana actual
    const eventsOutsideCurrentWeek = this.events.filter(
      (event) =>
        event.start < startOfWeek || (event.end && event.end > endOfWeek)
    );

    // Ajustar los eventos seleccionados a la semana actual
    const adjustedEvents = eventsToApplyToCurrentWeek.map((event) => {
      const dayOffset = event.start.getDay(); // Día de la semana del evento (0 = domingo, 1 = lunes, etc.)
      const adjustedStart = new Date(startOfWeek);
      adjustedStart.setDate(adjustedStart.getDate() + (dayOffset - 1)); // Ajustar al mismo día relativo en la semana actual
      adjustedStart.setHours(
        event.start.getHours(),
        event.start.getMinutes(),
        0,
        0
      ); // Ajustar la hora exacta

      const adjustedEnd = event.end
        ? new Date(
            adjustedStart.getTime() +
              (event.end.getTime() - event.start.getTime())
          ) // Mantener duración
        : undefined;

      return {
        ...event,
        start: adjustedStart,
        end: adjustedEnd,
      };
    });
    eventsToApplyToCurrentWeek.forEach((event) => {
      if (event?.meta?.subBloque as SubBloque) {
        (event?.meta?.subBloque as SubBloque).id = undefined;
        (event?.meta?.subBloque as SubBloque).plantillaId = undefined;
      }
    });
    // Combinar eventos de otras semanas con los eventos ajustados para la semana actual
    this.events = [...eventsOutsideCurrentWeek, ...adjustedEvents];

    // Resetear el estado del diálogo y de los eventos seleccionados
    this.isDialogVisible = false;
    this.pickedEvents = [];

    this.toast.success('Eventos aplicados correctamente a la semana actual');
  }

  constructor(private primengConfig: PrimeNGConfig) {
    this.primengConfig.setTranslation({
      firstDayOfWeek: 1,
      dayNames: [
        'domingo',
        'lunes',
        'martes',
        'miércoles',
        'jueves',
        'viernes',
        'sábado',
      ],
      dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      monthNames: [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ],
      monthNamesShort: [
        'ene',
        'feb',
        'mar',
        'abr',
        'may',
        'jun',
        'jul',
        'ago',
        'sep',
        'oct',
        'nov',
        'dic',
      ],
      today: 'Hoy',
      clear: 'Borrar',
    });
    firstValueFrom(this.getPlanificacion());
  }

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
  }

  ngOnInit(): void {
    this.load();
  }

  private load() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
      this.formGroup.patchValue({
        ano: new Date().getFullYear(),
        mes: new Date().getMonth() + 1,
      });
    } else {
      firstValueFrom(
        this.planificacionesService.getPlanificacionMensualById$(itemId).pipe(
          tap((entry) => {
            const subBloques = entry.subBloques;

            // Convertir los subbloques a eventos
            this.events = this.eventsService.fromSubbloquesToEvents(subBloques);

            // Para alumnos, cargar también los eventos personalizados
            if (this.expectedRole === 'ALUMNO') {
              this.loadEventosPersonalizados(Number(itemId));
            }

            // Configurar eventos para alumnos
            if (this.expectedRole === 'ALUMNO') {
              this.events.forEach((event) => {
                // Permitir arrastre para alumnos
                event.draggable = true;
                // Pero no permitir redimensionar
                event.resizable = {
                  beforeStart: false,
                  afterEnd: false,
                };

                // Aplicar posiciones personalizadas si existen
                if (event.meta?.subBloque?.posicionPersonalizada) {
                  const posicion = new Date(
                    event.meta.subBloque.posicionPersonalizada
                  );
                  // Mantener la duración original
                  const duracion = event.end
                    ? event.end.getTime() - event.start.getTime()
                    : 0;
                  // Establecer la nueva posición
                  event.start = posicion;
                  event.end = new Date(posicion.getTime() + duracion);
                }
              });

              this.userService.getCurrentUser$().subscribe((user: any) => {
                this.startDate = user.validatedAt
                  ? new Date(user.validatedAt)
                  : new Date(user.createdAt);
                this.endDate = getNextWeekIfFriday(new Date());
              });
            }

            this.relevancia.clear();
            entry.relevancia.forEach((e) =>
              this.relevancia.push(new FormControl(e))
            );

            this.usuariosSeleccionadosId = [];
            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();
          })
        )
      );
    }
  }

  // Método para cargar los eventos personalizados - refactorizado
  private loadEventosPersonalizados(planificacionId: number) {
    this.planificacionesService
      .getEventosPersonalizados$(planificacionId)
      .subscribe({
        next: (eventosPersonalizados) => {
          // Agregar los eventos personalizados a la lista de eventos utilizando el servicio
          const nuevosEventos = this.eventsService.fromSubbloquesToEvents(
            [],
            eventosPersonalizados
          );
          this.events = [...this.events, ...nuevosEventos];
        },
        error: (err) => {
          console.error('Error al cargar eventos personalizados:', err);
        },
      });
  }

  public async guardarCambios() {
    const res = await firstValueFrom(
      this.planificacionesService.createPlanificacionMensual$({
        identificador: this.formGroup.value.identificador ?? '',
        descripcion: this.formGroup.value.descripcion ?? '',
        ano: this.formGroup.value.ano ?? new Date().getFullYear(),
        mes: this.formGroup.value.mes ?? new Date().getMonth() + 1,
        id: this.getId() == 'new' ? undefined : Number(this.getId()),
        relevancia:
          (this.formGroup?.value?.relevancia as Array<Comunidad>) ?? [],
        esPorDefecto: this.formGroup.value.esPorDefecto ?? false,
        tipoDePlanificacion:
          this.formGroup.value.tipoDePlanificacion ??
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        subBloques: this.eventsService.fromEventsToSubbloques(
          this.events
        ) as SubBloque[],
      })
    );
    if (this.expectedRole == 'ADMIN') {
      this.toast.success('Planificacion mensual actualizada con exito');

      await this.router.navigate([
        '/app/planificacion/planificacion-mensual/' + res.id,
      ]);
    }
  }

  onDateSelect(event: Date): void {
    const selectedDate = new Date(event);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1; // Mes empieza desde 0

    // Actualizar los valores en el formulario reactivo
    this.formGroup.patchValue({
      mes: month,
      ano: year,
    });

    // Actualizar la vista del calendario
    this.viewDate = new Date(year, month - 1, 1);
  }
}
