import { Location } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
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
import { combineLatest, filter, firstValueFrom, map, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import { TemaService } from '../../../services/tema.service';
import { ViewportService } from '../../../services/viewport.service';
import {
  Comunidad,
  Dificultad,
  Pregunta,
} from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import {
  getAllDifficultades,
  getLetter,
  getStarsBasedOnDifficulty,
  groupedTemas,
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
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  viewportService = inject(ViewportService);
  public expectedRole: Rol = Rol.ADMIN;
  crearOtroControl = new FormControl(false);
  editorSolucion!: any;
  editorEnunciado!: any;
  @Input() mode: 'edit' | 'injected' = 'edit';
  //La pregunta que ha seleccionado desde el test que estaba realizando
  @Input() set injectedPregunta(data: Pregunta) {
    const cloned = cloneDeep(data) as Pregunta;
    cloned.id = undefined as any;
    cloned.dificultad = Dificultad.PRIVADAS;
    this.setLoadedPregunta(cloned);
  }
  @Output() preguntaCreada = new EventEmitter<Pregunta>();

  public checked = {};
  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas);
    })
  );

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public siguientePregunta() {
    firstValueFrom(
      this.preguntasService
        .nextPregunta(this.formGroup.value.identificador ?? '')
        .pipe(
          tap((e) => {
            this.setLoadedPregunta(e);
            this.navigatetoPregunta(e.id + '');
          })
        )
    );
  }

  public anteriorPregunta() {
    firstValueFrom(
      this.preguntasService
        .prevPregunta(this.formGroup.value.identificador ?? '')
        .pipe(
          tap((e) => {
            this.setLoadedPregunta(e);
            this.navigatetoPregunta(e.id + '');
          })
        )
    );
  }

  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;
  public getAllDifficultades = getAllDifficultades;

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
  public lastLoadedPregunta!: Pregunta;
  getLetter = getLetter;

  ngOnInit(): void {
    if (this.mode == 'edit') {
      this.loadPregunta();
      firstValueFrom(this.getRole());
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
    this.lastLoadedPregunta = pregunta;
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
      ...this.lastLoadedPregunta,
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
      height: '400px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      autofocus: false,
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
      height: '400px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      autofocus: false,
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
    if (this.expectedRole == 'ADMIN') {
      await this.router.navigate(['app/test/preguntas/' + id], {
        replaceUrl: true,
      });
    } else {
      await this.router.navigate(['/app/test/alumno/preguntas/' + id], {
        replaceUrl: true,
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
