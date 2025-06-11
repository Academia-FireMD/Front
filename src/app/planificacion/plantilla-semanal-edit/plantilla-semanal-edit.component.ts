import { Location } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { TemaService } from '../../services/tema.service';
import { ViewportService } from '../../services/viewport.service';
import { PlantillaSemanal, SubBloque } from '../../shared/models/planificacion.model';
import { EventsService } from '../services/events.service';
import { VistaSemanalComponent } from '../vista-semanal/vista-semanal.component';

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
  eventsService = inject(EventsService);
  events: CalendarEvent[] = [];
  viewDate = new Date();
  CalendarView = CalendarView;
  view = CalendarView.Month;
  @ViewChild(VistaSemanalComponent) vistaSemanal!: VistaSemanalComponent;
  public lastLoaded!: PlantillaSemanal;
  formGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: ['', Validators.required],
  });

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
    } else {
      firstValueFrom(
        this.planificacionesService.getPlantillaSemanalById(itemId).pipe(
          tap((entry) => {
            this.lastLoaded = entry;
            const subBloques = entry.subBloques;
            this.events = this.eventsService.fromSubbloquesToEvents(subBloques);
            const minDate = this.eventsService.calculateMinDate(this.events);
            this.viewDate = minDate;
            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();

            this.vistaSemanal.refresh.next();
          })
        )
      );
    }
  }

  public async guardarPlantilla() {
    const subBloques = this.eventsService.fromEventsToSubbloques(this.events);
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
