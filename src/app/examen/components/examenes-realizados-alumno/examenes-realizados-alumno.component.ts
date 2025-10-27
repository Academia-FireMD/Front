import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { getNotaClass } from '../../../utils/utils';
import { TipoAcceso } from '../../models/examen.model';
import { ExamenesService } from '../../servicios/examen.service';

interface ExamenIntento {
  idTest: number;
  fechaRealizacion: Date;
  nota: number;
  correctas: number;
  incorrectas: number;
  totalPreguntas: number;
}

interface ExamenRealizado {
  idExamen: number;
  titulo: string;
  fechaSolucion: Date;
  fechaActivacion: Date;
  tipoAcceso: TipoAcceso;
  intentos: ExamenIntento[];
  tieneMultiplesIntentos: boolean;
  idTest: number;
  fechaRealizacion: Date;
  nota: number;
  correctas: number;
  incorrectas: number;
  totalPreguntas: number;
}

@Component({
  selector: 'app-examenes-realizados-alumno',
  templateUrl: './examenes-realizados-alumno.component.html',
  styleUrls: ['./examenes-realizados-alumno.component.scss']
})
export class ExamenesRealizadosAlumnoComponent extends SharedGridComponent<ExamenRealizado> {
  private examenesService = inject(ExamenesService);
  public override router = inject(Router);

  showOptionsDialog = false;
  getNotaClass = getNotaClass;
  selectedTest: ExamenRealizado | null = null;

  // Configuración de filtros para el GenericListComponent
  public filters: FilterConfig[] = [
    {
      key: 'fechaRealizacion',
      specialCaseKey: 'rangeDate',
      label: 'Rango de fechas',
      type: 'calendar',
      placeholder: 'Seleccionar rango de fechas',
      dateConfig: {
        selectionMode: 'range',
      },
    },
    {
      key: 'tipoAcceso',
      label: 'Tipo de examen',
      type: 'dropdown',
      placeholder: 'Filtrar por tipo',
      options: [
        { label: 'Exámenes por defecto', value: TipoAcceso.PUBLICO },
        { label: 'Exámenes colaborativos', value: TipoAcceso.COLABORATIVO },
        { label: 'Simulacros', value: TipoAcceso.SIMULACRO },
      ],
    },
  ];

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.examenesService.getExamenesRealizados$(this.pagination());
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros usando el método seguro
    this.updatePaginationSafe({
      where: where,
      skip: 0, // Resetear a la primera página cuando cambian los filtros
    });
  }

  public onItemClick(item: ExamenRealizado) {
    this.selectedTest = item;
    this.showOptionsDialog = true;
  }

  public verResultadosTest(idTest: number): void {
    this.router.navigate(['/app/test/alumno/stats-test/', idTest], {
      queryParams: {
        goBack: true,
      },
    });
  }

  public verRespuestas(testId: number): void {
    this.router.navigate(
      ['/app/test/alumno/realizar-test/modo-ver-respuestas/' + testId],
      {
        queryParams: {
          goBack: true,
        },
      }
    );
  }

  public verLeaderboard(idExamen: number, idTest: number): void {
    this.router.navigate(['/app/test/alumno/examen/resultado', idExamen, idTest], {
      queryParams: {
        goBack: true,
      },
    });
  }

  public canViewResponses(): boolean {
    if (
      !this.selectedTest?.fechaSolucion ||
      !this.selectedTest?.fechaActivacion
    ) {
      return true;
    }

    const fechaSolucion = new Date(this.selectedTest.fechaSolucion);
    const now = new Date();

    return now >= fechaSolucion;
  }
}
