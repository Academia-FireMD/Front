import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, map } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { PreguntasService } from '../../../services/preguntas.service';
import { TemaService } from '../../../services/tema.service';
import { GenerarTestDto } from '../../../services/test.service';
import { Dificultad } from '../../../shared/models/pregunta.model';
import {
  getAllDifficultades,
  getNumeroDePreguntas,
  groupedTemas,
} from '../../../utils/utils';

@Component({
  selector: 'app-realizar-flash-card-test',
  templateUrl: './realizar-flash-card-test.component.html',
  styleUrl: './realizar-flash-card-test.component.scss',
})
export class RealizarFlashCardTestComponent {
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  preguntaService = inject(PreguntasService);
  temaService = inject(TemaService);
  confirmationService = inject(ConfirmationService);
  flashcardService = inject(FlashcardDataService);
  public getAllTemas$ = this.temaService
    .getAllTemas$()
    .pipe(map((temas) => groupedTemas(temas)));

  formGroup = this.fb.group({
    numPreguntas: [60, Validators.required],
    dificultad: [Dificultad.BASICO, Validators.required],
    temas: [[], Validators.required],
    generarTestDeRepaso: [false],
  });
  public getFallosCount$ = this.flashcardService.obtenerFallosCount();
  public getAllTestsComenzados$ = this.flashcardService.getAllTest();
  public preguntas = getNumeroDePreguntas();
  public getAllDifficultades = getAllDifficultades(true);

  public async generarTest() {
    try {
      const numPreguntas = this.formGroup.value.numPreguntas ?? 60;
      const payload = {
        numPreguntas,
        dificultad: this.formGroup.value.dificultad ?? Dificultad.BASICO,
        temas: this.formGroup.value.temas ?? [],
        generarTestDeRepaso: this.formGroup.value.generarTestDeRepaso,
      } as GenerarTestDto;

      const res = await firstValueFrom(
        this.flashcardService.generarTest(payload)
      );
      this.toast.success('Test generado exitosamente!', 'Generación exitosa');
      this.getAllTestsComenzados$ = this.flashcardService.getAllTest();
    } catch (error) {
      this.toast.error('Error al generar el test.', 'Error');
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
        await firstValueFrom(this.flashcardService.eliminarTest(idTest));
        this.toast.info('Test eliminado exitosamente');
        this.getAllTestsComenzados$ = this.flashcardService.getAllTest();
      },
      reject: () => {},
    });
  }
}