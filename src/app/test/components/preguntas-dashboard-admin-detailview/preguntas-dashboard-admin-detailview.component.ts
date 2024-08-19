import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, tap } from 'rxjs';
import { PreguntasService } from '../../../services/preguntas.service';
import {
  Comunidad,
  Dificultad,
  Pregunta,
} from '../../../shared/models/pregunta.model';
import { getStarsBasedOnDifficulty } from '../../../utils/utils';

@Component({
  selector: 'app-preguntas-dashboard-admin-detailview',
  templateUrl: './preguntas-dashboard-admin-detailview.component.html',
  styleUrl: './preguntas-dashboard-admin-detailview.component.scss',
})
export class PreguntasDashboardAdminDetailviewComponent {
  activedRoute = inject(ActivatedRoute);
  preguntasService = inject(PreguntasService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  public checked = {};
  public getAllTemas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((entry) => {
    return {
      label: 'Tema ' + entry,
      code: entry,
    };
  });

  public getStarsBasedOnDifficulty = getStarsBasedOnDifficulty;
  public getAllDifficultades = Object.keys(Dificultad).map((entry) => {
    const map = {
      [Dificultad.BASICO]: {
        label: 'Basico',
        stars: getStarsBasedOnDifficulty(Dificultad.BASICO),
        value: Dificultad.BASICO,
      },
      [Dificultad.INTERMEDIO]: {
        label: 'Intermedio',
        stars: getStarsBasedOnDifficulty(Dificultad.INTERMEDIO),
        value: Dificultad.INTERMEDIO,
      },
      [Dificultad.DIFICIL]: {
        label: 'Dificil',
        stars: getStarsBasedOnDifficulty(Dificultad.DIFICIL),
        value: Dificultad.DIFICIL,
      },
    } as any;
    return map[entry];
  });

  formGroup = this.fb.group({
    identificador: [''],
    relevancia: this.fb.array([] as Array<Comunidad>),
    dificultad: [''],
    tema: [0],
    descripcion: [''],
    solucion: [''],
    respuestas: this.fb.array([]),
    respuestaCorrectaIndex: [0],
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
  getLetter(index: number): string {
    return String.fromCharCode(97 + index);
  }
  ngOnInit(): void {
    this.loadPregunta();
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
  }

  private loadPregunta() {
    const itemId = this.getId();
    if (itemId == 'new') {
      this.formGroup.reset();
    } else {
      firstValueFrom(
        this.preguntasService.getPreguntaById(itemId).pipe(
          tap((entry) => {
            this.lastLoadedPregunta = entry;
            this.formGroup.patchValue(entry);
            this.relevancia.clear();
            entry.relevancia.forEach((relevancia) =>
              this.relevancia.push(new FormControl(relevancia))
            );
            this.respuestas.clear();
            entry.respuestas.forEach((respuesta) =>
              this.respuestas.push(
                new FormControl({ value: respuesta, disabled: true })
              )
            );
            this.formGroup.markAsPristine();
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
    this.toast.success('Pregunta actualizada con exito!', 'Guardado exitoso');
    this.loadPregunta();
  }

  public async crearPregunta() {
    const res = await this.updatePregunta();
    this.toast.success('Pregunta creada con exito!', 'Creación exitosa');
    await this.router.navigate(['app/test/preguntas/' + res.id]);
    this.loadPregunta();
  }
}
