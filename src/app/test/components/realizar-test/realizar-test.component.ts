import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, map } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { TemaService } from '../../../services/tema.service';
import { GenerarTestDto, TestService } from '../../../services/test.service';
import { Dificultad } from '../../../shared/models/pregunta.model';
import {
  getAllDifficultades,
  getNumeroDePreguntas,
  groupedTemas,
} from '../../../utils/utils';

@Component({
  selector: 'app-realizar-test',
  templateUrl: './realizar-test.component.html',
  styleUrl: './realizar-test.component.scss',
})
export class RealizarTestComponent {
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  preguntaService = inject(PreguntasService);
  temaService = inject(TemaService);
  confirmationService = inject(ConfirmationService);
  testService = inject(TestService);
  router = inject(Router);

  formGroup = this.fb.group({
    numPreguntas: [60, Validators.required],
    dificultad: [],
    temas: [[], Validators.required],
    generarTestDeRepaso: [false],
    generarTestDeExamen: [false],
    tiempoLimiteEnMinutos: [null],
  });

  public preguntas = getNumeroDePreguntas();
  public getAllDifficultades = getAllDifficultades();
  public getAllTemas$ = this.temaService
    .getAllTemas$()
    .pipe(map((temas) => groupedTemas(temas)));
  public getAllTestsComenzados$ = this.testService.getAllTest();
  public getFallosCount$ = this.testService.obtenerFallosCount();
  public displayPopupFallosTest = false;
  public generandoTest = false;
  ngOnInit(): void {
    const generarTestDeRepasoControl = this.formGroup.get(
      'generarTestDeRepaso'
    ) as FormControl;
    const generarExamenControl = this.formGroup.get(
      'generarTestDeExamen'
    ) as FormControl;

    generarExamenControl.valueChanges.subscribe((data) => {
      if (data) {
        this.formGroup
          .get('tiempoLimiteEnMinutos')
          ?.setValidators(Validators.required);
      } else {
        this.formGroup.get('tiempoLimiteEnMinutos')?.clearValidators();
      }
      this.formGroup.get('tiempoLimiteEnMinutos')?.updateValueAndValidity();
    });

    generarTestDeRepasoControl.valueChanges.subscribe((data) => {
      if (data) {
        generarTestDeRepasoControl.addValidators(Validators.required);
      } else {
        generarTestDeRepasoControl.clearValidators();
      }
      generarTestDeRepasoControl.updateValueAndValidity({
        onlySelf: true,
        emitEvent: false,
      });
    });
  }

  public confirmGenerarTest(event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Estás a punto de comenzar un examen. El tiempo empezará a descontarse automáticamente y serás dirigido a él. ¿Deseas continuar?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        this.generarTest(true);
      },
      reject: () => {},
    });
  }

  public async generarTest(autoRedirect = false) {
    try {
      this.generandoTest = true;
      const numPreguntas = this.formGroup.value.numPreguntas ?? 60;
      const payload = {
        numPreguntas,
        dificultad: this.formGroup.value.dificultad ?? Dificultad.INTERMEDIO,
        temas: this.formGroup.value.temas ?? [],
        generarTestDeRepaso: this.formGroup.value.generarTestDeRepaso,
        duracion: this.formGroup.value.generarTestDeExamen
          ? this.formGroup.value.tiempoLimiteEnMinutos ?? numPreguntas
          : undefined,
      } as GenerarTestDto;

      const res = await firstValueFrom(this.testService.generarTest(payload));
      this.toast.success('Test generado exitosamente!', 'Generación exitosa');
      this.getAllTestsComenzados$ = this.testService.getAllTest();
      this.generandoTest = false;
      if (!!autoRedirect)
        this.router.navigate(['/app/test/alumno/realizar-test/' + res.id]);
    } catch (error) {
      this.toast.error('Error al generar el test.', 'Error');
      this.generandoTest = false;
    }
  }

  public eliminarTest(idTest: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el test con id ${idTest}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.testService.eliminarTest(idTest));
        this.toast.info('Test eliminado exitosamente');
        this.getAllTestsComenzados$ = this.testService.getAllTest();
      },
      reject: () => {},
    });
  }
}
