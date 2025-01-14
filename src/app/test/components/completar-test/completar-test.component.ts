import {
  Component,
  ElementRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  BehaviorSubject,
  catchError,
  delay,
  filter,
  firstValueFrom,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { TestService } from '../../../services/test.service';
import { ViewportService } from '../../../services/viewport.service';
import {
  Dificultad,
  Pregunta,
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
  viewportService = inject(ViewportService);
  @ViewChildren('activeBlock') activeBlocks!: QueryList<ElementRef>;

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

  public lastLoadedTest!: Test & { endsAt: Date };
  private lastAnsweredQuestion!: { preguntaId: number };

  public obtainSecurityEmojiBasedOnEnum = obtainSecurityEmojiBasedOnEnum;

  public comunicating = false;

  public isModoExamen() {
    return !!this.lastLoadedTest.duration && !!this.lastLoadedTest.endsAt;
  }

  public respuestaCorrecta(pregunta: Pregunta, indiceRespuesta: number) {
    return (
      !this.isModoExamen() &&
      !!this.preguntaRespondida() &&
      this.preguntaRespondida()?.estado != 'OMITIDA' &&
      pregunta.respuestaCorrectaIndex == indiceRespuesta
    );
  }

  public respuestaIncorrecta(pregunta: Pregunta, indiceRespuesta: number) {
    return (
      !this.isModoExamen() &&
      !!this.preguntaRespondida() &&
      this.preguntaRespondida()?.estado != 'OMITIDA' &&
      pregunta.respuestaCorrectaIndex != indiceRespuesta &&
      this.preguntaRespondida()?.respuestaDada == indiceRespuesta
    );
  }

  public preguntaRespondida(
    specificIndex: number = this.indicePregunta
  ): Respuesta | undefined {
    return (this.lastLoadedTest?.respuestas ?? []).find(
      (r) => r.indicePregunta == specificIndex
    );
  }

  private scrollToActiveBlock(): void {
    const activeElement = this.activeBlocks.toArray()[this.indicePregunta];
    if (activeElement) {
      (activeElement as any).el.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
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
      }),
      delay(100),
      tap(() => this.scrollToActiveBlock())
    );
  }

  constructor() {
    firstValueFrom(this.getTest());
  }

  public displayNavegadorFn() {
    this.displayNavegador = true;
    setTimeout(() => {
      this.scrollToActiveBlock();
    }, 100);
  }

  ngOnInit(): void {
    this.indiceSeleccionado
      .pipe(filter((e) => e >= 0))
      .subscribe(async (data) => {
        this.processAnswer(data);
      });
  }

  public async processAnswer(
    respuestaDada?: number,
    mode: 'none' | 'next' | 'before' | 'omitir' = 'none'
  ) {
    this.answeredQuestion = -1;
    this.indicePreguntaCorrecta = -1;
    this.comunicating = true;
    const answered = this.preguntaRespondida();
    const isAnswered = !!answered?.respuestaDada;
    const isOmitida =
      mode == 'omitir' || ((mode == 'next' || mode == 'before') && !isAnswered);
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
          omitida: isOmitida,
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
    this.indicePreguntaCorrecta = res?.pregunta?.respuestaCorrectaIndex ?? -1;
    this.answeredQuestion = this.indiceSeleccionado.getValue();
    if (mode == 'next' || mode == 'omitir') this.siguiente();
    if (mode == 'before') this.atras();
    this.comunicating = false;
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

  public async finalizarTest() {
    await firstValueFrom(
      this.testService
        .finalizarTest(this.lastLoadedTest.id)
        .pipe(switchMap(() => this.getTest()))
    );
    this.router.navigate([
      'app/test/alumno/stats-test/' + this.lastLoadedTest.id,
    ]);
  }
}
