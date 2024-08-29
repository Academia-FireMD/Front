import { Component, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  BehaviorSubject,
  catchError,
  filter,
  firstValueFrom,
  of,
  tap,
} from 'rxjs';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
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
  reporteFallo = inject(ReportesFalloService);
  public indicePregunta = 0;
  public displayFeedbackDialog = false;
  public displayFalloDialog = false;
  public indiceSeleccionado = new BehaviorSubject(-1);
  public seguroDeLaPregunta = new FormControl(
    SeguridadAlResponder.CIEN_POR_CIENTO
  );
  public getAllDifficultades = getAllDifficultades();
  public dificultadPercibida = new FormControl(
    Dificultad.INTERMEDIO,
    Validators.required
  );
  public descripcionFallo = new FormControl('', [
    Validators.required,
    Validators.minLength(10),
  ]);
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
  public comunicating = false;

  public isModoExamen() {
    return !!this.lastLoadedTest.duration && !!this.lastLoadedTest.endsAt;
  }

  ngOnInit(): void {
    this.indiceSeleccionado
      .pipe(filter((e) => e >= 0))
      .subscribe(async (data) => {
        this.answeredQuestion - 1;
        this.indicePreguntaCorrecta = -1;
        this.comunicating = true;
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
            .pipe(
              catchError((err) => {
                this.comunicating = false;
                return of(err);
              }),
              tap((res) => (this.lastAnsweredQuestion = res as any))
            )
        );
        this.comunicating = false;
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

  public async submitReporteFallo() {
    const feedback = await firstValueFrom(
      this.reporteFallo.reportarFallo({
        preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta].id,
        descripcion: this.descripcionFallo.value ?? '',
      })
    );
    this.toast.success(
      'Reporte de fallo enviado exitosamente. Los administradores revisarán la pregunta.'
    );
    this.descripcionFallo.reset();
    this.displayFalloDialog = false;
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
      if (Math.random() < 0.05 && !this.isModoExamen()) {
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
      this.answeredQuestion >= 0 &&
      !this.comunicating
    );
  }

  public answeredCurrentQuestion() {
    return (
      this.answeredQuestion == this.indiceSeleccionado.getValue() &&
      this.answeredQuestion >= 0 &&
      !this.comunicating
    );
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string;
  }

  public omitirPregunta(){

  }
}
