import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, map } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { TestService } from '../../../services/test.service';
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
  formGroup = this.fb.group({
    numPreguntas: [60, Validators.required],
    dificultad: [Dificultad.BASICO, Validators.required],
    temas: [[], Validators.required],
    generarTestDeRepaso: [false],
  });
  confirmationService = inject(ConfirmationService);
  testService = inject(TestService);
  public preguntas = getNumeroDePreguntas();
  public getAllDifficultades = getAllDifficultades();
  public getAllTemas$ = this.preguntaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas);
    })
  );
  public getAllTestsComenzados$ = this.testService.getAllTest();
  public getFallosCount$ = this.testService.obtenerFallosCount();
  public displayPopupFallosTest = false;

  public async generarTest() {
    try {
      const res = await firstValueFrom(
        this.testService.generarTest(this.formGroup.value as any)
      );
      this.toast.success('Test generado exitosamente!', 'Generación exitosa');
      this.getAllTestsComenzados$ = this.testService.getAllTest();
    } catch (error) {}
  }

  public eliminarTest(idTest: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el test con id ${idTest}, estas seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Si',
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
