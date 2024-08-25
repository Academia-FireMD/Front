import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  BehaviorSubject,
  debounceTime,
  filter,
  firstValueFrom,
  tap,
} from 'rxjs';
import { TestService } from '../../../services/test.service';
import {
  Dificultad,
  SeguridadAlResponder,
} from '../../../shared/models/pregunta.model';
import { Test } from '../../../shared/models/test.model';
import { getAllDifficultades, getLetter } from '../../../utils/utils';

@Component({
  selector: 'app-completar-test',
  templateUrl: './completar-test.component.html',
  styleUrl: './completar-test.component.scss',
})
export class CompletarTestComponent {
  activedRoute = inject(ActivatedRoute);
  testService = inject(TestService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  public indicePregunta = 0;
  public displayFeedbackDialog = false;
  public indiceSeleccionado = new BehaviorSubject(-1);
  public seguroDeLaPregunta = new FormControl(
    SeguridadAlResponder.CIEN_POR_CIENTO
  );
  public getAllDifficultades = getAllDifficultades();
  public dificultadPercibida = new FormControl(
    Dificultad.INTERMEDIO,
    Validators.required
  );
  public feedback = new FormControl('', Validators.required);
  public SeguridadAlResponder = SeguridadAlResponder;
  public getLetter = getLetter;
  public indicePreguntaCorrecta = -1;
  public answeredQuestion = -1;
  private lastLoadedTest!: Test;
  private lastAnsweredQuestion!: { preguntaId: number };
  public testCargado$ = this.testService.getTestById(Number(this.getId())).pipe(
    tap((entry: any) => {
      const parsedTest: Test & { respuestasCount: number } = entry;
      this.indicePregunta = parsedTest.respuestasCount;
      this.lastLoadedTest = entry;
    })
  );

  ngOnInit(): void {
    this.indiceSeleccionado
      .pipe(
        filter((e) => e >= 0),
        debounceTime(500)
      )
      .subscribe(async (data) => {
        this.answeredQuestion - 1;
        this.indicePreguntaCorrecta = -1;
        const res: {
          esCorrecta: false;
          respuestaDada: number;
          pregunta: { respuestaCorrectaIndex: number };
        } = await firstValueFrom(
          this.testService
            .actualizarProgresoTest({
              testId: this.lastLoadedTest.id,
              preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta].id,
              respuestaDada: data,
              seguridad:
                this.seguroDeLaPregunta.value ??
                SeguridadAlResponder.CIEN_POR_CIENTO,
            })
            .pipe(tap((res) => (this.lastAnsweredQuestion = res as any)))
        );
        this.indicePreguntaCorrecta = res.pregunta.respuestaCorrectaIndex;
        this.answeredQuestion = this.indiceSeleccionado.getValue();
      });
  }

  showFeedbackDialog() {
    this.feedback.reset();
    this.displayFeedbackDialog = true;
  }

  public async submitFeedback() {
    const feedback = await firstValueFrom(
      this.testService.sendFeedback({
        preguntaId: this.lastAnsweredQuestion.preguntaId,
        dificultadPercibida:
          this.dificultadPercibida.value ?? Dificultad.INTERMEDIO,
        comentario: this.feedback.value ?? '',
      })
    );
    this.toast.success('Feedback enviado exitosamente');
    this.feedback.reset();
    this.dificultadPercibida.reset();
    this.displayFeedbackDialog = false;
  }

  public siguiente() {
    if (this.indicePregunta == this.lastLoadedTest.preguntas.length - 1) {
      //completado
      console.log('test completado!!');
      this.router.navigate([
        'app/test/alumno/stats-test/' + this.lastLoadedTest.id,
      ]);
    } else {
      this.indicePregunta++;
      if (Math.random() < 0.05) {
        this.showFeedbackDialog();
      }
    }
    this.seguroDeLaPregunta.reset(SeguridadAlResponder.CIEN_POR_CIENTO);
    this.indiceSeleccionado.next(-1);
    this.answeredQuestion - 1;
    this.indicePreguntaCorrecta = -1;
  }

  public showSolution() {
    return (
      this.indiceSeleccionado.getValue() != this.indicePreguntaCorrecta &&
      this.indicePreguntaCorrecta >= 0 &&
      this.answeredQuestion >= 0
    );
  }

  public answeredCurrentQuestion() {
    return (
      this.answeredQuestion == this.indiceSeleccionado.getValue() &&
      this.answeredQuestion >= 0
    );
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }
}
