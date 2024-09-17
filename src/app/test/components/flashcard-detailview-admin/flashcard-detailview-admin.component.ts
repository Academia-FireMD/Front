import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Editor } from '@toast-ui/editor';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, map, tap } from 'rxjs';
import { FlashcardDataService } from '../../../services/flashcards.service';
import { TemaService } from '../../../services/tema.service';
import { FlashcardData } from '../../../shared/models/flashcard.model';
import { Comunidad } from '../../../shared/models/pregunta.model';
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
  flashCardService = inject(FlashcardDataService);

  editor!: any;
  editorEnunciado!: any;

  private initEditor(initialValue: string, initialEnunciadoValue: string) {
    this.editor = new Editor({
      el: document.querySelector('#editor')!,
      height: '400px',
      initialEditType: 'markdown',
      previewStyle: 'vertical',
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

  public getAllDifficultades = getAllDifficultades(true);

  ngOnInit(): void {
    this.loadFlashcard();
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
      this.router.navigate(['/app/test/flashcards']);
    }
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
            this.lastLoadedFlashcard = entry;
            this.formGroup.patchValue(entry);
            this.relevancia.clear();
            entry.relevancia.forEach((relevancia) =>
              this.relevancia.push(new FormControl(relevancia))
            );
            this.formGroup.markAsPristine();
            this.initEditor(
              this.formGroup.value.solucion ?? '',
              this.formGroup.value.descripcion ?? ''
            );
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
    await this.router.navigate(['app/test/flashcards/' + res.id]);
    this.loadFlashcard();
  }
}
