import { Location } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarEvent } from 'angular-calendar';
import { ToastrService } from 'ngx-toastr';
import { MenuItem } from 'primeng/api';
import { ContextMenu } from 'primeng/contextmenu';
import { firstValueFrom, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import {
  PlantillaSemanal,
  SubBloque,
} from '../../shared/models/planificacion.model';
import { EventsService } from '../services/events.service';
import { VistaSemanalComponent } from '../vista-semanal/vista-semanal.component';

/** Hora por defecto al crear una actividad desde el botón (visible en el calendario). */
const HORA_INICIO_NUEVA_ACTIVIDAD = 9;

@Component({
  selector: 'app-plantilla-semanal-edit',
  templateUrl: './plantilla-semanal-edit.component.html',
  styleUrl: './plantilla-semanal-edit.component.scss',
})
export class PlantillaSemanalEditComponent {
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  planificacionesService = inject(PlanificacionesService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  eventsService = inject(EventsService);
  events: CalendarEvent[] = [];
  viewDate = new Date();
  @ViewChild(VistaSemanalComponent) vistaSemanal!: VistaSemanalComponent;
  public lastLoaded?: PlantillaSemanal;
  /** Evita reenviar el formulario mientras la petición está en curso. */
  public guardando = false;
  formGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: [''],
  });

  /** new y las copias generadas por clonación se presentan como plantilla nueva. */
  public get esNuevaPlantilla(): boolean {
    return (
      this.getId() === 'new' ||
      Boolean(this.lastLoaded?.identificador?.includes('CLON'))
    );
  }

  public get titulo(): string {
    return this.esNuevaPlantilla
      ? 'Nueva plantilla semanal'
      : 'Editar plantilla semanal';
  }

  public get subtitulo(): string {
    return this.esNuevaPlantilla
      ? 'Crea una semana reutilizable para tus planificaciones.'
      : 'Actualiza esta semana reutilizable para tus planificaciones.';
  }

  /**
   * Mismo menú que ofrece VistaSemanal al pulsar una hora. El componente hijo
   * sigue siendo el dueño de las opciones y de los diálogos de alta.
   */
  public get menuActividades(): MenuItem[] {
    return this.vistaSemanal?.getMenuItems('ADMIN') ?? [];
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

  public volver(): void {
    if (this.goBack()) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/app/planificacion/plantillas-semanales']);
  }

  public nombreInvalido(): boolean {
    const control = this.formGroup.controls.identificador;
    return (
      control.invalid &&
      (control.touched || control.dirty || this.formGroup.dirty)
    );
  }

  /**
   * Abre el menú de alta existente anclado al botón. La fecha se toma del día
   * que está mostrando el calendario hijo para no crear la actividad sobre una
   * semana o una hora obsoletas.
   */
  public abrirMenuActividades(cm: ContextMenu, evento: Event): void {
    const vista = this.vistaSemanal;
    if (!vista) return;
    const items = vista.getMenuItems('ADMIN');
    if (!items?.length) return;
    cm.model = items;
    vista.onTimeClicked(
      {
        date: this.fechaActividadDesdeVista(vista),
        sourceEvent: this.eventoAnclado(evento),
      },
      cm,
    );
  }

  public async guardarPlantilla(): Promise<void> {
    if (this.guardando) return;
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }

    this.guardando = true;
    try {
      const subBloques = this.eventsService.fromEventsToSubbloques(this.events);
      const res = await firstValueFrom(
        this.planificacionesService.createPlantillaSemanal$({
          identificador: this.formGroup.value.identificador ?? '',
          descripcion: this.formGroup.value.descripcion ?? '',
          id: this.getId() == 'new' ? undefined : Number(this.getId()),
          subBloques: subBloques as Array<SubBloque>,
        }),
      );

      this.toast.success('Plantilla semanal guardada correctamente');

      await this.router.navigate([
        '/app/planificacion/plantillas-semanales/' + res.id,
      ]);
      this.load();
    } finally {
      this.guardando = false;
    }
  }

  private load() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
    } else {
      firstValueFrom(
        this.planificacionesService.getPlantillaSemanalById(itemId).pipe(
          tap((entry) => {
            this.lastLoaded = entry;
            const subBloques = entry.subBloques ?? [];
            this.events = this.eventsService.fromSubbloquesToEvents(subBloques);
            const minDate = this.eventsService.calculateMinDate(this.events);
            this.viewDate = minDate;
            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();

            this.vistaSemanal?.refresh.next();
          }),
        ),
      );
    }
  }

  private fechaActividadDesdeVista(vista: VistaSemanalComponent): Date {
    const referencia = this.diaVisibleDeVista(vista);
    const base =
      referencia instanceof Date && !isNaN(referencia.getTime())
        ? referencia
        : new Date();
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      HORA_INICIO_NUEVA_ACTIVIDAD,
      0,
      0,
      0,
    );
  }

  /**
   * En móvil la tira de días puede mostrar un día distinto de la referencia
   * semanal. A expone diaMovil como día realmente visible; se usa solo si
   * existe y es válido, con viewDate como respaldo compatible.
   */
  private diaVisibleDeVista(vista: VistaSemanalComponent): Date {
    const vistaMovil = vista as VistaSemanalComponent & {
      esMovil?: () => boolean;
      diaMovil?: Date | null;
    };
    const diaMovil = vistaMovil.diaMovil;
    if (
      vistaMovil.esMovil?.() === true &&
      diaMovil instanceof Date &&
      !isNaN(diaMovil.getTime())
    ) {
      return diaMovil;
    }
    return vista.viewDate;
  }

  /**
   * Normaliza el evento para que el menú aparezca junto al botón también
   * cuando la activación llega por teclado (sin coordenadas de ratón).
   */
  private eventoAnclado(evento: Event): MouseEvent {
    const objetivo = (evento.currentTarget ??
      evento.target) as HTMLElement | null;
    const rect = objetivo?.getBoundingClientRect?.();
    if (!objetivo || !rect) return evento as MouseEvent;
    return {
      target: objetivo,
      currentTarget: objetivo,
      pageX: rect.left + window.scrollX,
      pageY: rect.bottom + window.scrollY,
      stopPropagation: () => evento.stopPropagation(),
      preventDefault: () => evento.preventDefault(),
    } as unknown as MouseEvent;
  }
}
