import { Location } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal
} from '@angular/core';
import { FormArray, FormBuilder, FormControl } from '@angular/forms';
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
import { FlashcardDataService } from '../../../services/flashcards.service';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { TemaService } from '../../../services/tema.service';
import { ViewportService } from '../../../services/viewport.service';
import { FlashcardData } from '../../../shared/models/flashcard.model';
import {
  Comunidad,
  Dificultad,
} from '../../../shared/models/pregunta.model';
import { Rol } from '../../../shared/models/user.model';
import { RelevanciaHelperService } from '../../../shared/services/relevancia-helper.service';
import { AppState } from '../../../store/app.state';
import { selectCurrentUser } from '../../../store/user/user.selectors';
import {
  getAllDifficultades,
  universalEditorConfig
} from '../../../utils/utils';
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
  confirmationService = inject(ConfirmationService);
  store = inject(Store<AppState>);
  relevanciaHelper = inject(RelevanciaHelperService);
  public expectedRole: Rol = Rol.ADMIN;
  
  // Helper para manejar la preselección de relevancia
  relevanciaPreseleccionHelper!: ReturnType<typeof this.relevanciaHelper.crearHelper>;
  
  public get isRelevanciaPreseleccionada() {
    return this.relevanciaPreseleccionHelper?.isRelevanciaPreseleccionada ?? false;
  }
  editor!: any;
  editorEnunciado!: any;
  crearOtroControl = new FormControl(false);
  @Input() mode: 'edit' | 'injected' = 'edit';
  //La flashcard que ha seleccionado desde el test que estaba realizando
  @Input() set injectedFlashcard(data: FlashcardData) {
    const cloned = cloneDeep(data) as FlashcardData;
    cloned.id = undefined as any;
    cloned.dificultad = Dificultad.PRIVADAS;
    cloned.identificador = null as any;
    this.setFlashcard(cloned).catch(console.error);
  }
  @Output() flashcardCreada = new EventEmitter<FlashcardData>();
  private async processFlashcardRequest(
    requestFn: (identificador: string) => Observable<FlashcardData>
  ): Promise<void> {
    const flashcard = await firstValueFrom(
      requestFn(this.formGroup.value.identificador ?? '')
    );
    await this.setFlashcard(flashcard);
    this.navigateToFlashcard(flashcard.id + '');
  }

  public siguienteFlashcard() {
    this.processFlashcardRequest(
      this.flashCardService.nextFlashcard.bind(this.flashCardService)
    );
  }

  public anteriorFlashcard() {
    this.processFlashcardRequest(
      this.flashCardService.prevFlashcard.bind(this.flashCardService)
    );
  }

  public anteriorForwardFlashcard() {
    this.processFlashcardRequest(
      this.flashCardService.prevFlashcardForward.bind(this.flashCardService)
    );
  }

  public siguienteForwardFlashcard() {
    this.processFlashcardRequest(
      this.flashCardService.nextFlashcardForward.bind(this.flashCardService)
    );
  }

  private initEditor(initialValue: string, initialEnunciadoValue: string) {
    setTimeout(() => {
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
        ...universalEditorConfig,
        initialValue: initialValue || '',
        events: {
          change: () => {
            this.formGroup.get('solucion')?.patchValue(this.editor.getMarkdown());
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
    // Inicializar el helper después de que el FormArray esté disponible
    this.relevanciaPreseleccionHelper = this.relevanciaHelper.crearHelper(this.relevancia);
    
    if (this.mode == 'edit') {
      this.loadFlashcard();
      firstValueFrom(this.getRole());

      // Preseleccionar relevancia según rol
      this.preseleccionarRelevancia();
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
  fallosService = inject(ReportesFalloService);

  public lastLoadedFlashcard = signal<FlashcardData>(null as any);

  formGroup = this.fb.group({
    identificador: [''],
    relevancia: this.fb.array([] as Array<Comunidad>),
    dificultad: [''],
    temaId: [0],
    descripcion: [''],
    solucion: [''],
    seguridad: [''],
  });

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

  private async setFlashcard(flashcard: FlashcardData) {
    this.lastLoadedFlashcard.set(flashcard);
    this.formGroup.patchValue(flashcard);
    await this.relevanciaPreseleccionHelper.cargarRelevanciaExistente(flashcard.relevancia);
    this.formGroup.markAsPristine();
    setTimeout(() => {
      this.initEditor(
        this.formGroup.value.solucion ?? '',
        this.formGroup.value.descripcion ?? ''
      );
    }, 0);
  }

  private async loadFlashcard() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
      this.initEditor('', '');
    } else {
      const entry = await firstValueFrom(
        this.flashCardService.getFlashcardById(itemId)
      );
      await this.setFlashcard(entry);
    }
  }

  private async updateFlashcard() {
    const merged = {
      ...this.lastLoadedFlashcard(),
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
        // Recargar la flashcard para actualizar la lista de fallos
        this.loadFlashcard();
      },
      reject: () => { },
    });
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
