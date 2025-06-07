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
  styleUrls: ['./examenes-realizados-alumno.component.scss'],
})
export class ExamenesRealizadosAlumnoComponent extends SharedGridComponent<ExamenRealizado> {
  private examenesService = inject(ExamenesService);
  public override router = inject(Router);

  showOptionsDialog = false;
  getNotaClass = getNotaClass;
  selectedRangeDates = new FormControl([], Validators.required);
  selectedTest: ExamenRealizado | null = null;

  constructor() {
    super();
    this.fetchItems$ = computed(() => {
      return this.examenesService.getExamenesRealizados$(this.pagination());
    });

    this.selectedRangeDates.valueChanges.subscribe((dates: any) => {
      if (dates) {
        this.pagination.set({
          ...this.pagination(),
          where: {
            createdAt: {
              gte: dates[0] ?? new Date(),
              lte: dates[1] ?? new Date(),
            },
          },
        });
      } else {
        this.pagination.set({
          ...this.pagination(),
          where: {},
        });
      }
    });
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
