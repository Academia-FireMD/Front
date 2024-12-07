import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { SubBloque } from '../../shared/models/planificacion.model';
import { SharedGridComponent } from '../../shared/shared-grid/shared-grid.component';

@Component({
  selector: 'app-planificacion-comentarios-overview',
  templateUrl: './planificacion-comentarios-overview.component.html',
  styleUrl: './planificacion-comentarios-overview.component.scss',
})
export class PlanificacionComentariosOverviewComponent extends SharedGridComponent<SubBloque> {
  planificacionesService = inject(PlanificacionesService);
  router = inject(Router);
  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.planificacionesService.getComentariosAlumnos$(
        this.pagination()
      );
    });
  }
}
