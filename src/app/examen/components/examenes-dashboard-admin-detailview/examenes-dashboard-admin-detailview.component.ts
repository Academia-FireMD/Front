import { Location } from '@angular/common';
import {
    ChangeDetectorRef,
    Component,
    computed,
    inject,
    Input,
    signal,
    ViewChild,
} from '@angular/core';
import {
    AbstractControl,
    FormArray,
    FormBuilder,
    FormControl,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Editor } from '@toast-ui/editor';
import { debounce, Memoize } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { combineLatest, filter, firstValueFrom, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { TemaService } from '../../../services/tema.service';
import { GenerarTestDto } from '../../../services/test.service';
import { ViewportService } from '../../../services/viewport.service';
import { ConfidenceAnalysis } from '../../../shared/components/confidence-analysis-cards/confidence-analysis-cards.component';
import { Comunidad, Pregunta } from '../../../shared/models/pregunta.model';
import { MetodoCalificacion, Rol } from '../../../shared/models/user.model';
import { RelevanciaHelperService } from '../../../shared/services/relevancia-helper.service';
import { RealizarTestComponent } from '../../../shared/realizar-test/realizar-test.component';
import { AppState } from '../../../store/app.state';
import { selectUserMetodoCalificacion, selectCurrentUser } from '../../../store/user/user.selectors';
import {
    calcular100,
    calcular100y50,
    calcular100y75y50,
    createConfidenceAnalysisForResult,
    duracionOptions,
    estadoExamenOptions,
    getAllDifficultades,
    tipoAccesoOptions,
    universalEditorConfig,
} from '../../../utils/utils';
import { CondicionColaborativa, EstadoExamen, Examen, TipoAcceso } from '../../models/examen.model';
import { ExamenesService } from '../../servicios/examen.service';

@Component({
  selector: 'app-examenes-dashboard-admin-detailview',
  templateUrl: './examenes-dashboard-admin-detailview.component.html',
  styleUrl: './examenes-dashboard-admin-detailview.component.scss',
})
export class ExamenesDashboardAdminDetailviewComponent {
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  examenesService = inject(ExamenesService);
  temaService = inject(TemaService);
  preguntasService = inject(PreguntasService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  viewportService = inject(ViewportService);
  cdr = inject(ChangeDetectorRef);
  store = inject(Store<AppState>);
  relevanciaHelper = inject(RelevanciaHelperService);
  public expectedRole: Rol = Rol.ADMIN;
  crearOtroControl = new FormControl(false);
  
  // Helper para manejar la preselección de relevancia
  relevanciaPreseleccionHelper!: ReturnType<typeof this.relevanciaHelper.crearHelper>;
  
  public get isRelevanciaPreseleccionada() {
    return this.relevanciaPreseleccionHelper?.isRelevanciaPreseleccionada ?? false;
  }

  // Selector para obtener el método de calificación del usuario
  userMetodoCalificacion$ = this.store.select(selectUserMetodoCalificacion);
  // Variable para almacenar el método actual
  private currentMetodoCalificacion: MetodoCalificacion =
    MetodoCalificacion.A1_E1_3_B0;
  editorDescripcion!: any;
  editorConsideraciones!: any;
  @Input() mode: 'edit' | 'injected' = 'edit';
  metodosAgregarDialogVisible = false;
  public TipoAcceso = TipoAcceso;
  public agregarComoReserva = false;

  // Tab management
  public activeTabIndex = 0;

  // Results and analytics
  public examenResultados = signal<any>(null);
  public loadingResults = signal<boolean>(false);

  // Collaborative questions
  public preguntasColaborativas = signal<any[]>([]);
  public loadingPreguntasColaborativas = signal<boolean>(false);
  public resultadosData = computed(
    () => this.examenResultados()?.resultados || []
  );
  public totalParticipantes = computed(
    () => this.examenResultados()?.totalParticipantes || 0
  );
  public notaPromedio = computed(() => {
    const resultados = this.resultadosData();
    if (resultados.length === 0) return 0;
    const suma = resultados.reduce(
      (acc: number, r: any) => acc + r.estadisticas.nota,
      0
    );
    return parseFloat((suma / resultados.length).toFixed(2));
  });

  // Computed stats
  public statsBasicas = computed(() => {
    const resultados = this.resultadosData();
    if (resultados.length === 0) return null;

    const notas = resultados.map((r: any) => r.estadisticas.nota);
    const correctas = resultados.map((r: any) => r.estadisticas.correctas);
    const incorrectas = resultados.map((r: any) => r.estadisticas.incorrectas);

    return {
      notaMaxima: Math.max(...notas),
      notaMinima: Math.min(...notas),
      correctasPromedio: parseFloat(
        (
          correctas.reduce((a: number, b: number) => a + b, 0) /
          correctas.length
        ).toFixed(1)
      ),
      incorrectasPromedio: parseFloat(
        (
          incorrectas.reduce((a: number, b: number) => a + b, 0) /
          incorrectas.length
        ).toFixed(1)
      ),
      aprobados: resultados.filter((r: any) => r.estadisticas.nota >= 5).length,
      suspensos: resultados.filter((r: any) => r.estadisticas.nota < 5).length,
    };
  });

  // Añade estos métodos signal
  preguntasNormales = computed(() => {
    if (!this.lastLoadedTestPreguntas()) return [];
    return this.lastLoadedTestPreguntas()
      .filter((tp) => !tp.deReserva)
      .filter(
        (tp) =>
          !this.filtroIdentificador() ||
          tp.pregunta.identificador
            .toLowerCase()
            .includes(this.filtroIdentificador().toLowerCase())
      );
  });

  preguntasReserva = computed(() => {
    if (!this.lastLoadedTestPreguntas()) return [];
    return this.lastLoadedTestPreguntas()
      .filter((tp) => tp.deReserva)
      .filter(
        (tp) =>
          !this.filtroIdentificador() ||
          tp.pregunta.identificador
            .toLowerCase()
            .includes(this.filtroIdentificador().toLowerCase())
      );
  });

  // Añade estos métodos
  async marcarComoReserva(testPregunta: any, esReserva: boolean) {
    // Implementa la lógica para marcar/desmarcar como reserva
    await this.actualizarEstadoReserva(testPregunta, esReserva);
  }
  // Método para mostrar el diálogo de métodos de agregar preguntas
  mostrarOpcionesAgregarPreguntas(event: Event) {
    this.metodosAgregarDialogVisible = true;
  }
  public checked = {};

  duracionOptions = duracionOptions;

  public estadoExamenOptions = estadoExamenOptions;

  public tipoAccesoOptions = tipoAccesoOptions;
  confirmationService = inject(ConfirmationService);

  formGroup = this.fb.group({
    titulo: ['', Validators.required],
    descripcion: [''],
    duracion: [60],
    estado: [EstadoExamen.BORRADOR],
    tipoAcceso: [TipoAcceso.PUBLICO],
    codigoAcceso: [{ disabled: true, value: '' }],
    fechaActivacion: [null],
    fechaSolucion: [null],
    fechaPreparatoria: [null as any],
    temasColaborativos: [[]] as Array<any>,
    condicionesColaborativas: this.fb.array([]),
    metodoCalificacion: [null as MetodoCalificacion | null], // Opcional, si es null usa el del usuario
    relevancia: this.fb.array([] as Array<Comunidad>),
  });

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormArray;
  }

  public get temasColaborativos() {
    return this.formGroup.get('temasColaborativos') as FormControl;
  }

  public get condicionesColaborativas() {
    return this.formGroup.get('condicionesColaborativas') as FormArray;
  }

  @Memoize()
  public getTermasRequeridosFromCondicion(condicion: AbstractControl) {
    return condicion.get('temasRequeridos') as FormControl;
  }

  public anyadirPreguntasAcademia() {
    this.confirmationService.confirm({
      header: 'Añadir preguntas a la academia',
      message:
        'Todas las preguntas inexistentes del examen serán añadidas a la academia. ¿Estás seguro de querer continuar?',
      acceptLabel: 'Sí, añadir',
      rejectLabel: 'No, cancelar',
      rejectButtonStyleClass: 'p-button-outlined',
      accept: () => {
        firstValueFrom(
          this.examenesService
            .anyadirPreguntasAcademia$(this.getId() as number)
            .pipe(
              tap((res) => {
                this.toast.success(res.message);
                this.loadExamen();
              })
            )
        );
      },
    });
  }

  public addPreguntasDialogVisible = false;
  public selectedPreguntasToAdd: Array<Pregunta> = [];
  public lastLoadedExamen = signal<Examen>(null as any);

  public lastLoadedTestPreguntas = computed(
    () => this.lastLoadedExamen()?.test?.testPreguntas ?? []
  );

  public lastLoadedPreguntas = computed(
    () => this.lastLoadedTestPreguntas().map((tp) => tp.pregunta) ?? []
  );

  @ViewChild('realizarTest') realizarTest!: RealizarTestComponent;

  public semiAutomaticDialogVisible = false;
  public identificadorBusqueda = '';
  public preguntaEncontrada: Pregunta | null = null;

  // Añadir propiedad para el filtro de búsqueda
  public filtroIdentificador = signal('');

  @debounce(500)
  public buscarPorIdentificadorInput(event: any) {
    this.filtroIdentificador.set(event.target.value);
  }

  // Añadir propiedad para las preguntas filtradas
  public testPreguntasFiltradas = computed(() => {
    if (!this.filtroIdentificador() || !this.lastLoadedTestPreguntas()) {
      return this.lastLoadedTestPreguntas();
    }

    return this.lastLoadedTestPreguntas().filter((testPregunta) =>
      testPregunta.pregunta.identificador
        .toLowerCase()
        .includes(this.filtroIdentificador().toLowerCase())
    );
  });

  @ViewChild('menuDescarga') menuDescarga: any;

  public opcionesDescargaMenu: MenuItem[] = [
    {
      label: 'Sin soluciones',
      icon: 'pi pi-file-word',
      command: () => this.descargarWord(false),
    },
    {
      label: 'Con soluciones',
      icon: 'pi pi-check-square',
      command: () => this.descargarWord(true),
    },
  ];

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  ngOnInit(): void {
    // Inicializar el helper después de que el FormArray esté disponible
    this.relevanciaPreseleccionHelper = this.relevanciaHelper.crearHelper(this.relevancia);
    
    // Suscribirse al método de calificación del usuario
    this.userMetodoCalificacion$.subscribe((metodo) => {
      this.currentMetodoCalificacion = metodo;
    });

    // Preseleccionar relevancia si es nuevo examen
    this.preseleccionarRelevancia();

    if (this.mode == 'edit') {
      this.loadExamen();
      firstValueFrom(this.getRole());
    }

    // Mostrar/ocultar campo de código según el tipo de acceso
    this.formGroup.get('tipoAcceso')?.valueChanges.subscribe((value) => {
      const codigoControl = this.formGroup.get('codigoAcceso');
      const fechaPreparatoriaControl = this.formGroup.get('fechaPreparatoria');

      if (value === TipoAcceso.SIMULACRO) {
        codigoControl?.setValidators([
          Validators.required,
          Validators.minLength(6),
          Validators.maxLength(6),
        ]);
        codigoControl?.enable();
      } else {
        codigoControl?.clearValidators();
        codigoControl?.setValue('');
        codigoControl?.disable();
      }

      if (value === TipoAcceso.COLABORATIVO) {
        fechaPreparatoriaControl?.setValidators([Validators.required]);
      } else {
        fechaPreparatoriaControl?.clearValidators();
        fechaPreparatoriaControl?.setValue(null);
      }

      codigoControl?.updateValueAndValidity();
      fechaPreparatoriaControl?.updateValueAndValidity();
    });

    // Si es un simulacro existente, generar el QR
    if (this.getId() !== 'new') {
      this.formGroup.get('tipoAcceso')?.valueChanges.subscribe((value) => {
        if (value === this.TipoAcceso.SIMULACRO) {
          this.updateSimulacroUrl();
        } else {
          this.simulacroUrl = '';
        }
      });

      // Generar QR si ya es un simulacro
      if (
        this.formGroup.get('tipoAcceso')?.value === this.TipoAcceso.SIMULACRO
      ) {
        this.updateSimulacroUrl();
      }
    }


  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
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
        this.expectedRole = expectedRole;
      })
    );
  }

  private async setLoadedExamen(examen: Examen) {
    this.lastLoadedExamen.set(examen);
    this.formGroup.patchValue({
      titulo: examen.titulo,
      descripcion: examen.descripcion || '',
      duracion: examen.duracion || 60,
      estado: examen.estado,
      tipoAcceso: examen.tipoAcceso,
      codigoAcceso: examen.codigoAcceso || '',
      fechaActivacion: (examen.fechaActivacion
        ? new Date(examen.fechaActivacion)
        : null) as any,
      fechaSolucion: (examen.fechaSolucion
        ? new Date(examen.fechaSolucion)
        : null) as any,
      fechaPreparatoria: examen.fechaPreparatoria && examen.fechaFinPreparatoria
        ? [new Date(examen.fechaPreparatoria), new Date(examen.fechaFinPreparatoria)]
        : null,
      temasColaborativos: examen.temasColaborativos || [],
      metodoCalificacion: examen.metodoCalificacion || null,
    });

    // Cargar condiciones colaborativas
    this.condicionesColaborativas.clear();
    if (examen.condicionesColaborativas && examen.condicionesColaborativas.length) {
      examen.condicionesColaborativas.forEach((condicion) => {
        this.condicionesColaborativas.push(this.crearCondicionFormGroup(condicion));
      });
    }

    // Cargar relevancia
    await this.relevanciaPreseleccionHelper.cargarRelevanciaExistente(examen.relevancia || []);

    setTimeout(() => {
      this.initEditor(examen.descripcion || '');
    }, 0);

    this.formGroup.markAsPristine();
  }

  public verPregunta(id: number) {
    this.router.navigate(['/app/test/preguntas/' + id], {
      queryParams: { examenId: this.getId(), goBack: true },
    });
  }

  private async loadExamen() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset({
        estado: EstadoExamen.BORRADOR,
        tipoAcceso: TipoAcceso.PUBLICO,
        duracion: 60,
      });
      this.initEditor('');
    } else {
      try {
        const entry = await firstValueFrom(
          this.examenesService.getExamenById$(itemId)
        );
        await this.setLoadedExamen(entry);

        // Actualizar la URL del simulacro si es necesario
        if (
          this.formGroup.get('tipoAcceso')?.value === this.TipoAcceso.SIMULACRO
        ) {
          this.updateSimulacroUrl();
        }
      } catch (error) {
        console.error('Error al cargar el examen', error);
        this.toast.error('Error al cargar el examen');
      }
    }
  }

  /**
   * Preselecciona la relevancia según el rol del usuario
   */
  private async preseleccionarRelevancia() {
    const isNew = this.getId() === 'new';
    await this.relevanciaPreseleccionHelper.preseleccionar(isNew);
  }

  public updateCommunitySelection(communities: Comunidad[]) {
    this.relevanciaPreseleccionHelper.actualizarSeleccion(communities);
  }

  private async updateExamen() {
    const formValues = this.formGroup.getRawValue();
    if (this.lastLoadedTestPreguntas().length > 0) {
      await firstValueFrom(
        this.examenesService.updatePreguntasOrder$(
          this.getId() as number,
          this.preguntasNormales().map((p) => p.pregunta.id)
        )
      );
    }

    const examenData = {
      ...formValues,
      fechaActivacion: formValues.fechaActivacion
        ? new Date(formValues.fechaActivacion).toISOString()
        : null,
      fechaSolucion: formValues.fechaSolucion
        ? new Date(formValues.fechaSolucion).toISOString()
        : null,
      fechaPreparatoria: formValues.fechaPreparatoria && formValues.fechaPreparatoria[0]
        ? new Date(formValues.fechaPreparatoria[0]).toISOString()
        : null,
      fechaFinPreparatoria: formValues.fechaPreparatoria && formValues.fechaPreparatoria[1]
        ? new Date(formValues.fechaPreparatoria[1]).toISOString()
        : null,
    };

    if (this.getId() === 'new') {
      return await firstValueFrom(
        this.examenesService.createExamen$(examenData)
      );
    } else {
      return await firstValueFrom(
        this.examenesService.updateExamen$(this.getId() as number, examenData)
      );
    }
  }

  public async actualizarExamen() {
    const result = await this.updateExamen();
    this.toast.success('Examen actualizado con éxito!', 'Guardado exitoso');
    this.loadExamen();
  }

  public async crearExamen() {
    const res = await this.updateExamen();
    this.toast.success('Examen creado con éxito!', 'Creación exitosa');
    if (!this.crearOtroControl.value && this.mode == 'edit') {
      await this.navigateToExamen(res.id + '');
      this.loadExamen();
    }
  }

  private initEditor(initialDescripcion: string) {
    setTimeout(() => {
      if (this.editorDescripcion) {
        this.editorDescripcion.destroy();
        this.editorDescripcion = null;
      }
      const element = document.querySelector('#editor-descripcion')!;
      this.editorDescripcion = new Editor({
        el: element,
        ...universalEditorConfig,
        initialValue: initialDescripcion || '',
        events: {
          change: () => {
            this.formGroup
              .get('descripcion')
              ?.patchValue(this.editorDescripcion.getMarkdown());
          },
        },
      });
    }, 0);
  }

  private async navigateToExamen(id: string) {
    if (this.expectedRole == 'ADMIN') {
      await this.router.navigate(['app/examen/' + id], {
        replaceUrl: true,
      });
    } else {
      await this.router.navigate(['/app/examen/' + id], {
        replaceUrl: true,
      });
    }
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      if (this.expectedRole == 'ADMIN') {
        this.router.navigate(['app/examen/']);
      } else {
        this.router.navigate(['/app/examen/']);
      }
    }
  }

  public abrirDialogoAutomatico() {
    // Mostrar diálogo para configuración automática
    this.addPreguntasDialogVisible = true;
  }

  public abrirDialogoSemiAutomatico() {
    this.semiAutomaticDialogVisible = true;
    this.identificadorBusqueda = '';
    this.preguntaEncontrada = null;
  }

  public abrirDialogoManual() {
    this.router.navigate(['app/test/preguntas/new'], {
      queryParams: {
        examenId: this.getId(),
        esReserva: this.agregarComoReserva,
      },
    });
    this.agregarComoReserva = false;
  }

  // Stepper
  public stepsModel: MenuItem[] = [
    { label: 'Configurar filtros' },
    { label: 'Seleccionar preguntas' },
  ];
  public activeStepIndex = 0;

  // Filtros
  public filtroConfig = {
    numPreguntas: null,
    dificultad: [],
    temas: [],
  };

  // Opciones para los filtros
  public preguntas = [
    { label: '10 preguntas', code: 10 },
    { label: '20 preguntas', code: 20 },
    { label: '30 preguntas', code: 30 },
    { label: '40 preguntas', code: 40 },
    { label: '50 preguntas', code: 50 },
    { label: '100 preguntas', code: 100 },
  ];

  public getAllDifficultades = getAllDifficultades(false, true, this.expectedRole);
  public automaticPreguntas = [] as Pregunta[];

  // Métodos para el stepper
  public nextStep() {
    if (this.activeStepIndex < this.stepsModel.length - 1) {
      this.activeStepIndex++;
      this.aplicarFiltros(this.realizarTest.generateDto());
    }
  }

  public prevStep() {
    if (this.activeStepIndex > 0) {
      this.activeStepIndex--;
    }
  }

  public cancelarSeleccionPreguntas() {
    this.activeStepIndex = 0;
    this.selectedPreguntasToAdd = [];
    this.addPreguntasDialogVisible = false;
  }

  // Métodos para filtrar y seleccionar preguntas
  public aplicarFiltros(config: GenerarTestDto) {
    firstValueFrom(this.preguntasService.getAllPreguntasByFilter$(config)).then(
      (preguntas) => {
        this.automaticPreguntas = preguntas;
      }
    );
  }

  public seleccionarTodasPreguntas() {
    this.automaticPreguntas = this.automaticPreguntas.map((pregunta) => ({
      ...pregunta,
      selected: true,
    }));
    this.selectedPreguntasToAdd = this.automaticPreguntas;
  }

  public deseleccionarTodasPreguntas() {
    this.automaticPreguntas = this.automaticPreguntas.map((pregunta) => ({
      ...pregunta,
      selected: false,
    }));
    this.selectedPreguntasToAdd = [];
  }

  public getStarsBasedOnDifficulty(difficulty: number): string[] {
    return Array(difficulty).fill('star-fill');
  }

  public async eliminarPregunta(id: number) {
    await firstValueFrom(
      this.examenesService
        .removePreguntasFromExamen$(this.getId() as number, [id])
        .pipe(
          tap(() => {
            this.toast.success(
              'Pregunta eliminada del examen',
              'Pregunta eliminada'
            );
            this.loadExamen();
          })
        )
    );
  }

  public async addSelectedPreguntas() {
    if (this.selectedPreguntasToAdd && this.selectedPreguntasToAdd.length > 0) {
      await firstValueFrom(
        this.examenesService.addPreguntasToExamen$(
          this.getId() as number,
          this.selectedPreguntasToAdd.map((pregunta) => pregunta.id),
          this.agregarComoReserva
        )
      );

      // Actualizar también los temas si es necesario
      const temasSeleccionados = new Set<number>();
      this.selectedPreguntasToAdd.forEach((pregunta) => {
        temasSeleccionados.add(pregunta.temaId);
      });

      this.toast.success(
        `Se han añadido ${this.selectedPreguntasToAdd.length} preguntas ${this.agregarComoReserva ? 'de reserva' : ''
        } al examen`,
        'Preguntas añadidas'
      );
      this.loadExamen();
      this.cancelarSeleccionPreguntas();
      this.agregarComoReserva = false;
    }
  }

  public mostrarOpcionesDescarga(event: any) {
    if (this.menuDescarga) {
      this.menuDescarga.toggle(event);
    }
  }

  public descargarWord(conSoluciones: boolean = false) {
    if (!this.getId() || this.getId() === 'new') {
      this.toast.warning('Debe guardar el examen antes de descargarlo');
      return;
    }

    this.examenesService
      .downloadExamenWithFilename$(
        this.getId() as number,
        this.lastLoadedExamen().titulo,
        conSoluciones
      )
      .subscribe({
        next: ({ blob, filename }) => {
          // Crear un objeto URL para el blob
          const url = window.URL.createObjectURL(blob);

          // Crear un elemento <a> para descargar el archivo
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;

          // Simular un clic en el enlace para iniciar la descarga
          document.body.appendChild(a);
          a.click();

          // Limpiar
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          this.toast.success(
            `Documento ${conSoluciones ? 'con soluciones' : ''
            } descargado correctamente`
          );
        },
        error: (error) => {
          console.error('Error al descargar el examen', error);
          this.toast.error('Error al descargar el examen');
        },
      });
  }

  public async buscarPreguntaPorIdentificador() {
    if (!this.identificadorBusqueda.trim()) {
      this.toast.warning('Introduce un identificador válido');
      return;
    }

    try {
      const pregunta = await firstValueFrom(
        this.preguntasService.getPreguntaByIdentificador(
          this.identificadorBusqueda
        )
      );

      if (pregunta) {
        this.preguntaEncontrada = pregunta;
      } else {
        this.toast.warning(
          'No se encontró ninguna pregunta con ese identificador'
        );
        this.preguntaEncontrada = null;
      }
    } catch (error) {
      this.toast.error('Error al buscar la pregunta');
      this.preguntaEncontrada = null;
    }
  }

  public async agregarPreguntaEncontrada() {
    if (!this.preguntaEncontrada) return;

    try {
      await firstValueFrom(
        this.examenesService.addPreguntasToExamen$(
          this.getId() as number,
          [this.preguntaEncontrada.id],
          this.agregarComoReserva
        )
      );

      this.toast.success(
        `Pregunta ${this.agregarComoReserva ? 'de reserva' : ''
        } añadida correctamente`
      );
      this.semiAutomaticDialogVisible = false;
      this.loadExamen();
      this.agregarComoReserva = false;
    } catch (error) {
      this.toast.error('Error al añadir la pregunta');
    }
  }

  // Método para actualizar el estado de reserva de una pregunta
  public async actualizarEstadoReserva(testPregunta: any, esReserva: boolean) {
    if (!this.getId() || this.getId() === 'new') {
      this.toast.warning('Debe guardar el examen antes de modificar preguntas');
      return;
    }

    try {
      await firstValueFrom(
        this.examenesService.updatePreguntaReservaStatus$(
          this.getId() as number,
          testPregunta.pregunta.id,
          esReserva
        )
      );

      this.loadExamen();

      this.toast.success(
        `Pregunta ${esReserva ? 'marcada' : 'desmarcada'} como de reserva`
      );
    } catch (error) {
      this.toast.error('Error al actualizar el estado de la pregunta');
      console.error('Error al actualizar estado de reserva:', error);
    }
  }

  // Propiedades para el QR
  public simulacroUrl: string = '';

  // Añadir este método para actualizar la URL
  private updateSimulacroUrl(): void {
    const examenId = this.lastLoadedExamen()?.id;
    if (examenId) {
      const baseUrl = window.location.origin;
      this.simulacroUrl = `${baseUrl}/simulacros/realizar-simulacro/${examenId}`;
    }
  }

  // Propiedades para la impugnación
  public impugnacionDialogVisible = false;
  public preguntaAImpugnar: any = null;
  public motivoImpugnacion: string = '';

  // Método para abrir el diálogo de impugnación
  public abrirDialogoImpugnacion(testPregunta: any) {
    this.preguntaAImpugnar = testPregunta;
    this.motivoImpugnacion = testPregunta.motivoImpugnacion || '';
    this.impugnacionDialogVisible = true;
  }

  // Método para confirmar la impugnación
  public async confirmarImpugnacion() {
    if (!this.preguntaAImpugnar) return;

    try {
      await firstValueFrom(
        this.examenesService.impugnarPregunta$(
          this.getId() as number,
          this.preguntaAImpugnar.pregunta.id,
          !this.preguntaAImpugnar.impugnada,
          this.motivoImpugnacion
        )
      );

      this.toast.success('Pregunta impugnada/desimpugnada correctamente');
      this.impugnacionDialogVisible = false;
      this.preguntaAImpugnar = null;
      this.motivoImpugnacion = '';
      this.loadExamen();
    } catch (error) {
      this.toast.error('Error al impugnar/desimpugnar la pregunta');
    }
  }

  // Results and analytics methods
  public async loadExamenResults() {
    if (this.getId() === 'new') return;

    this.loadingResults.set(true);
    try {
      const response = await firstValueFrom(
        this.examenesService.getSimulacroResultados$(this.getId() as number)
      );
      this.examenResultados.set(response);
    } catch (error) {
      console.error('Error loading exam results:', error);
      this.toast.error('Error al cargar los resultados del examen');
    } finally {
      this.loadingResults.set(false);
    }
  }

  // Collaborative questions methods
  public async loadPreguntasColaborativas() {
    if (this.getId() === 'new') return;

    this.loadingPreguntasColaborativas.set(true);
    try {
      const preguntas = await firstValueFrom(
        this.examenesService.getPreguntasColaborativas$(this.getId() as number)
      );
      this.preguntasColaborativas.set(preguntas);
    } catch (error) {
      console.error('Error loading collaborative questions:', error);
      this.toast.error('Error al cargar las preguntas colaborativas');
    } finally {
      this.loadingPreguntasColaborativas.set(false);
    }
  }

  public onTabChange(event: any) {
    this.activeTabIndex = event.index;

    // Load results when switching to results tab
    if (event.index === 1 && !this.examenResultados()) {
      this.loadExamenResults();
    }

    // Load collaborative questions when switching to collaborative questions tab
    if (event.index === 2 && this.esExamenColaborativo && !this.preguntasColaborativas().length) {
      this.loadPreguntasColaborativas();
    }
  }

  public exportarResultados() {
    if (!this.examenResultados() || this.resultadosData().length === 0) {
      this.toast.warning('No hay resultados para exportar');
      return;
    }

    const resultados = this.resultadosData();
    const headers = [
      'Posición',
      'Nombre',
      'Apellidos',
      'Email',
      'Nota',
      'Correctas',
      'Incorrectas',
      'No Contestadas',
      'Fecha Realización'
    ];

    const csvContent = [
      headers.join(','),
      ...resultados.map((resultado: any) => [
        resultado.posicion,
        `"${resultado.usuario.nombre}"`,
        `"${resultado.usuario.apellidos}"`,
        `"${resultado.usuario.email}"`,
        resultado.estadisticas.nota,
        resultado.estadisticas.correctas,
        resultado.estadisticas.incorrectas,
        resultado.estadisticas.noContestadas || 0,
        `"${new Date(resultado.fechaRealizacion).toLocaleString()}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `resultados-examen-${this.lastLoadedExamen().titulo}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toast.success('Resultados exportados correctamente');
  }


  // Métodos para el desplegable de análisis de confianza
  public expandedRowKeys: { [key: string]: boolean } = {};
  public showIndividualConfidenceByUserId: { [key: string]: boolean } = {};

  toggleRowExpansion(resultado: any): void {
    const key = resultado.usuario.id.toString();

    // Alternar el estado de expansión de esta fila específica
    if (this.expandedRowKeys[key]) {
      // Crear nuevo objeto sin esta key para forzar detección de cambios
      const newExpandedRowKeys = { ...this.expandedRowKeys };
      delete newExpandedRowKeys[key];
      this.expandedRowKeys = newExpandedRowKeys;
    } else {
      // Crear nuevo objeto agregando esta key para forzar detección de cambios
      this.expandedRowKeys = { ...this.expandedRowKeys, [key]: true };

      // Forzar detección de cambios y múltiples timeouts para gráficos
      this.cdr.detectChanges();

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 200);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 500);
    }
  }

  getConfidenceAnalysisForResult(seguridad: any): ConfidenceAnalysis[] {
    return createConfidenceAnalysisForResult(
      seguridad,
      this.currentMetodoCalificacion,
      this.getTotalPreguntasPorSeguridad.bind(this),
      this.getCorrectas.bind(this),
      this.getIncorrectas.bind(this),
      this.getNoContestadas.bind(this),
      this.getAccuracyPercentage.bind(this)
    );
  }

  // Helpers combinados
  private getCombinedCorrects(stats: any, tipos: string[]): number {
    if (!stats?.seguridad) return 0;
    return tipos.reduce((total, tipo) => total + (stats.seguridad[tipo]?.correctas || 0), 0);
  }
  private getCombinedIncorrects(stats: any, tipos: string[]): number {
    if (!stats?.seguridad) return 0;
    return tipos.reduce((total, tipo) => total + (stats.seguridad[tipo]?.incorrectas || 0), 0);
  }
  private getCombinedNoAnswered(stats: any, tipos: string[]): number {
    if (!stats?.seguridad) return 0;
    return tipos.reduce((total, tipo) => total + (stats.seguridad[tipo]?.noRespondidas || 0), 0);
  }
  private getCombinedTotal(stats: any, tipos: string[]): number {
    return (
      this.getCombinedCorrects(stats, tipos) +
      this.getCombinedIncorrects(stats, tipos) +
      this.getCombinedNoAnswered(stats, tipos)
    );
  }
  private getCombinedAccuracy(stats: any, tipos: string[]): number {
    const total = this.getCombinedTotal(stats, tipos);
    if (total === 0) return 0;
    const correctas = this.getCombinedCorrects(stats, tipos);
    return Math.round((correctas / total) * 100);
  }

  public getCombinedConfidenceAnalysisFromSecurity(seguridad: any, totalPreguntas: number): ConfidenceAnalysis[] {
    if (!seguridad) return [];

    const stats100 = {
      correctas: this.getCorrectas({ seguridad }, 'CIEN_POR_CIENTO'),
      incorrectas: this.getIncorrectas({ seguridad }, 'CIEN_POR_CIENTO'),
    } as any;
    const stats75 = {
      correctas: this.getCorrectas({ seguridad }, 'SETENTA_Y_CINCO_POR_CIENTO'),
      incorrectas: this.getIncorrectas({ seguridad }, 'SETENTA_Y_CINCO_POR_CIENTO'),
    } as any;
    const stats50 = {
      correctas: this.getCorrectas({ seguridad }, 'CINCUENTA_POR_CIENTO'),
      incorrectas: this.getIncorrectas({ seguridad }, 'CINCUENTA_POR_CIENTO'),
    } as any;

    const combinations = [
      {
        id: 'only-100',
        title: 'Solo 100% Seguro',
        icon: '⭐',
        tipos: ['CIEN_POR_CIENTO'],
        score: calcular100(stats100, totalPreguntas, this.currentMetodoCalificacion),
      },
      {
        id: 'combined-100-50',
        title: '100% + 50% Seguro',
        icon: '🎯',
        tipos: ['CIEN_POR_CIENTO', 'CINCUENTA_POR_CIENTO'],
        score: calcular100y50(stats100, stats50, totalPreguntas, this.currentMetodoCalificacion),
      },
      {
        id: 'combined-100-75-50',
        title: '100% + 75% + 50% Seguro',
        icon: '📈',
        tipos: ['CIEN_POR_CIENTO', 'SETENTA_Y_CINCO_POR_CIENTO', 'CINCUENTA_POR_CIENTO'],
        score: calcular100y75y50(stats100, stats75, stats50, totalPreguntas, this.currentMetodoCalificacion),
      },
    ];

    return combinations.map((c) => ({
      id: c.id,
      title: c.title,
      icon: c.icon,
      score: c.score,
      totalPreguntas: this.getCombinedTotal({ seguridad }, c.tipos),
      correctas: this.getCombinedCorrects({ seguridad }, c.tipos),
      incorrectas: this.getCombinedIncorrects({ seguridad }, c.tipos),
      noContestadas: this.getCombinedNoAnswered({ seguridad }, c.tipos),
      accuracyPercentage: this.getCombinedAccuracy({ seguridad }, c.tipos),
    }));
  }

  private getTotalPreguntasPorSeguridad(
    stats: any,
    tipoSeguridad: string
  ): number {
    if (!stats?.seguridad?.[tipoSeguridad]) return 0;
    const seguridad = stats.seguridad[tipoSeguridad];
    return (
      (seguridad.correctas || 0) +
      (seguridad.incorrectas || 0) +
      (seguridad.noRespondidas || 0)
    );
  }

  private getCorrectas(stats: any, tipoSeguridad: string): number {
    return stats?.seguridad?.[tipoSeguridad]?.correctas || 0;
  }

  private getIncorrectas(stats: any, tipoSeguridad: string): number {
    return stats?.seguridad?.[tipoSeguridad]?.incorrectas || 0;
  }

  private getNoContestadas(stats: any, tipoSeguridad: string): number {
    return stats?.seguridad?.[tipoSeguridad]?.noRespondidas || 0;
  }

  private getAccuracyPercentage(stats: any, tipoSeguridad: string): number {
    const total = this.getTotalPreguntasPorSeguridad(stats, tipoSeguridad);
    if (total === 0) return 0;
    const correctas = this.getCorrectas(stats, tipoSeguridad);
    return Math.round((correctas / total) * 100);
  }

  // Métodos para gestión de condiciones colaborativas
  public crearCondicionFormGroup(condicion?: CondicionColaborativa) {
    return this.fb.group({
      numeroPreguntas: [condicion?.numeroPreguntas || 1, [Validators.required, Validators.min(1)]],
      temasRequeridos: [condicion?.temasRequeridos || [], [Validators.required, Validators.minLength(1)]],
      orden: [condicion?.orden || 0],
    });
  }

  public agregarCondicion() {
    this.condicionesColaborativas.push(this.crearCondicionFormGroup());
  }

  public eliminarCondicion(index: number) {
    this.condicionesColaborativas.removeAt(index);
  }

  // Computed para verificar si debe mostrar la sección de condiciones
  public get esExamenColaborativo(): boolean {
    return this.formGroup.get('tipoAcceso')?.value === TipoAcceso.COLABORATIVO;
  }

  // Computed para verificar si debe mostrar preguntas actuales
  public get debeOcultarPreguntas(): boolean {
    return this.esExamenColaborativo;
  }

  // Métodos auxiliares para preguntas colaborativas
  public getUniqueStudentsCount(): number {
    const uniqueStudents = new Set(
      this.preguntasColaborativas().map(p => p.createdBy?.id).filter(id => id)
    );
    return uniqueStudents.size;
  }

  public getUniqueTopicsCount(): number {
    const uniqueTopics = new Set(
      this.preguntasColaborativas().map(p => p.tema?.id).filter(id => id)
    );
    return uniqueTopics.size;
  }

  public onGlobalFilter(event: any) {
    // Implementar filtro global si es necesario
    // Por ahora PrimeNG maneja el filtro automáticamente
  }

  public abrirPreguntaEnNuevaPestana(preguntaId: number) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree(['/app/test/preguntas', preguntaId], {
        queryParams: { examenId: this.getId(), goBack: true }
      })
    );
    window.open(url, '_blank');
  }

  public eliminarPreguntaColaborativa(pregunta: any) {
    this.confirmationService.confirm({
      header: 'Eliminar pregunta colaborativa',
      message: `Esta acción eliminará la pregunta "${pregunta.identificador}" de la base de datos. ¿Deseas continuar?`,
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      rejectButtonStyleClass: 'p-button-outlined',
      accept: async () => {
        try {
          await firstValueFrom(this.preguntasService.deletePregunta$(pregunta.id));
          this.toast.success('Pregunta eliminada correctamente');
          this.loadPreguntasColaborativas();
        } catch (error) {
          this.toast.error('Error al eliminar la pregunta');
        }
      }
    });
  }

}
