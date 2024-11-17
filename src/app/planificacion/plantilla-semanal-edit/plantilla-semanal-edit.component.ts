import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CalendarEvent,
  CalendarEventTimesChangedEvent,
  CalendarView,
} from 'angular-calendar';
import { debounce } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, map, Subject, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { TemaService } from '../../services/tema.service';
import { ViewportService } from '../../services/viewport.service';
import {
  PlanificacionBloque,
  SubBloque,
} from '../../shared/models/planificacion.model';
const colors: any = {
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
  selector: 'app-plantilla-semanal-edit',
  templateUrl: './plantilla-semanal-edit.component.html',
  styleUrl: './plantilla-semanal-edit.component.scss',
})
export class PlantillaSemanalEditComponent {
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  planificacionesService = inject(PlanificacionesService);
  viewportService = inject(ViewportService);
  temaService = inject(TemaService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);

  public searchTerm = signal('');

  public getAllBloques$ = computed(() => {
    return this.planificacionesService
      .getBloques$({
        skip: 0,
        take: 10,
        searchTerm: this.searchTerm(),
      })
      .pipe(
        map((e) => {
          e.data.forEach((e: any) => (e['template'] = true));
          return e;
        })
      );
  });
  public valueChanged = (event: any) => {
    this.searchTerm.set(event.target.value);
  };
  public debouncedValueChanged = debounce(this.valueChanged, 300);

  CalendarView = CalendarView;

  view = CalendarView.Month;

  viewDate = new Date();

  formGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: ['', Validators.required],
  });

  public colors = colors;

  events: CalendarEvent[] = [];

  activeDayIsOpen = false;

  refresh = new Subject<void>();

  // Propiedad para gestionar el estado del diálogo
  displayDialog = false;

  // Propiedad para almacenar el evento seleccionado
  selectedEvent: CalendarEvent | null = null;

  public isDialogVisible: boolean = false;
  public editSubBloqueData!: SubBloque;

  eventDropped({
    event,
    newStart,
    newEnd,
    allDay,
  }: CalendarEventTimesChangedEvent): void {
    if (typeof allDay !== 'undefined') {
      event.allDay = allDay;
    }

    // Actualizamos las fechas del evento original
    event.start = newStart;
    if (newEnd) {
      event.end = newEnd;
    }
    // Verificamos si el evento tiene `template: true` para decidir si ejecutar el bucle de subBloques
    if ((event as any)['template'] || event.meta?.template) {
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
            draggable: true,
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

    this.refresh.next();
  }

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
  }

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

      this.events = this.events.map((event) =>
        event === this.selectedEvent ? updatedEvent : event
      ) as CalendarEvent<any>[];
      this.refresh.next();
      this.displayDialog = false;
    }
  }

  cancelEdit(): void {
    this.displayDialog = false;
  }

  ngOnInit(): void {
    this.load();
  }

  private load() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
    } else {
      firstValueFrom(
        this.planificacionesService.getPlantillaSemanalById(itemId).pipe(
          tap((entry) => {
            const subBloques = entry.subBloques;

            // Mapea los subBloques a eventos de CalendarEvent
            this.events = subBloques.map((subBloque) => ({
              title: subBloque.nombre,
              start: new Date(subBloque.horaInicio), // Convertir la hora de inicio a Date
              end: new Date(
                new Date(subBloque.horaInicio).getTime() +
                  subBloque.duracion * 60000
              ), // Calcular la hora de finalización
              color: {
                primary: subBloque.color || this.colors.yellow.primary,
                secondary: subBloque.color || this.colors.yellow.secondary,
              },
              draggable: true, // Si los eventos pueden ser arrastrados
              meta: { subBloque }, // Adjuntar el subBloque original para referencia
            }));
            // Encuentra la fecha más temprana entre los eventos
            const minDate = this.events.reduce((earliest, event) => {
              return event.start < earliest ? event.start : earliest;
            }, this.events[0]?.start || new Date());

            // Actualiza el viewDate para enfocarse en la semana del primer evento
            this.viewDate = minDate;
            // Refresca el formulario con los datos de la plantilla
            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();

            // Notifica al calendario que los eventos han cambiado
            this.refresh.next();
          })
        )
      );
    }
  }

  public async guardarPlantilla() {
    // Preparar los datos para enviarlos al servicio como sub-bloques
    const subBloques = this.events.map((event: any) => ({
      horaInicio: event.start, // Fecha y hora completa del evento
      duracion: event.meta?.subBloque?.duracion || event.duracion, // Duración del evento
      nombre: event.title, // Título del sub-bloque o evento
      comentarios: event.meta?.subBloque?.comentarios || event.comentarios, // Comentarios opcionales
      color: event.color?.primary || '', // Color del evento si está definido
    }));

    console.log('SubBloques preparados:', subBloques);

    const res = await firstValueFrom(
      this.planificacionesService.createPlantillaSemanal$({
        identificador: this.formGroup.value.identificador ?? '',
        descripcion: this.formGroup.value.descripcion ?? '',
        id: this.getId() == 'new' ? undefined : Number(this.getId()),
        subBloques: subBloques as Array<SubBloque>, // Enviar directamente los sub-bloques
      })
    );

    this.toast.success('Plantilla semanal actualizada con exito');

    await this.router.navigate([
      '/app/planificacion/plantillas-semanales/' + res.id,
    ]);
    this.load();
  }
}
