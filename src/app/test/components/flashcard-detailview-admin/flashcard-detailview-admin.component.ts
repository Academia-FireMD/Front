import { Location } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormArray, FormBuilder, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@toast-ui/editor';
import { cloneDeep } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { combineLatest, filter, firstValueFrom, map, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TemaService } from '../../../services/tema.service';
import { ViewportService } from '../../../services/viewport.service';
import { FlashcardData } from '../../../shared/models/flashcard.model';
import { Comunidad, Dificultad } from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import { getAllDifficultades, groupedTemas } from '../../../utils/utils';
@Component({
  selector: 'app-flashcard-detailview-admin',
  templateUrl: './flashcard-detailview-admin.component.html',
  styleUrl: './flashcard-detailview-admin.component.scss',
})
export class FlashcardDetailviewAdminComponent {
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  temaService = inject(TemaService);
  viewportService = inject(ViewportService);
  flashCardService = inject(FlashcardDataService);
  public expectedRole: Rol = Rol.ADMIN;
  editor!: any;
  editorEnunciado!: any;
  crearOtroControl = new FormControl(false);
  @Input() mode: 'edit' | 'injected' = 'edit';
  //La flashcard que ha seleccionado desde el test que estaba realizando
  @Input() set injectedFlashcard(data: FlashcardData) {
    const cloned = cloneDeep(data) as FlashcardData;
    cloned.id = undefined as any;
    cloned.dificultad = Dificultad.PRIVADAS;
    this.setFlashcard(cloned);
  }
  @Output() flashcardCreada = new EventEmitter<FlashcardData>();

  public siguienteFlashcard() {
    firstValueFrom(
      this.flashCardService
        .nextFlashcard(this.formGroup.value.identificador ?? '')
        .pipe(
          tap((e) => {
            this.setFlashcard(e);
            this.navigateToFlashcard(e.id + '');
          })
        )
    );
  }

  public anteriorFlashcard() {
    firstValueFrom(
      this.flashCardService
        .prevFlashcard(this.formGroup.value.identificador ?? '')
        .pipe(
          tap((e) => {
            this.setFlashcard(e);
            this.navigateToFlashcard(e.id + '');
          })
        )
    );
  }

  private initEditor(initialValue: string, initialEnunciadoValue: string) {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    if (this.editorEnunciado) {
      this.editorEnunciado.destroy();
      this.editorEnunciado = null;
    }
    this.editor = new Editor({
      el: document.querySelector('#editor')!,
      height: '400px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      autofocus: false,
      initialValue: initialValue || '',
      events: {
        change: () => {
          this.formGroup.get('solucion')?.patchValue(this.editor.getMarkdown());
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

  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas);
    })
  );

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

  public getAllDifficultades = getAllDifficultades;

  ngOnInit(): void {
    if (this.mode == 'edit') {
      this.loadFlashcard();
      firstValueFrom(this.getRole());
    }
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
  }

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public get relevancia() {
    return this.formGroup.get('relevancia') as FormArray;
  }

  public lastLoadedFlashcard!: FlashcardData;

  formGroup = this.fb.group({
    identificador: [''],
    relevancia: this.fb.array([] as Array<Comunidad>),
    dificultad: [''],
    temaId: [0],
    descripcion: [''],
    solucion: [''],
    seguridad: [''],
  });

  public updateCommunitySelection(communities: Comunidad[]) {
    this.relevancia.clear();
    communities.forEach((code) => this.relevancia.push(new FormControl(code)));
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      if (this.expectedRole == 'ADMIN') {
        this.router.navigate(['/app/test/flashcards']);
      } else {
        this.router.navigate(['/app/test/alumno/flashcards']);
      }
    }
  }

  private setFlashcard(flashcard: FlashcardData) {
    this.lastLoadedFlashcard = flashcard;
    this.formGroup.patchValue(flashcard);
    this.relevancia.clear();
    flashcard.relevancia.forEach((relevancia) =>
      this.relevancia.push(new FormControl(relevancia))
    );
    this.formGroup.markAsPristine();
    setTimeout(() => {
      this.initEditor(
        this.formGroup.value.solucion ?? '',
        this.formGroup.value.descripcion ?? ''
      );
    }, 0);
  }

  private loadFlashcard() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
      this.initEditor('', '');
    } else {
      firstValueFrom(
        this.flashCardService.getFlashcardById(itemId).pipe(
          tap((entry) => {
            this.setFlashcard(entry);
          })
        )
      );
    }
  }

  private async updateFlashcard() {
    const merged = {
      ...this.lastLoadedFlashcard,
      ...this.formGroup.getRawValue(),
    };
    const result = await firstValueFrom(
      this.flashCardService.updateFlashcard$(merged as FlashcardData)
    );
    return result;
  }

  public async actualizarFlashcard() {
    await this.updateFlashcard();
    this.toast.success('Flashcard actualizada con éxito!', 'Guardado exitoso');
    this.loadFlashcard();
  }

  public async crearFlashcard() {
    const res = await this.updateFlashcard();
    this.toast.success('Flashcard creada con éxito!', 'Creación exitosa');
    if (!this.crearOtroControl.value && this.mode == 'edit') {
      await this.navigateToFlashcard(res.id + '');
      this.loadFlashcard();
    }
    this.flashcardCreada.emit(res);
  }

  private async navigateToFlashcard(id: string) {
    if (this.expectedRole == 'ADMIN') {
      await this.router.navigate(['app/test/flashcards/' + id], {
        replaceUrl: true,
      });
    } else {
      await this.router.navigate(['app/test/alumno/flashcards/' + id], {
        replaceUrl: true,
      });
    }
  }
}
