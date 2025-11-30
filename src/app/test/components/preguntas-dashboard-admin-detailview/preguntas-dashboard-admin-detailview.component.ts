import { Location } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@toast-ui/editor';
import { cloneDeep } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import {
  combineLatest,
  filter,
  firstValueFrom,
  Observable,
  tap,
} from 'rxjs';
import { Store } from '@ngrx/store';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { PreguntasService } from '../../../services/preguntas.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { TemaService } from '../../../services/tema.service';
import { ViewportService } from '../../../services/viewport.service';
import {
  Comunidad,
  Dificultad,
  Pregunta,
} from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import { RelevanciaHelperService } from '../../../shared/services/relevancia-helper.service';
import { AppState } from '../../../store/app.state';
import { selectCurrentUser } from '../../../store/user/user.selectors';
import {
  getLetter,
  getStarsBasedOnDifficulty,
  universalEditorConfig
} from '../../../utils/utils';

@Component({
  selector: 'app-preguntas-dashboard-admin-detailview',
  templateUrl: './preguntas-dashboard-admin-detailview.component.html',
  styleUrl: './preguntas-dashboard-admin-detailview.component.scss',
})
export class PreguntasDashboardAdminDetailviewComponent {
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  preguntasService = inject(PreguntasService);
  temaService = inject(TemaService);
  fallosService = inject(ReportesFalloService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  viewportService = inject(ViewportService);
  examenesService = inject(ExamenesService);
  confirmationService = inject(ConfirmationService);
  store = inject(Store<AppState>);
  relevanciaHelper = inject(RelevanciaHelperService);
  @Input() expectedRole: Rol = Rol.ADMIN;
  
  // Helper para manejar la preselección de relevancia
  relevanciaPreseleccionHelper!: ReturnType<typeof this.relevanciaHelper.crearHelper>;
  
  public get isRelevanciaPreseleccionada() {
    return this.relevanciaPreseleccionHelper?.isRelevanciaPreseleccionada ?? false;
  }
  crearOtroControl = new FormControl(false);
  editorSolucion!: any;
  editorEnunciado!: any;
  @Input() mode: 'edit' | 'injected' | 'examen' = 'edit';
  //La pregunta que ha seleccionado desde el test que estaba realizando
  @Input() set injectedPregunta(data: Pregunta) {
    const cloned = cloneDeep(data) as Pregunta;
    cloned.id = undefined as any;
    cloned.dificultad = Dificultad.PRIVADAS;
    cloned.identificador = null as any;
    this.setLoadedPregunta(cloned).catch(console.error);
  }
  @Output() preguntaCreada = new EventEmitter<Pregunta>();

  public checked = {};


  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  private async processPreguntaRequest(
    requestFn: (identificador: string) => Observable<Pregunta>
  ): Promise<void> {
    const e = await firstValueFrom(
      requestFn(this.formGroup.value.identificador ?? '')
    );
    await this.setLoadedPregunta(e);
    this.navigatetoPregunta(e.id + '');
  }

  public siguientePregunta() {
    if (this.mode == 'examen') {
      this.processPreguntaRequest(
        this.examenesService.nextPregunta.bind(this.examenesService, this.examenId ?? '', this.lastLoadedPregunta().id + '')
      );
    } else {
      this.processPreguntaRequest(
        this.preguntasService.nextPregunta.bind(this.preguntasService)
      );
    }
  }

  public anteriorPregunta() {
    if (this.mode == 'examen') {
      this.processPreguntaRequest(
        this.examenesService.prevPregunta.bind(this.examenesService, this.examenId ?? '', this.lastLoadedPregunta().id + '')
      );
    } else {
      this.processPreguntaRequest(
        this.preguntasService.prevPregunta.bind(this.preguntasService)
      );
    }
  }

  public anteriorForwardPregunta() {
    if (this.mode == 'examen') {
      this.processPreguntaRequest(
        this.examenesService.prevPreguntaForward.bind(this.examenesService, this.examenId ?? '', this.lastLoadedPregunta().id + '')
      );
    } else {
      this.processPreguntaRequest(
        this.preguntasService.prevPreguntaForward.bind(this.preguntasService)
      );
    }
  }

  public siguienteForwardPregunta() {
    if (this.mode == 'examen') {
      this.processPreguntaRequest(
        this.examenesService.nextPreguntaForward.bind(this.examenesService, this.examenId ?? '', this.lastLoadedPregunta().id + '')
      );
    } else {
      this.processPreguntaRequest(
        this.preguntasService.nextPreguntaForward.bind(this.preguntasService)
      );
    }
  }

  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;

  // Propiedades para exámenes colaborativos
  public examenesColaborativosActivos = signal<any[]>([]);
  public Dificultad = Dificultad;

  formGroup = this.fb.group({
    identificador: [''],
    relevancia: this.fb.array([] as Array<Comunidad>),
    dificultad: [''],
    temaId: [0],
    descripcion: [''],
    solucion: [''],
    respuestas: this.fb.array([
      new FormControl(),
      new FormControl(),
      new FormControl(),
      new FormControl(),
    ]),
    respuestaCorrectaIndex: [0, Validators.required],
    seguridad: [''],
    examenId: [null as any],
  });

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormArray;
  }

