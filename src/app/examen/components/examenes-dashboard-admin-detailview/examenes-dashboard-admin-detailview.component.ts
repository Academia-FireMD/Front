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
import { MenuItem } from 'primeng/api';
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

  public checked = {};
  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas);
    })
  );

  duracionOptions = duracionOptions;

  public estadoExamenOptions = estadoExamenOptions;

  public tipoAccesoOptions = tipoAccesoOptions;

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
    consideracionesGenerales: [''],
  });

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormArray;
  }


  public addPreguntasDialogVisible = false;
  public selectedPreguntasToAdd: Array<Pregunta> = [];
  public selectedPreguntasReservaToAdd: Array<Pregunta> = [];
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
    console.log(event.target.value)
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
      if (value === TipoAcceso.RESTRINGIDO) {
        codigoControl?.setValidators([Validators.required]);
        codigoControl?.enable();
      } else {
        codigoControl?.clearValidators();
        codigoControl?.setValue('');
        codigoControl?.disable();
      }
      codigoControl?.updateValueAndValidity();
    });
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
      consideracionesGenerales: examen.consideracionesGenerales || '',
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
        examen.consideracionesGenerales || ''
      );
    }, 0);

    this.formGroup.markAsPristine();
  }

  private loadExamen() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset({
        estado: EstadoExamen.BORRADOR,
        tipoAcceso: TipoAcceso.PUBLICO,
        duracion: 60
      });
      this.initEditor('', '');
    } else {
      firstValueFrom(
        this.examenesService.getExamenById$(itemId).pipe(
          tap((entry) => {
            this.setLoadedExamen(entry);
          })
        )
      );
    }
  }

  public updateCommunitySelection(communities: Comunidad[]) {
    this.relevancia.clear();
    communities.forEach((code) => this.relevancia.push(new FormControl(code)));
  }


  private async updateExamen() {
    const formValues = this.formGroup.getRawValue();

    await firstValueFrom(
      this.examenesService.updatePreguntasOrder$(
        this.getId() as number,
        this.lastLoadedPreguntas().map(p => p.id)
      )
    );

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

  private initEditor(initialDescripcion: string, initialConsideraciones: string) {
    if (this.editorDescripcion) {
      this.editorDescripcion.destroy();
      this.editorDescripcion = null;
    }
    if (this.editorConsideraciones) {
      this.editorConsideraciones.destroy();
      this.editorConsideraciones = null;
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

    this.editorConsideraciones = new Editor({
      el: document.querySelector('#editor-consideraciones')!,
      ...universalEditorConfig,
      initialValue: initialConsideraciones || '',
      events: {
        change: () => {
          this.formGroup
            .get('consideracionesGenerales')
            ?.patchValue(this.editorConsideraciones.getMarkdown());
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
        examenId: this.getId()
      }
    });
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

      await firstValueFrom(this.examenesService.addPreguntasToExamen$(this.getId() as number, this.selectedPreguntasToAdd.map(pregunta => pregunta.id)));

      // Actualizar también los temas si es necesario
      const temasSeleccionados = new Set<number>();
      this.selectedPreguntasToAdd.forEach(pregunta => {
        temasSeleccionados.add(pregunta.temaId);
      });

      this.toast.success(`Se han añadido ${this.selectedPreguntasToAdd.length} preguntas al examen`, 'Preguntas añadidas');
      this.cancelarSeleccionPreguntas();
    }
  }

  public descargarWord() {
    if (!this.getId() || this.getId() === 'new') {
      this.toast.warning('Debe guardar el examen antes de descargarlo');
      return;
    }

    this.examenesService.downloadExamenWithFilename$(this.getId() as number, this.lastLoadedExamen().titulo).subscribe({
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

        this.toast.success('Documento descargado correctamente');
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
          [this.preguntaEncontrada.id]
        )
      );

      this.toast.success('Pregunta añadida correctamente');
      this.semiAutomaticDialogVisible = false;
      this.loadExamen();
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

      // Actualizar el estado localmente
      const examen = { ...this.lastLoadedExamen() };
      if (examen.test && examen.test.testPreguntas) {
        const tp = examen.test.testPreguntas.find(tp => tp.pregunta.id === testPregunta.pregunta.id);
        if (tp) {
          tp.deReserva = esReserva;
          this.lastLoadedExamen.set(examen);
        }
      }

      this.toast.success(`Pregunta ${esReserva ? 'marcada' : 'desmarcada'} como de reserva`);
    } catch (error) {
      this.toast.error('Error al actualizar el estado de la pregunta');
      console.error('Error al actualizar estado de reserva:', error);
    }
  }
}
