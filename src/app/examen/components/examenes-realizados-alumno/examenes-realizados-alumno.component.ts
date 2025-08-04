import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SharedGridComponent } from '../../../shared/shared-grid/shared-grid.component';
import { ExamenesService } from '../../servicios/examen.service';
import { computed } from '@angular/core';
import { SharedModule } from '../../../shared/shared.module';
import { PrimengModule } from '../../../shared/primeng.module';
import { getNotaClass } from '../../../utils/utils';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ViewportService } from '../../../services/viewport.service';
import { FilterConfig } from '../../../shared/generic-list/generic-list.component';

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
  ];

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.examenesService.getExamenesRealizados$(this.pagination());
    });
  }

  public onFiltersChanged(where: any) {
    // Actualizar la paginación con los nuevos filtros
    this.pagination.set({
      ...this.pagination(),
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
