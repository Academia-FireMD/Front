import { Location } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
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
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  tap,
} from 'rxjs';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { PreguntasService } from '../../../services/preguntas.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { TemaService } from '../../../services/tema.service';
import { ViewportService } from '../../../services/viewport.service';
import { PaginatedResult } from '../../../shared/models/pagination.model';
import {
  Comunidad,
  Dificultad,
  Pregunta,
  PreguntaFallo,
} from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import {
  getAllDifficultades,
  getLetter,
  getStarsBasedOnDifficulty,
  groupedTemas,
  universalEditorConfig,
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
  @Input() expectedRole: Rol = Rol.ADMIN;
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
    this.setLoadedPregunta(cloned);
  }
  @Output() preguntaCreada = new EventEmitter<Pregunta>();

  public checked = {};
  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas, this.expectedRole == 'ADMIN');
    })
  );

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  private processPreguntaRequest(
    requestFn: (identificador: string) => Observable<Pregunta>
  ): void {
    firstValueFrom(
      requestFn(this.formGroup.value.identificador ?? '').pipe(
        tap((e) => {
          this.setLoadedPregunta(e);
          this.navigatetoPregunta(e.id + '');
        })
      )
    );
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
  public getAllDifficultades = getAllDifficultades;

  public dialogVisible = false;

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
  });

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormArray;
  }

  public get respuestas() {
    return this.formGroup.get('respuestas') as FormArray;
  }

  public parseControl = (control: any) => control as FormControl;
  public lastLoadedPregunta = signal<Pregunta>(null as any);
  public lastLoadedFallosPreguntaPagination!: PaginatedResult<PreguntaFallo>;
  public getFallosPregunta$ = computed(() => {
    if (!this.lastLoadedPregunta()) return of(0);
    return this.fallosService
      .getReporteFallos$({
        take: 99999,
        skip: 0,
        searchTerm: this.lastLoadedPregunta().identificador ?? '',
      })
      .pipe(
        tap((e) => {
          this.lastLoadedFallosPreguntaPagination = e;
        }),
        map((e) => e?.data?.length ?? 0)
      );
  });
  getLetter = getLetter;

  private examenId: string | null = null;
  private esReserva = false;

  ngOnInit(): void {
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

  private setLoadedPregunta(pregunta: Pregunta) {
    this.lastLoadedPregunta.set(pregunta);
    this.formGroup.patchValue(pregunta);
    this.relevancia.clear();
    pregunta.relevancia.forEach((relevancia) =>
      this.relevancia.push(new FormControl(relevancia))
    );
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

  private loadPregunta() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
      this.initEditor('', '');
    } else {
      firstValueFrom(
        this.preguntasService.getPreguntaById(itemId).pipe(
          tap((entry) => {
            this.setLoadedPregunta(entry);
          })
        )
      );
    }
  }

  public enableAllRespuestas() {
    this.respuestas.controls.forEach((control) => control.enable());
  }

  public disableAllRespuestas() {
    this.respuestas.controls.forEach((control) => control.disable());
    this.respuestas.markAsPristine();
  }

  public updateCommunitySelection(communities: Comunidad[]) {
    this.relevancia.clear();
    communities.forEach((code) => this.relevancia.push(new FormControl(code)));
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
