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
import { Respuesta, Test } from '../../../shared/models/test.model';
import {
  getAllDifficultades,
  getLetter,
  obtainSecurityEmojiBasedOnEnum,
} from '../../../utils/utils';

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
  public displayNavegador = false;
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

  public feedback = new FormControl('', Validators.required);
  public SeguridadAlResponder = SeguridadAlResponder;
  public getLetter = getLetter;
  public indicePreguntaCorrecta = -1;
  public answeredQuestion = -1;

  public lastLoadedTest!: Test;
  private lastAnsweredQuestion!: { preguntaId: number };

  public testCargado$ = this.getTest();
  public obtainSecurityEmojiBasedOnEnum = obtainSecurityEmojiBasedOnEnum;

  public comunicating = false;

  public isModoExamen() {
    return !!this.lastLoadedTest.duration && !!this.lastLoadedTest.endsAt;
  }

  public preguntaRespondida(indexPregunta: number): Respuesta | undefined {
    return (this.lastLoadedTest?.respuestas ?? []).find(
      (r) => r.indicePregunta == indexPregunta
    );
  }

  private getTest() {
    return this.testService.getTestById(Number(this.getId())).pipe(
      tap((entry: any) => {
        const parsedTest: Test & { respuestasCount: number } = entry;
        if (this.lastLoadedTest) {
          this.lastLoadedTest.respuestas = entry.respuestas;
        } else {
          this.lastLoadedTest = entry;
          this.indicePregunta = parsedTest.respuestasCount;
        }
      })
    );
  }

  ngOnInit(): void {
    this.indiceSeleccionado
      .pipe(filter((e) => e >= 0))
      .subscribe(async (data) => {
        this.processAnswer(data);
      });
  }

  isRespuestaCorrecta(indice: number): boolean {
    return (
      (indice === this.indicePreguntaCorrecta &&
        indice === this.indiceSeleccionado.getValue() &&
        !this.isModoExamen()) ||
      (indice === this.indicePreguntaCorrecta &&
        this.indiceSeleccionado.getValue() !== this.indicePreguntaCorrecta &&
        !this.isModoExamen())
    );
  }

  isRespuestaIncorrecta(indice: number): boolean {
    return (
      indice === this.indiceSeleccionado.getValue() &&
      indice !== this.indicePreguntaCorrecta &&
      !this.isModoExamen()
    );
  }

  public async processAnswer(respuestaDada?: number, omitida = false) {
    this.answeredQuestion = -1;
    this.indicePreguntaCorrecta = -1;
    this.comunicating = true;
    const res: {
      esCorrecta: boolean;
      respuestaDada: number;
      pregunta: { respuestaCorrectaIndex: number };
    } = await firstValueFrom(
      this.testService
        .actualizarProgresoTest({
          testId: this.lastLoadedTest.id,
          preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta].id,
          respuestaDada,
          omitida,
          indicePregunta: this.indicePregunta,
          seguridad:
            this.seguroDeLaPregunta.value ??
            SeguridadAlResponder.CIEN_POR_CIENTO,
        })
        .pipe(
          catchError((err) => {
            this.comunicating = false;
            return of(err);
          }),
          tap((res) => {
            this.lastAnsweredQuestion = res as any;
            firstValueFrom(this.getTest());
          })
        )
    );
    this.comunicating = false;
    this.indicePreguntaCorrecta = res.pregunta.respuestaCorrectaIndex;
    this.answeredQuestion = this.indiceSeleccionado.getValue();
    if (omitida) this.siguiente();
  }

  public atras() {
    this.indicePregunta--;
  }

  public adelante() {
    this.indicePregunta++;
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

  public async submitReporteFallo(reportDesc: string) {
    const feedback = await firstValueFrom(
      this.reporteFallo.reportarFallo({
        preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta].id,
        descripcion: reportDesc ?? '',
      })
    );
    this.toast.success(
      'Reporte de fallo enviado exitosamente. Los administradores revisarán la pregunta.'
    );
    this.displayFalloDialog = false;
  }

  public siguiente() {
    if (this.indicePregunta == this.lastLoadedTest.preguntas.length - 1) {
      //completado
      if (
        this.lastLoadedTest.preguntas.length !=
        this.lastLoadedTest.respuestas.length
      ) {
        this.toast.info(
          'Todavia no has terminado el test, te faltan preguntas por responder!'
        );
      } else {
        this.router.navigate([
          'app/test/alumno/stats-test/' + this.lastLoadedTest.id,
        ]);
      }
    } else {
      this.indicePregunta++;
      //Disabled fo rnow
      // if (Math.random() < 0.05 && !this.isModoExamen()) {
      //   this.showFeedbackDialog();
      // }
    }
    this.seguroDeLaPregunta.reset(SeguridadAlResponder.CIEN_POR_CIENTO);
    this.indiceSeleccionado.next(-1);
    this.answeredQuestion = -1; // Corrección en la asignación
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
}