  public get respuestas() {
    return this.formGroup.get('respuestas') as FormArray;
  }

  public parseControl = (control: any) => control as FormControl;
  public lastLoadedPregunta = signal<Pregunta>(null as any);
  getLetter = getLetter;

  private examenId: string | null = null;
  private esReserva = false;

  ngOnInit(): void {
    // Inicializar el helper después de que el FormArray esté disponible
    this.relevanciaPreseleccionHelper = this.relevanciaHelper.crearHelper(this.relevancia);
    
    if (this.mode == 'edit') {
      this.loadPregunta();
      firstValueFrom(this.getRole());

      // Obtener el examenId del queryParam si existe
      this.examenId = this.activedRoute.snapshot.queryParamMap.get('examenId');
      if (this.examenId) {
        this.mode = 'examen';
        this.formGroup.get('dificultad')?.patchValue('EXAMEN');
        this.formGroup.get('dificultad')?.disable();
      }

      this.esReserva = this.activedRoute.snapshot.queryParamMap.get('esReserva') === 'true';

      // Preseleccionar relevancia según rol
      this.preseleccionarRelevancia();
    }

    // Cargar exámenes colaborativos activos
    this.cargarExamenesColaborativos();

    // Suscribirse a cambios en la dificultad
    this.formGroup.get('dificultad')?.valueChanges.subscribe((dificultad) => {
      if (dificultad === Dificultad.COLABORATIVA) {
        this.formGroup.get('examenId')?.setValidators([Validators.required]);
      } else {
        this.formGroup.get('examenId')?.clearValidators();
        this.formGroup.get('examenId')?.setValue(null);
      }
      this.formGroup.get('examenId')?.updateValueAndValidity();
    });
  }

