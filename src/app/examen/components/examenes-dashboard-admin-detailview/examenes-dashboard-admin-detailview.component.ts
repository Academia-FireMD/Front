import { Location } from '@angular/common';
import {
  Component,
  computed,
  inject,
  Input,
  signal,
  ViewChild
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@toast-ui/editor';
import { debounce } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService, MenuItem } from 'primeng/api';
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  tap
} from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { TemaService } from '../../../services/tema.service';
import { GenerarTestDto } from '../../../services/test.service';
import { ViewportService } from '../../../services/viewport.service';
import { Comunidad, Pregunta } from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import { RealizarTestComponent } from '../../../shared/realizar-test/realizar-test.component';
import { duracionOptions, estadoExamenOptions, getAllDifficultades, groupedTemas, tipoAccesoOptions, universalEditorConfig } from '../../../utils/utils';
import { EstadoExamen, Examen, TipoAcceso } from '../../models/examen.model';
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
  public expectedRole: Rol = Rol.ADMIN;
  crearOtroControl = new FormControl(false);
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
  public resultadosData = computed(() => this.examenResultados()?.resultados || []);
  public totalParticipantes = computed(() => this.examenResultados()?.totalParticipantes || 0);
  public notaPromedio = computed(() => {
    const resultados = this.resultadosData();
    if (resultados.length === 0) return 0;
    const suma = resultados.reduce((acc: number, r: any) => acc + r.estadisticas.nota, 0);
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
      correctasPromedio: parseFloat((correctas.reduce((a: number, b: number) => a + b, 0) / correctas.length).toFixed(1)),
      incorrectasPromedio: parseFloat((incorrectas.reduce((a: number, b: number) => a + b, 0) / incorrectas.length).toFixed(1)),
      aprobados: resultados.filter((r: any) => r.estadisticas.nota >= 5).length,
      suspensos: resultados.filter((r: any) => r.estadisticas.nota < 5).length
    };
  });

  // Añade estos métodos signal
  preguntasNormales = computed(() => {
    if (!this.lastLoadedTestPreguntas()) return [];
    return this.lastLoadedTestPreguntas()
      .filter(tp => !tp.deReserva)
      .filter(tp =>
        !this.filtroIdentificador() ||
        tp.pregunta.identificador.toLowerCase().includes(this.filtroIdentificador().toLowerCase())
      );
  });

  preguntasReserva = computed(() => {
    if (!this.lastLoadedTestPreguntas()) return [];
    return this.lastLoadedTestPreguntas()
      .filter(tp => tp.deReserva)
      .filter(tp =>
        !this.filtroIdentificador() ||
        tp.pregunta.identificador.toLowerCase().includes(this.filtroIdentificador().toLowerCase())
      );
  });

  // Añade estos métodos
  marcarComoReserva(testPregunta: any, esReserva: boolean) {
    // Implementa la lógica para marcar/desmarcar como reserva
    this.actualizarEstadoReserva(testPregunta, esReserva);
  }
  // Método para mostrar el diálogo de métodos de agregar preguntas
  mostrarOpcionesAgregarPreguntas(event: Event) {
    this.metodosAgregarDialogVisible = true;
  }
  public checked = {};
  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas, this.expectedRole == 'ADMIN');
    })
  );

  duracionOptions = duracionOptions;

  public estadoExamenOptions = estadoExamenOptions;

  public tipoAccesoOptions = tipoAccesoOptions;
  confirmationService = inject(ConfirmationService);

  formGroup = this.fb.group({
    titulo: ['', Validators.required],
    descripcion: [''],
    duracion: [60, [Validators.required, Validators.min(1)]],
    estado: [EstadoExamen.BORRADOR],
    tipoAcceso: [TipoAcceso.PUBLICO],
    codigoAcceso: [{ disabled: true, value: '' }],
    fechaActivacion: [null],
    fechaSolucion: [null],
    relevancia: this.fb.array([] as Array<Comunidad>),
  });

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormArray;
  }

  public anyadirPreguntasAcademia() {
    this.confirmationService.confirm({
      header: 'Añadir preguntas a la academia',
      message: 'Todas las preguntas añadidas manualmente con la letra "E" en el identificador serán añadidas a la academia si no existen ya. ¿Estás seguro de querer continuar?',
      acceptLabel: 'Sí, añadir',
      rejectLabel: 'No, cancelar',
      rejectButtonStyleClass: 'p-button-outlined',
      accept: () => {
        firstValueFrom(this.examenesService.anyadirPreguntasAcademia$(this.getId() as number).pipe(
          tap((res) => {
            this.toast.success(res.message);
            this.loadExamen();
          })
        ));
      }
    });
  }

  public addPreguntasDialogVisible = false;
  public selectedPreguntasToAdd: Array<Pregunta> = [];
  public lastLoadedExamen = signal<Examen>(null as any);

  public lastLoadedTestPreguntas = computed(() =>
    this.lastLoadedExamen()?.test?.testPreguntas ?? []
  );

  public lastLoadedPreguntas = computed(() =>
    this.lastLoadedTestPreguntas().map(tp => tp.pregunta) ?? []
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

    return this.lastLoadedTestPreguntas().filter(testPregunta =>
      testPregunta.pregunta.identificador.toLowerCase().includes(this.filtroIdentificador().toLowerCase())
    );
  });

  @ViewChild('menuDescarga') menuDescarga: any;

  public opcionesDescargaMenu: MenuItem[] = [
    {
      label: 'Sin soluciones',
      icon: 'pi pi-file-word',
      command: () => this.descargarWord(false)
    },
    {
      label: 'Con soluciones',
      icon: 'pi pi-check-square',
      command: () => this.descargarWord(true)
    }
  ];

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  ngOnInit(): void {
    if (this.mode == 'edit') {
      this.loadExamen();
      firstValueFrom(this.getRole());
    }

    // Mostrar/ocultar campo de código según el tipo de acceso
    this.formGroup.get('tipoAcceso')?.valueChanges.subscribe(value => {
      const codigoControl = this.formGroup.get('codigoAcceso');
      if (value === TipoAcceso.SIMULACRO) {
        codigoControl?.setValidators([Validators.required, Validators.minLength(6), Validators.maxLength(6)]);
        codigoControl?.enable();
      } else {
        codigoControl?.clearValidators();
        codigoControl?.setValue('');
        codigoControl?.disable();
      }
      codigoControl?.updateValueAndValidity();
    });

    // Si es un simulacro existente, generar el QR
    if (this.getId() !== 'new') {
      this.formGroup.get('tipoAcceso')?.valueChanges.subscribe(value => {
        if (value === this.TipoAcceso.SIMULACRO) {
          this.updateSimulacroUrl();
        } else {
          this.simulacroUrl = '';
        }
      });

      // Generar QR si ya es un simulacro
      if (this.formGroup.get('tipoAcceso')?.value === this.TipoAcceso.SIMULACRO) {
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

  private setLoadedExamen(examen: Examen) {
    this.lastLoadedExamen.set(examen);
    this.formGroup.patchValue({
      titulo: examen.titulo,
      descripcion: examen.descripcion || '',
      duracion: examen.duracion || 60,
      estado: examen.estado,
      tipoAcceso: examen.tipoAcceso,
      codigoAcceso: examen.codigoAcceso || '',
      fechaActivacion: (examen.fechaActivacion ? new Date(examen.fechaActivacion) : null) as any,
      fechaSolucion: (examen.fechaSolucion ? new Date(examen.fechaSolucion) : null) as any,
    });

    // Cargar relevancia
    this.relevancia.clear();
    if (examen.relevancia && examen.relevancia.length) {
      examen.relevancia.forEach((rel) =>
        this.relevancia.push(new FormControl(rel))
      );
    }

    setTimeout(() => {
      this.initEditor(
        examen.descripcion || '',
      );
    }, 0);

    this.formGroup.markAsPristine();
  }

  public verPregunta(id: number) {
    this.router.navigate(['/app/test/preguntas/' + id], { queryParams: { examenId: this.getId(), goBack: true } });
  }

  private async loadExamen() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset({
        estado: EstadoExamen.BORRADOR,
        tipoAcceso: TipoAcceso.PUBLICO,
        duracion: 60
      });
      this.initEditor('');
    } else {
      try {
        firstValueFrom(
          this.examenesService.getExamenById$(itemId).pipe(
            tap((entry) => {
              this.setLoadedExamen(entry);
            })
          )
        );

        // Actualizar la URL del simulacro si es necesario
        if (this.formGroup.get('tipoAcceso')?.value === this.TipoAcceso.SIMULACRO) {
          this.updateSimulacroUrl();
        }
      } catch (error) {
        console.error('Error al cargar el examen', error);
        this.toast.error('Error al cargar el examen');
      }
    }
  }

  public updateCommunitySelection(communities: Comunidad[]) {
    this.relevancia.clear();
    communities.forEach((code) => this.relevancia.push(new FormControl(code)));
  }

  private async updateExamen() {
    const formValues = this.formGroup.getRawValue();
    if (this.lastLoadedTestPreguntas().length > 0) {
      await firstValueFrom(
        this.examenesService.updatePreguntasOrder$(
          this.getId() as number,
          this.preguntasNormales().map(p => p.pregunta.id)
        )
      );
    }

    const examenData = {
      ...formValues,
      fechaActivacion: formValues.fechaActivacion ? new Date(formValues.fechaActivacion).toISOString() : null,
      fechaSolucion: formValues.fechaSolucion ? new Date(formValues.fechaSolucion).toISOString() : null,
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

  private initEditor(initialDescripcion: string,) {
    if (this.editorDescripcion) {
      this.editorDescripcion.destroy();
      this.editorDescripcion = null;
    }

    this.editorDescripcion = new Editor({
      el: document.querySelector('#editor-descripcion')!,
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
        esReserva: this.agregarComoReserva
      }
    });
    this.agregarComoReserva = false;
  }

  // Stepper
  public stepsModel: MenuItem[] = [
    { label: 'Configurar filtros' },
    { label: 'Seleccionar preguntas' }
  ];
  public activeStepIndex = 0;

  // Filtros
  public filtroConfig = {
    numPreguntas: null,
    dificultad: [],
    temas: []
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

  public getAllDifficultades = getAllDifficultades(false, true);
  public automaticPreguntas = [] as Pregunta[]

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
    firstValueFrom(this.preguntasService.getAllPreguntasByFilter$(config)).then(preguntas => {
      this.automaticPreguntas = preguntas;
    })
  }

  public seleccionarTodasPreguntas() {
    this.automaticPreguntas = this.automaticPreguntas.map(pregunta => ({
      ...pregunta,
      selected: true
    }));
    this.selectedPreguntasToAdd = this.automaticPreguntas;
  }

  public deseleccionarTodasPreguntas() {
    this.automaticPreguntas = this.automaticPreguntas.map(pregunta => ({
      ...pregunta,
      selected: false
    }));
    this.selectedPreguntasToAdd = [];
  }

  public getStarsBasedOnDifficulty(difficulty: number): string[] {
    return Array(difficulty).fill('star-fill');
  }

  public eliminarPregunta(id: number) {
    firstValueFrom(this.examenesService.removePreguntasFromExamen$(this.getId() as number, [id]).pipe(tap(() => {
      this.toast.success('Pregunta eliminada del examen', 'Pregunta eliminada');
      this.loadExamen();
    })));
  }

  public async addSelectedPreguntas() {
    if (this.selectedPreguntasToAdd && this.selectedPreguntasToAdd.length > 0) {
      await firstValueFrom(this.examenesService.addPreguntasToExamen$(
        this.getId() as number, 
        this.selectedPreguntasToAdd.map(pregunta => pregunta.id),
        this.agregarComoReserva
      ));

      // Actualizar también los temas si es necesario
      const temasSeleccionados = new Set<number>();
      this.selectedPreguntasToAdd.forEach(pregunta => {
        temasSeleccionados.add(pregunta.temaId);
      });

      this.toast.success(`Se han añadido ${this.selectedPreguntasToAdd.length} preguntas ${this.agregarComoReserva ? 'de reserva' : ''} al examen`, 'Preguntas añadidas');
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

    this.examenesService.downloadExamenWithFilename$(this.getId() as number, this.lastLoadedExamen().titulo, conSoluciones).subscribe({
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

        this.toast.success(`Documento ${conSoluciones ? 'con soluciones' : ''} descargado correctamente`);
      },
      error: (error) => {
        console.error('Error al descargar el examen', error);
        this.toast.error('Error al descargar el examen');
      }
    });
  }

  public async buscarPreguntaPorIdentificador() {
    if (!this.identificadorBusqueda.trim()) {
      this.toast.warning('Introduce un identificador válido');
      return;
    }

    try {
      const pregunta = await firstValueFrom(
        this.preguntasService.getPreguntaByIdentificador(this.identificadorBusqueda)
      );

      if (pregunta) {
        this.preguntaEncontrada = pregunta;
      } else {
        this.toast.warning('No se encontró ninguna pregunta con ese identificador');
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

      this.toast.success(`Pregunta ${this.agregarComoReserva ? 'de reserva' : ''} añadida correctamente`);
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

      this.toast.success(`Pregunta ${esReserva ? 'marcada' : 'desmarcada'} como de reserva`);
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

  public onTabChange(event: any) {
    this.activeTabIndex = event.index;
    
    // Load results when switching to results tab
    if (event.index === 1 && !this.examenResultados()) {
      this.loadExamenResults();
    }
  }

  public exportarResultados() {
    // Placeholder for future functionality
    this.toast.info('Funcionalidad de exportación próximamente disponible');
  }

  public reiniciarIntento(userId: number) {
    // Placeholder for future functionality  
    this.toast.info('Funcionalidad de reinicio de intentos próximamente disponible');
  }

  public darAcceso(userId: number) {
    // Placeholder for future functionality
    this.toast.info('Funcionalidad de gestión de accesos próximamente disponible');
  }
}
