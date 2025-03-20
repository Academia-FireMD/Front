import { Component, inject, Input } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { PreguntasService } from '../../services/preguntas.service';
import { TemaService } from '../../services/tema.service';
import { GenerarTestDto, TestService } from '../../services/test.service';
import {
  getAllDifficultades,
  getNumeroDePreguntas
} from '../../utils/utils';
import { Dificultad } from '../models/pregunta.model';

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
  @Input() mode: 'injected' | 'default' = 'default';

  formGroup = this.fb.group({
    numPreguntas: [60, Validators.required],
    dificultad: [[Dificultad.INTERMEDIO]],
    temas: [[], Validators.required],
    generarTestDeRepaso: [false],
    generarTestDeExamen: [false],
    tiempoLimiteEnMinutos: [null],
  });

  public preguntas = getNumeroDePreguntas();
  public getAllDifficultades = getAllDifficultades(false, true);
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

  public confirmGenerarTest(event: Event, esTipoExamen = false) {
    const mensaje = esTipoExamen
      ? `Estás a punto de comenzar un examen. El tiempo empezará a descontarse automáticamente y serás dirigido a él. ¿Deseas continuar?`
      : `Estás a punto de comenzar un test. Serás redirigido a él. ¿Deseas continuar?`;

    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: mensaje,
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
      reject: () => { },
    });
  }

  public generateDto() {
    const numPreguntas = this.formGroup.value.numPreguntas ?? 60;
    const payload = {
      numPreguntas,
      dificultades: this.formGroup.value.dificultad ?? [
        Dificultad.INTERMEDIO,
      ],
      temas: this.formGroup.value.temas ?? [],
      generarTestDeRepaso: this.formGroup.value.generarTestDeRepaso,
      duracion: this.formGroup.value.generarTestDeExamen
        ? this.formGroup.value.tiempoLimiteEnMinutos ?? numPreguntas
        : undefined,
    } as GenerarTestDto;
    return payload;
  }

  public async generarTest(autoRedirect = false) {
    try {
      this.generandoTest = true;
      const payload = this.generateDto();
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
      reject: () => { },
    });
  }
}