  private cargarExamenesColaborativos() {
    firstValueFrom(this.examenesService.getExamenesColaborativosActivos$()).then(
      (examenes) => {
        this.examenesColaborativosActivos.set(examenes);
      }
    );
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
        console.log(this.expectedRole);
      })
    );
  }

  private async setLoadedPregunta(pregunta: Pregunta) {
    this.lastLoadedPregunta.set(pregunta);
    this.formGroup.patchValue(pregunta);
    await this.relevanciaPreseleccionHelper.cargarRelevanciaExistente(pregunta.relevancia);
    this.respuestas.clear();
    pregunta.respuestas.forEach((respuesta) =>
      this.respuestas.push(
        new FormControl({ value: respuesta, disabled: true })
      )
    );
    setTimeout(() => {
      this.initEditor(
        this.formGroup.value.solucion ?? '',
        this.formGroup.value.descripcion ?? ''
      );
    }, 0);
    this.formGroup.markAsPristine();
  }

  private async loadPregunta() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
      this.initEditor('', '');
    } else {
      const entry = await firstValueFrom(
        this.preguntasService.getPreguntaById(itemId)
      );
      await this.setLoadedPregunta(entry);
    }
  }

  public enableAllRespuestas() {
    this.respuestas.controls.forEach((control) => control.enable());
  }

  public disableAllRespuestas() {
    this.respuestas.controls.forEach((control) => control.disable());
    this.respuestas.markAsPristine();
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

  public addNewPregunta() {
    this.respuestas.push(new FormControl(''));
  }

  private async updatePregunta() {
    const merged = {
      ...this.lastLoadedPregunta(),
      ...this.formGroup.getRawValue(),
    };
    const result = await firstValueFrom(
      this.preguntasService.updatePregunta$(merged as Pregunta)
    );
    return result;
  }

  public async actualizarPregunta() {
    await this.updatePregunta();
    this.toast.success('Pregunta actualizada con éxito!', 'Guardado exitoso');
    this.loadPregunta();
  }

  public async crearPregunta() {
    const res = await this.updatePregunta();
    this.toast.success('Pregunta creada con éxito!', 'Creación exitosa');

    // Si hay un examenId en los queryParams, vincular la pregunta al examen
    if (this.examenId) {
      await firstValueFrom(
        this.examenesService.addPreguntasToExamen$(
          parseInt(this.examenId),
          [res.id],
          this.esReserva
        )
      );

      // Redirigir de vuelta al examen
      //await this.router.navigate(['/app/examen', this.examenId]);
      //Cambiado a recargar pregunta actual
      await this.navigatetoPregunta(res.id + '');
      this.loadPregunta();
      return;
    }

    if (!this.crearOtroControl.value && this.mode == 'edit') {
      await this.navigatetoPregunta(res.id + '');
      this.loadPregunta();
    }
    this.preguntaCreada.emit(res);
  }

  private initEditor(initialValue: string, initialEnunciadoValue: string) {
    setTimeout(() => {
      if (this.editorSolucion) {
        this.editorSolucion.destroy();
        this.editorSolucion = null;
      }
      if (this.editorEnunciado) {
        this.editorEnunciado.destroy();
        this.editorEnunciado = null;
      }

      this.editorSolucion = new Editor({
        el: document.querySelector('#editor')!,
        ...universalEditorConfig,
        initialValue: initialValue || '',
        events: {
          change: () => {
            this.formGroup
              .get('solucion')
              ?.patchValue(this.editorSolucion.getMarkdown());
          },
        },
      });

      this.editorEnunciado = new Editor({
        el: document.querySelector('#editor-enunciado')!,
        ...universalEditorConfig,
        initialValue: initialEnunciadoValue || '',
        events: {
          change: () => {
            this.formGroup
              .get('descripcion')
              ?.patchValue(this.editorEnunciado.getMarkdown());
          },
        },
      });
    }, 0);
  }

  private async navigatetoPregunta(id: string) {
    // Obtener los query params actuales
    const currentQueryParams = { ...this.activedRoute.snapshot.queryParams };

    if (this.expectedRole == 'ADMIN') {
      await this.router.navigate(['app/test/preguntas/' + id], {
        replaceUrl: true,
        queryParams: currentQueryParams
      });
    } else {
      await this.router.navigate(['/app/test/alumno/preguntas/' + id], {
        replaceUrl: true,
        queryParams: currentQueryParams
      });
    }
  }

  public eliminarFallo(id: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: '¿Deseas marcar este fallo como solucionado? Se eliminará de la lista de fallos reportados.',
      header: 'Marcar como solucionado',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.fallosService.deleteReporteFallo$(id));
        this.toast.info('Fallo marcado como solucionado exitosamente');
        // Recargar la pregunta para actualizar la lista de fallos
        this.loadPregunta();
      },
      reject: () => { },
    });
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      if (this.expectedRole == 'ADMIN') {
        this.router.navigate(['app/test/preguntas/']);
      } else {
        this.router.navigate(['/app/test/alumno/preguntas/']);
      }
    }
  }
}
