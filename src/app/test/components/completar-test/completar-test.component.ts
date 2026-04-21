import { Location } from '@angular/common';
import {
  Component,
  effect,
  ElementRef,
  inject,
  Input,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  delay,
  filter,
  firstValueFrom,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { TestService } from '../../../services/test.service';
import { ViewportService } from '../../../services/viewport.service';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import {
  Dificultad,
  Pregunta,
  SeguridadAlResponder,
} from '../../../shared/models/pregunta.model';
import { Respuesta, Test } from '../../../shared/models/test.model';
import { esRolPlataforma, Rol } from '../../../shared/models/user.model';
import {
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
  examenesService = inject(ExamenesService);
  @ViewChildren('activeBlock') activeBlocks!: QueryList<ElementRef>;
  public location = inject(Location);
  auth = inject(AuthService);

  public indicePregunta = signal(0);
  public indicePreguntaChanged = effect(() => {
    const respuesta = this.preguntaRespondida(this.indicePregunta());
    this.seguroDeLaPregunta.patchValue(
      respuesta && respuesta.seguridad
        ? respuesta.seguridad
        : SeguridadAlResponder.CIEN_POR_CIENTO,
    );
  });

  public candidatasPorPregunta = signal<number[]>([]);

  public candidatasSyncEffect = effect(() => {
    const respuesta = this.preguntaRespondida(this.indicePregunta());
    this.candidatasPorPregunta.set(
      respuesta?.respuestasCandidatas
        ? [...respuesta.respuestasCandidatas]
        : [],
    );
  });

  public displayFeedbackDialog = false;
  public displayNavegador = false;
  public displayClonacion = false;
  public displayFalloDialog = false;
  public displayImpugnacionDialog = false;
  public motivoImpugnacion = new FormControl('', [
    Validators.required,
    Validators.minLength(10),
  ]);
  public indiceSeleccionado = new BehaviorSubject(-1);
  public seguroDeLaPregunta = new FormControl(
    SeguridadAlResponder.CIEN_POR_CIENTO,
  );
  public dificultadPercibida = new FormControl(
    Dificultad.INTERMEDIO,
    Validators.required,
  );

  public feedback = new FormControl('', Validators.required);
  public SeguridadAlResponder = SeguridadAlResponder;
  public getLetter = getLetter;
  public indicePreguntaCorrecta = -1;
  public answeredQuestion = -1;

  public lastLoadedTest!: Test & { endsAt: Date };
  private lastAnsweredQuestion!: { preguntaId: number };
  public vistaPrevia = false;
  public modoVerRespuestas = false;

  public obtainSecurityEmojiBasedOnEnum = obtainSecurityEmojiBasedOnEnum;

  public comunicating = false;
  private isProcessingAnswer = false;
  public expectedRole: Rol = Rol.ALUMNO;

  @Input() testId: number | null = null;
  @Input() modoSimulacro: boolean = false;
  @Input() idExamenSimulacro: number | null = null;

  public isModoExamen() {
    return !!this.lastLoadedTest.duration && !!this.lastLoadedTest.endsAt;
  }

  public respuestaCorrecta(pregunta: Pregunta, indiceRespuesta: number) {
    const respuesta = this.modoVerRespuestas
      ? this.preguntaRespondidaPorId(pregunta.id)
      : this.preguntaRespondida();
    return (
      (!this.isModoExamen() || this.modoVerRespuestas || this.vistaPrevia) &&
      (!!respuesta || this.vistaPrevia) &&
      (respuesta?.estado != 'OMITIDA' ||
        this.vistaPrevia ||
        this.modoVerRespuestas) &&
      pregunta.respuestaCorrectaIndex == indiceRespuesta
    );
  }

  public respuestaIncorrecta(pregunta: Pregunta, indiceRespuesta: number) {
    const respuesta = this.modoVerRespuestas
      ? this.preguntaRespondidaPorId(pregunta.id)
      : this.preguntaRespondida();
    return (
      (!this.isModoExamen() || this.modoVerRespuestas) &&
      !!respuesta &&
      respuesta?.estado != 'OMITIDA' &&
      pregunta.respuestaCorrectaIndex != indiceRespuesta &&
      respuesta?.respuestaDada == indiceRespuesta
    );
  }

  public respuestaIncorrectaBlock(indiceRespuesta: number) {
    return (
      (!this.isModoExamen() || this.modoVerRespuestas) &&
      this.preguntaRespondida(indiceRespuesta)?.estado == 'RESPONDIDA' &&
      !this.preguntaRespondida(indiceRespuesta)?.esCorrecta
    );
  }

  public respuestaCorrectaBlock(indiceRespuesta: number) {
    return (
      (!this.isModoExamen() || this.modoVerRespuestas) &&
      this.preguntaRespondida(indiceRespuesta)?.estado == 'RESPONDIDA' &&
      !!this.preguntaRespondida(indiceRespuesta)?.esCorrecta
    );
  }

  public preguntaRespondida(
    specificIndex: number = this.indicePregunta(),
  ): Respuesta | undefined {
    return (this.lastLoadedTest?.respuestas ?? []).find(
      (r) => r.indicePregunta == specificIndex,
    );
  }

  public preguntaRespondidaPorId(preguntaId: number): Respuesta | undefined {
    return (this.lastLoadedTest?.respuestas ?? []).find(
      (r) => r.preguntaId == preguntaId,
    );
  }

  private scrollToActiveBlock(): void {
    const activeElement = this.activeBlocks.toArray()[this.indicePregunta()];
    if (activeElement) {
      (activeElement as any).el.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }

  constructor() {
    this.loadRouteData();
  }

  private async loadRouteData() {
    const data = await firstValueFrom(this.activedRoute.data);
    if (data['vistaPrevia']) {
      this.vistaPrevia = true;
    } else {
      this.vistaPrevia = false;
    }

    if (data['modoVerRespuestas']) {
      this.modoVerRespuestas = true;
    } else {
      this.modoVerRespuestas = false;
    }
  }

  public displayNavegadorFn() {
    this.displayNavegador = true;
    setTimeout(() => {
      this.scrollToActiveBlock();
    }, 100);
  }

  public clickedAnswer(indice: number) {
    if (this.vistaPrevia || this.modoVerRespuestas || this.isProcessingAnswer)
      return;

    const respuesta = this.preguntaRespondida();
    if (!!respuesta && !this.isModoExamen()) {
      return;
    }
    if (
      !!respuesta &&
      respuesta.respuestaDada == indice &&
      this.isModoExamen()
    ) {
      this.processAnswer(-1);
    } else {
      this.indiceSeleccionado.next(indice);
    }
  }

  public clickedPreguntaFromNavegador(indicePregunta: number) {
    this.seguroDeLaPregunta.reset(SeguridadAlResponder.CIEN_POR_CIENTO);
    this.indiceSeleccionado.next(-1);
    this.answeredQuestion = -1; // Corrección en la asignación
    this.indicePreguntaCorrecta = -1;
    // if (this.answeredCurrentQuestion() && this.isModoExamen()) {
    // return;
    //}
    this.indicePregunta.set(indicePregunta);
    this.displayNavegador = false;
  }

  ngOnInit(): void {
    if (this.testId) {
      firstValueFrom(this.loadTest(this.testId.toString()));
    } else {
      this.activedRoute.params.subscribe((params) => {
        const id = params['id'];
        if (id) {
          firstValueFrom(this.loadTest(id));
        }
      });
    }

    this.indiceSeleccionado
      .pipe(filter((e) => e >= 0))
      .subscribe(async (data) => {
        this.processAnswer(data);
      });
    firstValueFrom(this.getRole());
  }

  public updateSecurity(value: SeguridadAlResponder) {
    if (this.vistaPrevia || this.modoVerRespuestas) return;

    const respuesta = this.preguntaRespondida();
    if (!!respuesta && !this.isModoExamen()) {
      return;
    }
    this.seguroDeLaPregunta.patchValue(value);

    // Ajustar candidatas según la nueva seguridad
    if (
      value === SeguridadAlResponder.CIEN_POR_CIENTO ||
      value === SeguridadAlResponder.CERO_POR_CIENTO
    ) {
      this.candidatasPorPregunta.set([]);
    } else {
      const max = value === SeguridadAlResponder.CINCUENTA_POR_CIENTO ? 2 : 3;
      const actuales = this.candidatasPorPregunta();
      // Si había elegida y no estaba incluida, pre-marcarla
      const elegida =
        respuesta?.respuestaDada ?? this.indiceSeleccionado.getValue();
      let base = actuales;
      if (elegida != null && elegida >= 0 && !base.includes(elegida)) {
        base = [...base, elegida];
      }
      // Si excede el máximo, recortar preservando las más recientes
      if (base.length > max) {
        base = base.slice(base.length - max);
      }
      this.candidatasPorPregunta.set(base);
    }

    if (respuesta) {
      // processAnswer incluirá respuestasCandidatas en el payload
      this.indiceSeleccionado.next(respuesta.respuestaDada);
    } else {
      // Sin respuesta aún: persistir el cambio de candidatas derivado del
      // cambio de seguridad (o su limpieza) para cumplir RF6 tras recarga
      this.persistirCandidatas();
    }
  }

  public esCandidata(indice: number): boolean {
    const seguridad = this.seguroDeLaPregunta.value;
    if (
      seguridad !== SeguridadAlResponder.CINCUENTA_POR_CIENTO &&
      seguridad !== SeguridadAlResponder.SETENTA_Y_CINCO_POR_CIENTO
    ) {
      return true;
    }
    return this.candidatasPorPregunta().includes(indice);
  }

  public maxCandidatas(): number {
    const seguridad = this.seguroDeLaPregunta.value;
    if (seguridad === SeguridadAlResponder.CINCUENTA_POR_CIENTO) return 2;
    if (seguridad === SeguridadAlResponder.SETENTA_Y_CINCO_POR_CIENTO) return 3;
    return 0;
  }

  public toggleCandidata(indice: number, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.vistaPrevia || this.modoVerRespuestas) return;
    const max = this.maxCandidatas();
    if (max === 0) return;
    const actuales = this.candidatasPorPregunta();
    if (actuales.includes(indice)) {
      this.candidatasPorPregunta.set(actuales.filter((i) => i !== indice));
    } else {
      const siguientes = [...actuales, indice];
      const recortadas =
        siguientes.length > max
          ? siguientes.slice(siguientes.length - max)
          : siguientes;
      this.candidatasPorPregunta.set(recortadas);
    }
    this.persistirCandidatas();
  }

  public rescatarDescartada(indice: number, event: Event) {
    event.stopPropagation();
    if (!this.candidatasPorPregunta().includes(indice)) {
      this.toggleCandidata(indice);
    }
  }

  private persistirCandidatas() {
    // Persiste siempre (incluso sin respuesta dada) para cumplir RF6:
    // al navegar o recargar, las candidatas deben estar en BD. El backend
    // acepta respuestaDada opcional — crea la Respuesta con null.
    const respuesta = this.preguntaRespondida();
    const respuestaDada = respuesta?.respuestaDada;
    firstValueFrom(
      this.testService
        .actualizarProgresoTest({
          testId: this.lastLoadedTest.id,
          preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta()].id,
          respuestaDada,
          indicePregunta: this.indicePregunta(),
          seguridad:
            this.seguroDeLaPregunta.value ??
            SeguridadAlResponder.CIEN_POR_CIENTO,
          respuestasCandidatas: this.candidatasPorPregunta(),
        })
        .pipe(
          tap((res) => {
            const idx = this.lastLoadedTest.respuestas.findIndex(
              (r) => r.preguntaId === res.preguntaId,
            );
            if (idx >= 0) {
              this.lastLoadedTest.respuestas[idx] = res as any;
            } else {
              this.lastLoadedTest.respuestas.push(res as any);
            }
          }),
        ),
    );
  }

  public async processAnswer(
    respuestaDada?: number,
    mode: 'none' | 'next' | 'before' | 'omitir' = 'none',
  ) {
    if (this.vistaPrevia || this.modoVerRespuestas) {
      if (mode === 'next' || mode === 'omitir') this.siguiente();
      if (mode === 'before') this.atras();
      return;
    }

    if (this.isProcessingAnswer) {
      console.warn(
        'Ya se está procesando una respuesta, ignorando nueva llamada',
      );
      return;
    }

    const existingAnswer = this.preguntaRespondida();
    const hasValidAnswer =
      existingAnswer != null &&
      existingAnswer.estado === 'RESPONDIDA' &&
      existingAnswer.respuestaDada != null &&
      existingAnswer.respuestaDada !== -1;

    if ((mode === 'next' || mode === 'before') && hasValidAnswer) {
      if (mode === 'next') this.siguiente();
      if (mode === 'before') this.atras();
      return;
    }

    const max = this.maxCandidatas();
    if (
      max > 0 &&
      respuestaDada != null &&
      respuestaDada >= 0 &&
      !this.candidatasPorPregunta().includes(respuestaDada)
    ) {
      const actuales = this.candidatasPorPregunta();
      const siguientes = [...actuales, respuestaDada];
      this.candidatasPorPregunta.set(
        siguientes.length > max
          ? siguientes.slice(siguientes.length - max)
          : siguientes,
      );
    }

    this.isProcessingAnswer = true;
    this.answeredQuestion = -1;
    this.indicePreguntaCorrecta = -1;
    this.comunicating = true;

    try {
      const isAnswered =
        existingAnswer?.respuestaDada != null &&
        existingAnswer.respuestaDada !== -1;
      const isOmitida =
        mode == 'omitir' ||
        ((mode == 'next' || mode == 'before') && !isAnswered);

      const res: Respuesta & { pregunta: { respuestaCorrectaIndex: number } } =
        await firstValueFrom(
          this.testService
            .actualizarProgresoTest({
              testId: this.lastLoadedTest.id,
              preguntaId:
                this.lastLoadedTest.preguntas[this.indicePregunta()].id,
              respuestaDada,
              omitida: isOmitida,
              indicePregunta: this.indicePregunta(),
              seguridad:
                this.seguroDeLaPregunta.value ??
                SeguridadAlResponder.CIEN_POR_CIENTO,
              respuestasCandidatas: this.candidatasPorPregunta(),
            })
            .pipe(
              catchError((err) => {
                console.error('Error al procesar respuesta:', err);
                this.toast.error(
                  'Error al procesar la respuesta. Intenta de nuevo.',
                );
                throw err;
              }),
              tap((res) => {
                this.lastAnsweredQuestion = res as any;
                if (res.respuestaDada == -1) this.indiceSeleccionado.next(-1);
              }),
            ),
        );

      // Actualizar respuesta localmente sin hacer GET
      const idx = this.lastLoadedTest.respuestas.findIndex(
        (r) => r.preguntaId === res.preguntaId,
      );
      if (idx >= 0) {
        this.lastLoadedTest.respuestas[idx] = res;
      } else {
        this.lastLoadedTest.respuestas.push(res);
      }

      this.indicePreguntaCorrecta = res?.pregunta?.respuestaCorrectaIndex ?? -1;
      this.answeredQuestion = this.indiceSeleccionado.getValue();

      if (mode == 'next' || mode == 'omitir') this.siguiente();
      if (mode == 'before') this.atras();
    } catch (error) {
      console.error('Error en processAnswer:', error);
    } finally {
      this.comunicating = false;
      this.isProcessingAnswer = false;
    }
  }

  public atras() {
    this.indicePregunta.set(this.indicePregunta() - 1);
  }

  public adelante() {
    this.indicePregunta.set(this.indicePregunta() + 1);
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
      }),
    );
    this.toast.success('Feedback enviado exitosamente');
    this.feedback.reset();
    this.dificultadPercibida.reset();
    this.displayFeedbackDialog = false;
  }

  private getRole() {
    return combineLatest([
      this.activedRoute.data,
      this.activedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      tap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        const { idExamen, modoSimulacro } = queryParams;
        if (!!idExamen) this.idExamenSimulacro = idExamen;
        if (!!modoSimulacro) this.modoSimulacro = !!modoSimulacro;
        this.expectedRole = expectedRole;
      }),
    );
  }

  public async submitReporteFallo(reportDesc: string) {
    const feedback = await firstValueFrom(
      this.reporteFallo.reportarFallo({
        preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta()].id,
        descripcion: reportDesc ?? '',
      }),
    );
    this.toast.success(
      'Reporte de fallo enviado exitosamente. Los administradores revisarán la pregunta.',
    );
    this.displayFalloDialog = false;
  }

  public showImpugnacionDialog() {
    if (!this.isModoExamen()) {
      this.toast.warning('Solo se pueden impugnar preguntas en exámenes');
      return;
    }
    this.motivoImpugnacion.reset();
    this.displayImpugnacionDialog = true;
  }

  public async submitImpugnacion() {
    if (this.motivoImpugnacion.invalid) {
      this.toast.error(
        'El motivo de impugnación debe tener al menos 10 caracteres',
      );
      return;
    }

    try {
      await firstValueFrom(
        this.examenesService.impugnarPreguntaDesdeTest$(
          this.lastLoadedTest.id,
          this.lastLoadedTest.preguntas[this.indicePregunta()].id,
          this.motivoImpugnacion.value ?? '',
        ),
      );
      this.toast.success(
        'Pregunta impugnada exitosamente. Los administradores han sido notificados y revisarán tu solicitud.',
      );
      this.displayImpugnacionDialog = false;
      this.motivoImpugnacion.reset();
      // Recargar el test para mostrar la pregunta como impugnada
      await firstValueFrom(this.loadTest());
    } catch (error: any) {
      this.toast.error(
        error?.error?.message ||
          'Error al impugnar la pregunta. Intenta de nuevo.',
      );
    }
  }

  public siguiente() {
    if (this.indicePregunta() == this.lastLoadedTest.preguntas.length - 1) {
      //completado
      if (
        this.lastLoadedTest.preguntas.length !=
        this.lastLoadedTest.respuestas.length
      ) {
        this.toast.info(
          'Todavia no has terminado el test, te faltan preguntas por responder!',
        );
      } else {
        // if(this.modoSimulacro && this.idExamenSimulacro) {}
        this.navegarAResultados();
      }
    } else {
      this.adelante();
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
    if (this.isModoExamen() && !this.modoVerRespuestas) {
      return false;
    }
    const respuesta = this.preguntaRespondida();
    return (
      !!respuesta && respuesta.estado === 'RESPONDIDA' && !this.comunicating
    );
  }

  public answeredCurrentQuestion() {
    if (this.comunicating) {
      return (
        this.answeredQuestion == this.indiceSeleccionado.getValue() &&
        this.answeredQuestion >= 0 &&
        !this.comunicating
      );
    }
    const respuesta = this.preguntaRespondida();
    return !!respuesta && respuesta.estado === 'RESPONDIDA';
  }

  public getId() {
    return this.testId
      ? this.testId.toString()
      : (this.activedRoute.snapshot.paramMap.get('id') as string);
  }

  private navegarAResultados() {
    if (this.modoSimulacro && this.idExamenSimulacro) {
      const user = this.auth.getCurrentUser();
      if (esRolPlataforma(user?.rol as Rol) && !!user?.validated) {
        this.router.navigate(
          [
            '/app/test/alumno/examen/resultado',
            this.idExamenSimulacro,
            this.lastLoadedTest.id,
          ],
          { queryParams: { goBack: true } },
        );
      } else {
        this.router.navigate([
          '/simulacros/resultado',
          this.idExamenSimulacro,
          this.lastLoadedTest.id,
        ]);
      }
    } else {
      this.router.navigate([
        'app/test/alumno/stats-test/' + this.lastLoadedTest.id,
      ]);
    }
  }

  public async finalizarTest() {
    await firstValueFrom(
      this.testService
        .finalizarTest(this.lastLoadedTest.id)
        .pipe(switchMap(() => this.loadTest())),
    );

    this.navegarAResultados();
  }

  private loadTest(id: string = this.getId()) {
    return this.testService.getTestById(Number(id)).pipe(
      tap(async (entry: any) => {
        await this.loadRouteData();
        const parsedTest: Test & { respuestasCount: number } = entry;
        const initialIndex =
          this.modoVerRespuestas || this.vistaPrevia
            ? 0
            : parsedTest.respuestasCount;
        if (this.lastLoadedTest) {
          this.lastLoadedTest.respuestas = entry.respuestas;
        } else {
          this.lastLoadedTest = entry;
          this.indicePregunta.set(initialIndex);
        }
      }),
      delay(100),
      tap(() => this.scrollToActiveBlock()),
    );
  }
}
