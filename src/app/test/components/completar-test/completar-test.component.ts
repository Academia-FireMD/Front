import {
  parametrosPracticaLibrillo,
  temaDePracticaLibrillo,
} from '../../../estudio/previa/previa-librillos';
import type {
  OrigenPracticaLibrillo,
  ReferenciaPracticaLibrillo,
} from '../../../estudio/previa/librillo-practica.service';
import { Location } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  delay,
  EMPTY,
  filter,
  firstValueFrom,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { TestService } from '../../../services/test.service';
import { ViewportService } from '../../../services/viewport.service';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { StudyAssistantService } from '../../../shared/services/study-assistant.service';
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
import { construirMensajePregunta } from '../../components/test-stats/preguntas-falladas.util';

interface CandidatasSnapshot {
  testId: number;
  preguntaId: number;
  indicePregunta: number;
  respuestaDada: number | null | undefined;
  seguridad: SeguridadAlResponder;
  respuestasCandidatas: number[];
}

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
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  @ViewChildren('activeBlock') activeBlocks!: QueryList<ElementRef>;
  public location = inject(Location);
  auth = inject(AuthService);
  private studyAssistant = inject(StudyAssistantService);

  public indicePregunta = signal(0);
  public candidatasPorPregunta = signal<number[]>([]);
  // Modo dedicado de selección de candidatas: cuando está activo, los clicks
  // en las respuestas togglean candidatas en vez de registrar la respuesta
  // final. Se activa al pulsar "Marcar las que dudo" y se desactiva al
  // pulsar "Listo" explícitamente o al navegar a otra pregunta.
  public modoSeleccionCandidatas = signal(false);
  private candidatasTrigger$ = new Subject<CandidatasSnapshot>();
  private candidatasLibrilloEnCurso = Promise.resolve();
  private destruido = false;
  private finalizando = false;
  private resultadoEmitido = false;
  readonly estadoCarga = signal<'cargando' | 'disponible' | 'error'>(
    'cargando',
  );
  readonly tiempoAgotadoLibrillo = signal(false);

  // Nota: la sincronización del estado derivado de indicePregunta
  // (seguridad, candidatas, modo) NO se hace con un effect() — Angular 18
  // prohíbe escrituras a signals dentro de effects por defecto (NG0600) y
  // el error abortaría el set silenciosamente. En su lugar llamamos
  // `sincronizarEstadoPregunta` explícitamente en los handlers de
  // navegación: atras(), adelante(), clickedPreguntaFromNavegador() y
  // tras la carga inicial del test.

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

  public lastLoadedTest!: Test;
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
  /**
   * Modo embebido (p.ej. bloque TEST dentro del aula de cursos): al finalizar
   * NO se navega a la pantalla de resultados (eso sacaría al alumno del aula);
   * en su lugar se emite `finalizado` y el host decide qué hacer (marcar el
   * bloque completado, mostrar un resumen inline, etc.). Gateado y por defecto
   * `false` → los flujos por ruta (test/examen/simulacro) quedan intactos.
   */
  @Input() embedded = false;
  @Output() finalizado = new EventEmitter<{ testId: number }>();
  @Input() origenLibrillo?: OrigenPracticaLibrillo;
  @Input() revisarLibrillo = false;
  @Input() referenciasLibrillo: ReferenciaPracticaLibrillo[] = [];
  @Output() verReferenciaLibrillo =
    new EventEmitter<ReferenciaPracticaLibrillo>();

  public isModoExamen() {
    return !!this.lastLoadedTest?.duration && !!this.lastLoadedTest?.endsAt;
  }

  public corrigeAlCerrar() {
    return this.origenLibrillo?.modo === 'simulacro' || this.isModoExamen();
  }

  public referenciaPregunta(preguntaId: number) {
    if (
      !this.origenLibrillo ||
      (!this.modoVerRespuestas && !this.showSolution())
    ) {
      return undefined;
    }
    return this.referenciasLibrillo.find(
      (referencia) => referencia.preguntaId === preguntaId,
    );
  }

  public puedeElegirLibrillo() {
    return (
      !this.vistaPrevia &&
      !this.modoVerRespuestas &&
      !this.comunicating &&
      !this.tiempoAgotadoLibrillo() &&
      (this.corrigeAlCerrar() ||
        !this.preguntaRespondida() ||
        this.modoSeleccionCandidatas())
    );
  }

  public respuestaCorrecta(pregunta: Pregunta, indiceRespuesta: number) {
    const respuesta = this.modoVerRespuestas
      ? this.preguntaRespondidaPorId(pregunta.id)
      : this.preguntaRespondida();
    return (
      (!this.corrigeAlCerrar() || this.modoVerRespuestas || this.vistaPrevia) &&
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
      (!this.corrigeAlCerrar() || this.modoVerRespuestas) &&
      !!respuesta &&
      respuesta?.estado != 'OMITIDA' &&
      Number.isInteger(pregunta.respuestaCorrectaIndex) &&
      pregunta.respuestaCorrectaIndex != indiceRespuesta &&
      respuesta?.respuestaDada == indiceRespuesta
    );
  }

  public fueCandidata(pregunta: Pregunta, indiceRespuesta: number): boolean {
    if (!this.modoVerRespuestas) return false;
    const respuesta = this.preguntaRespondidaPorId(pregunta.id);
    return !!respuesta?.respuestasCandidatas?.includes(indiceRespuesta);
  }

  public respuestaIncorrectaBlock(indiceRespuesta: number) {
    return (
      (!this.corrigeAlCerrar() || this.modoVerRespuestas) &&
      this.preguntaRespondida(indiceRespuesta)?.estado == 'RESPONDIDA' &&
      !this.preguntaRespondida(indiceRespuesta)?.esCorrecta
    );
  }

  public respuestaCorrectaBlock(indiceRespuesta: number) {
    return (
      (!this.corrigeAlCerrar() || this.modoVerRespuestas) &&
      this.preguntaRespondida(indiceRespuesta)?.estado == 'RESPONDIDA' &&
      !!this.preguntaRespondida(indiceRespuesta)?.esCorrecta
    );
  }

  /**
   * Devuelve la Respuesta REAL de la pregunta (respondida u omitida).
   * Por defecto excluye drafts (estado='NO_RESPONDIDA'). Los drafts son
   * filas que guardan candidatas/seguridad antes de responder; no son
   * respuestas desde la óptica de la UI (no deben bloquear clickedAnswer
   * ni pintar colores). Para leer un draft, pasa `incluirDrafts = true`.
   */
  public preguntaRespondida(
    specificIndex: number = this.indicePregunta(),
    incluirDrafts = false,
  ): Respuesta | undefined {
    return (this.lastLoadedTest?.respuestas ?? []).find(
      (r) =>
        r.indicePregunta == specificIndex &&
        (incluirDrafts || (r as any).estado !== 'NO_RESPONDIDA'),
    );
  }

  /** Incluye drafts. Uso: restaurar candidatas/seguridad al navegar. */
  public respuestaOBorrador(indice: number): Respuesta | undefined {
    return this.preguntaRespondida(indice, true);
  }

  public preguntaRespondidaPorId(preguntaId: number): Respuesta | undefined {
    return (this.lastLoadedTest?.respuestas ?? []).find(
      (r) => r.preguntaId == preguntaId,
    );
  }

  /**
   * Devuelve la seguridad efectiva de una pregunta desde BD (incluye
   * drafts con estado='NO_RESPONDIDA'). Usado por el navegador lateral
   * para pintar el emoji.
   */
  public getSeguridadDePregunta(
    indice: number,
  ): SeguridadAlResponder | undefined {
    return this.respuestaOBorrador(indice)?.seguridad ?? undefined;
  }

  /** True si la pregunta tiene candidatas marcadas (persistidas en BD). */
  public tieneCandidatasMarcadas(indice: number): boolean {
    const respuesta = this.respuestaOBorrador(indice);
    return !!respuesta?.respuestasCandidatas?.length;
  }

  private scrollToActiveBlock(): void {
    const activeElement = this.activeBlocks?.toArray()[this.indicePregunta()];
    if (activeElement) {
      (activeElement as any).el.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
    });
    this.loadRouteData();
  }

  private async loadRouteData() {
    const data = await firstValueFrom(this.activedRoute.data);
    if (data['vistaPrevia']) {
      this.vistaPrevia = true;
    } else {
      this.vistaPrevia = false;
    }

    if (this.revisarLibrillo || data['modoVerRespuestas']) {
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
    if (
      this.vistaPrevia ||
      this.modoVerRespuestas ||
      this.isProcessingAnswer ||
      this.finalizando ||
      this.tiempoAgotadoLibrillo()
    )
      return;

    const respuesta = this.preguntaRespondida();
    if (!!respuesta && !this.corrigeAlCerrar()) {
      return;
    }
    if (
      !!respuesta &&
      respuesta.respuestaDada == indice &&
      this.corrigeAlCerrar()
    ) {
      this.processAnswer(-1);
    } else {
      this.indiceSeleccionado.next(indice);
    }
  }

  public clickedPreguntaFromNavegador(indicePregunta: number) {
    if (this.origenLibrillo && this.comunicating) return;
    // Los resets de UI (seguridad/indiceSeleccionado/answeredQuestion/
    // indicePreguntaCorrecta) los hace sincronizarEstadoPregunta.
    this.indicePregunta.set(indicePregunta);
    this.sincronizarEstadoPregunta(indicePregunta);
    this.displayNavegador = false;
  }

  ngOnInit(): void {
    if (this.testId) {
      this.cargar(this.testId.toString());
    } else {
      this.activedRoute.params
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => {
          const id = params['id'];
          if (id) this.cargar(id);
        });
    }

    this.indiceSeleccionado
      .pipe(
        filter((e) => e >= 0),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(async (data) => {
        this.processAnswer(data);
      });
    this.initCandidatasPersistence();
    firstValueFrom(this.getRole());
  }

  public updateSecurity(value: SeguridadAlResponder) {
    if (this.vistaPrevia || this.modoVerRespuestas) return;
    if (
      this.origenLibrillo &&
      (this.comunicating || this.tiempoAgotadoLibrillo())
    )
      return;

    const respuesta = this.preguntaRespondida();
    if (!!respuesta && !this.corrigeAlCerrar()) {
      return;
    }
    this.seguroDeLaPregunta.patchValue(value);

    // Ajustar candidatas según la nueva seguridad. El modo selección NO
    // se activa automáticamente aquí — debe pulsarse "Marcar las que
    // dudo" explícitamente. Cambiar la seguridad sí cierra el modo
    // (por si estaba abierto) para que el alumno vea el cambio con claridad.
    this.modoSeleccionCandidatas.set(false);
    if (
      value === SeguridadAlResponder.CIEN_POR_CIENTO ||
      value === SeguridadAlResponder.CERO_POR_CIENTO
    ) {
      this.candidatasPorPregunta.set([]);
    } else {
      // 75% → cap 2, 50% → cap 3 (alineado con los labels UI)
      const max =
        value === SeguridadAlResponder.SETENTA_Y_CINCO_POR_CIENTO ? 2 : 3;
      const actuales = this.candidatasPorPregunta();
      // Si excede el máximo del nuevo nivel, recortar preservando las
      // más recientes. No pre-marcamos la elegida porque el modo no
      // se abre automáticamente: el alumno decide cuándo y qué marcar.
      const base =
        actuales.length > max
          ? actuales.slice(actuales.length - max)
          : actuales;
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

  /**
   * Handler unificado para clicks en una opción de respuesta.
   * Si estamos en modo selección de candidatas, toggle candidata.
   * Si no, selecciona la respuesta como contestación final.
   */
  public handleRespuestaClick(indice: number) {
    if (this.vistaPrevia || this.modoVerRespuestas) return;
    if (this.origenLibrillo && !this.puedeElegirLibrillo()) return;
    if (this.modoSeleccionCandidatas()) {
      // En modo, los clicks togglean candidatas. El modo permanece
      // abierto hasta que el alumno pulse "Listo" explícitamente —
      // así sabe que está cambiando de modo intencionalmente.
      this.toggleCandidata(indice);
      return;
    }
    this.clickedAnswer(indice);
  }

  /**
   * Activa el modo selección de candidatas. Requiere haber elegido antes
   * un nivel de seguridad intermedio (50% o 75%). En modo, los clicks en
   * las respuestas togglean candidatas sin registrar respuesta final.
   */
  public abrirSeleccionCandidatas() {
    if (this.maxCandidatas() === 0 || this.tiempoAgotadoLibrillo()) return;
    this.modoSeleccionCandidatas.set(true);
  }

  // Alias retenido por si hay llamadores externos del template antiguo.
  public reabrirSeleccionCandidatas() {
    this.abrirSeleccionCandidatas();
  }

  public terminarSeleccionCandidatas() {
    this.modoSeleccionCandidatas.set(false);
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
    // Alineado con los labels del UI:
    //   75% → "Dudo entre 2" → cap 2.
    //   50% → "Dudo entre 3" → cap 3.
    const seguridad = this.seguroDeLaPregunta.value;
    if (seguridad === SeguridadAlResponder.SETENTA_Y_CINCO_POR_CIENTO) return 2;
    if (seguridad === SeguridadAlResponder.CINCUENTA_POR_CIENTO) return 3;
    return 0;
  }

  public toggleCandidata(indice: number, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.vistaPrevia || this.modoVerRespuestas) return;
    if (
      this.origenLibrillo &&
      (this.comunicating || this.tiempoAgotadoLibrillo())
    )
      return;
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
    // Captura snapshot inmutable al momento del toggle/cambio de seguridad.
    // Sin snapshot, el debounce leería el estado 300ms más tarde y podría
    // persistir contra la pregunta equivocada si el alumno navegó rápido.
    const indice = this.indicePregunta();
    const pregunta = this.lastLoadedTest?.preguntas?.[indice];
    if (!pregunta) return;
    const respuesta = this.preguntaRespondida(indice);
    const seguridad =
      this.seguroDeLaPregunta.value ?? SeguridadAlResponder.CIEN_POR_CIENTO;
    const candidatas = [...this.candidatasPorPregunta()];

    const snapshot: CandidatasSnapshot = {
      testId: this.lastLoadedTest.id,
      preguntaId: pregunta.id,
      indicePregunta: indice,
      respuestaDada: respuesta?.respuestaDada,
      seguridad,
      respuestasCandidatas: candidatas,
    };
    if (this.origenLibrillo) {
      this.candidatasLibrilloEnCurso = this.candidatasLibrilloEnCurso.then(
        async () => {
          if (this.destruido) return;
          await firstValueFrom(
            this.guardarCandidatas(snapshot).pipe(
              takeUntilDestroyed(this.destroyRef),
            ),
            { defaultValue: undefined },
          );
        },
      );
    } else {
      this.candidatasTrigger$.next(snapshot);
    }
  }

  /**
   * Carga el estado completo (seguridad + candidatas) de la pregunta en
   * `indice` desde las respuestas persistidas en BD (incluye drafts con
   * estado='NO_RESPONDIDA'). Siempre cierra el modo selección y limpia
   * el signal antes de aplicar el nuevo estado, evitando que datos de
   * la pregunta anterior "se peguen".
   */
  private sincronizarEstadoPregunta(indice: number) {
    // Reset inmediato para garantizar que no quede state residual de la
    // pregunta anterior mientras resolvemos el estado nuevo. Incluye los
    // flags de UI (indice seleccionado, answered, índice correcto) que
    // antes se reseteaban en siguiente()/clickedPreguntaFromNavegador y
    // pisaban el estado que esta función restauraba.
    this.modoSeleccionCandidatas.set(false);
    this.candidatasPorPregunta.set([]);
    this.indiceSeleccionado.next(-1);
    this.answeredQuestion = -1;
    this.indicePreguntaCorrecta = -1;

    // Al restaurar estado, INCLUIMOS drafts (incluirDrafts=true) para
    // recuperar candidatas/seguridad guardadas sin respuesta final.
    const respuesta = this.respuestaOBorrador(indice);
    const seguridad: SeguridadAlResponder =
      respuesta?.seguridad ?? SeguridadAlResponder.CIEN_POR_CIENTO;
    const candidatas: number[] = respuesta?.respuestasCandidatas
      ? [...respuesta.respuestasCandidatas]
      : [];

    this.seguroDeLaPregunta.patchValue(seguridad);
    this.candidatasPorPregunta.set(candidatas);
    // Forzar CD por si el template se renderizó antes de que el signal
    // fuera actualizado (p.ej. primer load: el componente ya renderizó
    // con datos vacíos y sincronizarEstadoPregunta se invoca async tras
    // la respuesta del API). Sin markForCheck, maxCandidatas() lee el
    // FormControl.value (no-signal) con valor stale del render anterior.
    this.cdr.markForCheck();
  }

  private initCandidatasPersistence() {
    this.candidatasTrigger$
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef),
        switchMap((snap) => this.guardarCandidatas(snap)),
      )
      .subscribe();
  }

  private guardarCandidatas(snap: CandidatasSnapshot) {
    return this.testService
      .actualizarProgresoTest({
        testId: snap.testId,
        preguntaId: snap.preguntaId,
        respuestaDada: snap.respuestaDada ?? undefined,
        indicePregunta: snap.indicePregunta,
        seguridad: snap.seguridad,
        respuestasCandidatas: snap.respuestasCandidatas,
      })
      .pipe(
        tap((res: Respuesta) => {
          if (this.lastLoadedTest.id !== snap.testId) return;
          const respuestas = this.lastLoadedTest.respuestas;
          const idx = respuestas.findIndex(
            (r) =>
              r.preguntaId === res.preguntaId &&
              r.indicePregunta === res.indicePregunta,
          );
          if (idx >= 0) respuestas[idx] = res;
          else respuestas.push(res);
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error al persistir candidatas:', err);
          this.toast.error(
            'No se pudieron guardar las respuestas candidatas. Se reintentará con el próximo cambio.',
          );
          return EMPTY;
        }),
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

    if (this.finalizando || this.tiempoAgotadoLibrillo()) return;
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

    // Nota: NO tocamos candidatasPorPregunta aquí. Elegir respuesta final
    // no debe modificar las candidatas marcadas. Las candidatas solo se
    // tocan en modo selección (handleRespuestaClick → toggleCandidata).
    // Esto permite que el alumno tenga candidatas [A, C] marcadas y
    // elija finalmente B sin que eso "rote" las candidatas.

    this.isProcessingAnswer = true;
    this.answeredQuestion = -1;
    this.indicePreguntaCorrecta = -1;
    this.comunicating = true;

    try {
      if (this.origenLibrillo) await this.candidatasLibrilloEnCurso;
      if (this.destruido) return;
      const isAnswered =
        existingAnswer?.respuestaDada != null &&
        existingAnswer.respuestaDada !== -1;
      // Si el alumno dejó candidatas o marcó seguridad distinta de 100%,
      // es un draft intencional (intención de dudar). Al navegar NO se
      // auto-omite — se persiste como draft (NO_RESPONDIDA). Sin esta
      // guardia, el backend recibe omitida:true y descarta las candidatas.
      const tieneIntencionDeDudar =
        (this.candidatasPorPregunta() ?? []).length > 0 ||
        (this.seguroDeLaPregunta.value != null &&
          this.seguroDeLaPregunta.value !==
            SeguridadAlResponder.CIEN_POR_CIENTO);
      const isOmitida =
        mode == 'omitir' ||
        ((mode == 'next' || mode == 'before') &&
          !isAnswered &&
          !tieneIntencionDeDudar);

      const res: Respuesta & {
        pregunta?: { respuestaCorrectaIndex?: number };
      } = await firstValueFrom(
        this.testService
          .actualizarProgresoTest({
            testId: this.lastLoadedTest.id,
            preguntaId: this.lastLoadedTest.preguntas[this.indicePregunta()].id,
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
      if (!this.destruido) this.cdr.markForCheck();
      if (!this.destruido && this.tiempoAgotadoLibrillo())
        void this.finalizarTest();
    }
  }

  public atras() {
    const nuevo = this.indicePregunta() - 1;
    this.indicePregunta.set(nuevo);
    this.sincronizarEstadoPregunta(nuevo);
  }

  public adelante() {
    const nuevo = this.indicePregunta() + 1;
    this.indicePregunta.set(nuevo);
    this.sincronizarEstadoPregunta(nuevo);
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
      if (this.origenLibrillo) return;
      //completado
      // Contar solo respuestas REALES (excluir drafts con estado='NO_RESPONDIDA',
      // que son borradores de candidatas sin respuesta final). Si los
      // incluyéramos, un alumno con 59 respondidas + 1 draft vería el test
      // como completo aunque falte 1 por responder.
      const respuestasReales = (this.lastLoadedTest.respuestas ?? []).filter(
        (r: any) => r.estado !== 'NO_RESPONDIDA',
      ).length;
      if (this.lastLoadedTest.preguntas.length != respuestasReales) {
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
    // Los resets de UI (seguridad/indiceSeleccionado/answeredQuestion/
    // indicePreguntaCorrecta) ahora viven dentro de sincronizarEstadoPregunta
    // para no pisar la seguridad/candidatas restauradas de la pregunta
    // destino (era bug: al volver a una pregunta con seguridad!=CIEN
    // guardada, el reset posterior forzaba CIEN y la auto-omitía al
    // siguiente Adelante).
  }

  public crearReglaPregunta(pregunta: Pregunta): void {
    const ok = this.studyAssistant.openWithMessage(
      construirMensajePregunta(pregunta),
    );
    if (!ok) {
      console.warn(
        '[Asistente de Estudio] widget no montado; no se pudo abrir el chat',
      );
    }
  }

  public showSolution() {
    if (this.corrigeAlCerrar() && !this.modoVerRespuestas) {
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

  private navegarAResultados(salaDueloCodigo: string | null = null) {
    // Embebido en el aula: no navegamos fuera; avisamos al host.
    if (this.embedded) {
      if (this.resultadoEmitido) return;
      this.resultadoEmitido = true;
      this.finalizado.emit({ testId: this.lastLoadedTest.id });
      return;
    }
    // Test de desafío (duelo): ir directo a la clasificación del desafío en vez
    // del resultado/stats normal. Solo aplica cuando el backend devuelve código.
    if (salaDueloCodigo) {
      this.router.navigate([
        '/app/test/alumno/duelo/ranking/' + salaDueloCodigo,
      ]);
      return;
    }
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
      this.router.navigate(
        ['app/test/alumno/stats-test/' + this.lastLoadedTest.id],
        {
          queryParams: parametrosPracticaLibrillo(
            temaDePracticaLibrillo(this.activedRoute.snapshot?.queryParamMap),
          ),
        },
      );
    }
  }

  public async finalizarTest() {
    if (this.isProcessingAnswer || this.finalizando || this.resultadoEmitido)
      return;
    this.finalizando = true;
    this.comunicating = true;
    const id = this.lastLoadedTest.id;
    try {
      if (this.origenLibrillo) await this.candidatasLibrilloEnCurso;
      if (this.destruido) return;
      const respuesta = await firstValueFrom(
        this.testService.finalizarTest(id),
      );
      if (!this.origenLibrillo) await firstValueFrom(this.loadTest());
      if (!this.destruido)
        this.navegarAResultados(respuesta?.salaDueloCodigo ?? null);
    } catch {
      if (this.origenLibrillo && !this.destruido) {
        // El servidor puede haber cerrado el intento al vencer el plazo o al
        // guardar la última respuesta, incluso si se perdió la respuesta HTTP.
        const test = await firstValueFrom(
          this.testService.getTestById(id).pipe(catchError(() => EMPTY)),
          { defaultValue: null },
        );
        if (test?.status === 'FINALIZADO' && !this.destruido) {
          this.navegarAResultados();
          return;
        }
      }
      if (!this.destruido)
        this.toast.error('No se pudo finalizar el test. Inténtalo de nuevo.');
    } finally {
      this.finalizando = false;
      this.comunicating = false;
      if (!this.destruido) this.cdr.markForCheck();
    }
  }

  public cargar(id = this.getId()) {
    this.estadoCarga.set('cargando');
    this.loadTest(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (test) => {
          this.estadoCarga.set('disponible');
          if (!this.origenLibrillo || this.revisarLibrillo) return;
          if (test.status === 'FINALIZADO') {
            this.navegarAResultados();
          } else if (this.origenLibrillo.modo === 'simulacro' && test.endsAt) {
            const plazo = new Date(test.endsAt).getTime();
            if (!Number.isFinite(plazo)) return;
            timer(Math.max(0, plazo - Date.now()))
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe(() => {
                this.tiempoAgotadoLibrillo.set(true);
                void this.finalizarTest();
              });
          }
        },
        error: () => this.estadoCarga.set('error'),
      });
  }

  private indiceInicial(test: Test & { respuestasCount: number }) {
    if (this.modoVerRespuestas || this.vistaPrevia) return 0;
    if (!this.origenLibrillo) return test.respuestasCount;

    const resueltas = new Set(
      test.respuestas
        .filter((respuesta) => respuesta.estado !== 'NO_RESPONDIDA')
        .map((respuesta) => respuesta.indicePregunta),
    );
    const pendiente = test.preguntas.findIndex(
      (_, indice) => !resueltas.has(indice),
    );
    return pendiente === -1
      ? Math.max(0, test.preguntas.length - 1)
      : pendiente;
  }

  private loadTest(id: string = this.getId()) {
    return this.testService.getTestById(Number(id)).pipe(
      tap(async (entry: any) => {
        await this.loadRouteData();
        const parsedTest: Test & { respuestasCount: number } = entry;
        const initialIndex = this.indiceInicial(parsedTest);
        if (this.lastLoadedTest?.id !== parsedTest.id)
          this.indicePregunta.set(initialIndex);
        this.lastLoadedTest = parsedTest;
        // Sincronizar estado (seguridad + candidatas) tras la carga.
        // Se llama explícitamente porque no hay effect reactivo
        // (ver nota en el signal indicePregunta).
        this.sincronizarEstadoPregunta(this.indicePregunta());
      }),
      delay(100),
      tap(() => this.scrollToActiveBlock()),
    );
  }
}
