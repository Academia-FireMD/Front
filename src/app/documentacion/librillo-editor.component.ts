import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import {
  Observable,
  distinctUntilChanged,
  firstValueFrom,
  map,
  timeout,
} from 'rxjs';
import {
  EdicionPdf,
  LibrilloPdfApiService,
  ReferenciaPdf,
  TipoReferenciaPdf,
} from '../estudio/previa/librillo-pdf-api.service';
import {
  FragmentoPdf,
  PreviaLibrillosPdfComponent,
} from '../estudio/previa/previa-librillos-pdf.component';
import { FlashcardDataService } from '../services/flashcards.service';
import { PreguntasService } from '../services/preguntas.service';
import { DocumentoTemario } from '../shared/models/documentacion.model';
import { Dificultad } from '../shared/models/pregunta.model';
import { parametrosListaDocumentacion } from './documentation-list-state';
import { DocumentosService } from './services/documentacion.service';

const REFERENCIAS_NO_DISPONIBLES =
  'Este PDF ya no está disponible para edición desde Documentación.';
const COLOR_INICIAL = '#ffd646';
const TIPO_INICIAL: TipoReferenciaPdf = 'DATO';

const TIPOS: Array<{ tipo: TipoReferenciaPdf; nombre: string }> = [
  { tipo: 'PREGUNTA', nombre: 'Pregunta' },
  { tipo: 'TARJETA', nombre: 'Flashcard' },
  { tipo: 'SUGERIDO', nombre: 'Subrayado sugerido' },
  { tipo: 'HUECO', nombre: 'Hueco' },
  { tipo: 'DATO', nombre: 'Dato de repaso' },
  { tipo: 'TRAMPA', nombre: 'Trampa' },
];

@Component({
  selector: 'app-librillo-editor',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DialogModule,
    PreviaLibrillosPdfComponent,
  ],
  templateUrl: './librillo-editor.component.html',
  styleUrl: './librillo-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrilloEditorComponent {
  private readonly api = inject(LibrilloPdfApiService);
  private readonly documentos = inject(DocumentosService);
  private readonly preguntas = inject(PreguntasService);
  private readonly tarjetas = inject(FlashcardDataService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);
  private readonly visor = viewChild(PreviaLibrillosPdfComponent);
  private readonly campoTexto =
    viewChild<ElementRef<HTMLTextAreaElement>>('campoTexto');
  private readonly botonVistaPrevia =
    viewChild<ElementRef<HTMLButtonElement>>('botonVistaPrevia');
  readonly parametrosLista = parametrosListaDocumentacion(
    this.ruta.snapshot.queryParamMap,
  );
  private cargaDocumento = 0;
  private readonly edicionFormulario = signal<EdicionPdf | null>(null);
  private readonly referenciaEditada = signal<ReferenciaPdf | null>(null);
  private resolverConfirmacion?: (continuar: boolean) => void;
  private salidaPendiente?: Promise<boolean>;
  private restaurarFoco = false;
  readonly confirmarCambios = signal(false);
  readonly vistaPrevia = signal(false);
  readonly cargandoVistaPrevia = signal(false);
  readonly falloVistaPrevia = signal('');
  readonly referenciasVistaPrevia = signal<ReferenciaPdf[]>([]);
  readonly revisionCaducada = signal(false);
  readonly cargandoEdicion = signal(false);
  readonly edicionValidada = signal(false);
  readonly accionesSuspendidas = computed(
    () =>
      this.vistaPrevia() || this.revisionCaducada() || !this.edicionValidada(),
  );
  readonly documento = signal<DocumentoTemario | null>(null);
  readonly edicion = signal<EdicionPdf | null>(null);
  readonly referencias = signal<ReferenciaPdf[]>([]);
  readonly seleccion = signal<FragmentoPdf | null>(null);
  readonly cargando = signal(true);
  readonly ocupado = signal(false);
  readonly aviso = signal('');
  readonly fallo = signal('');
  readonly tipo = signal<TipoReferenciaPdf>(TIPO_INICIAL);
  readonly texto = signal('');
  readonly color = signal(COLOR_INICIAL);
  readonly editando = computed(() => this.referenciaEditada()?.id);
  readonly publicada = computed(
    () => this.referenciaEditada()?.estado === 'publicada',
  );
  readonly puedeEditarSugerencia = computed(
    () => this.referenciaEditada()?.tipo === 'SUGERIDO',
  );
  readonly formularioVigente = computed(() => {
    const origen = this.edicionFormulario();
    const actual = this.edicion();
    return origen?.doc === actual?.doc && origen?.revision === actual?.revision;
  });
  readonly hayCambios = computed(() => {
    if (!this.seleccion()) return false;
    const ref = this.referenciaEditada();
    return (
      !ref ||
      ref.tipo !== this.tipo() ||
      (ref.texto ?? '').trim() !== this.texto().trim() ||
      (ref.color ?? COLOR_INICIAL) !== this.color() ||
      (this.usaBanco() &&
        (ref.preguntaId ?? ref.flashcardId ?? null) !== this.materialId())
    );
  });
  readonly materialId = signal<number | null>(null);
  readonly buscar = signal('');
  readonly opciones = signal<Array<{ id: number; nombre: string }>>([]);
  readonly usaBanco = computed(
    () => this.tipo() === 'PREGUNTA' || this.tipo() === 'TARJETA',
  );
  readonly materialVinculadoEnOpciones = computed(() =>
    this.opciones().some(({ id }) => id === this.materialId()),
  );
  readonly puedeGuardar = computed(
    () =>
      !!this.seleccion() &&
      this.formularioVigente() &&
      this.edicionValidada() &&
      (!this.usaBanco() || !!this.materialId()) &&
      (this.tipo() !== 'SUGERIDO' || this.puedeEditarSugerencia()),
  );
  readonly tipos = TIPOS;

  constructor() {
    this.ruta.paramMap
      .pipe(
        map((params) => Number(params.get('documentoId'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destruir),
      )
      .subscribe((id) => void this.cargarDocumento(id));
    this.destruir.onDestroy(() => this.resolverCambios(false));
  }

  private async cargarDocumento(id: number) {
    const carga = ++this.cargaDocumento;
    this.documento.set(null);
    this.edicion.set(null);
    this.edicionValidada.set(false);
    this.revisionCaducada.set(false);
    this.referencias.set([]);
    this.aviso.set('');
    this.limpiar();
    this.volverAEdicion();
    this.cargando.set(true);
    this.fallo.set('');
    try {
      const { data } = await this.pedir(
        this.documentos.getDocumentosPublicos$({
          take: 1,
          skip: 0,
          searchTerm: '',
          where: { id },
        }),
      );
      if (this.cargaDocumento !== carga) return;
      const doc = data.find((resultado) => resultado.id === id);
      if (!doc?.temaId || !/\.pdf(?:$|[?#])/i.test(doc.fileName || doc.url)) {
        this.fallo.set(
          'Selecciona un PDF asignado a un tema desde Documentación.',
        );
        return;
      }
      this.documento.set({ ...doc, isDownloadable: true, isNew: false });
    } catch (error) {
      if (this.cargaDocumento === carga)
        this.reportar(error, 'No se pudo abrir el documento.');
    } finally {
      if (this.cargaDocumento === carga) this.cargando.set(false);
    }
  }

  async abrirEdicion(edicion: EdicionPdf) {
    if (edicion.doc !== this.documento()?.id) return;
    const anterior = this.edicion();
    this.edicion.set(edicion);
    this.cargandoEdicion.set(true);
    this.edicionValidada.set(false);
    this.fallo.set('');
    if (anterior && anterior.revision !== edicion.revision) {
      this.referencias.set([]);
      if (!this.hayCambios()) this.limpiar();
      this.aviso.set('Se cargó otra revisión del PDF.');
    }
    try {
      const resultado = await this.pedir(this.api.editor(edicion));
      if (this.edicion() !== edicion) return;
      if (resultado.revision !== edicion.revision) {
        this.suspenderRevision();
        return;
      }
      this.referencias.set(resultado.referencias);
      this.edicionValidada.set(true);
      this.revisionCaducada.set(false);
    } catch (error) {
      if (this.edicion() !== edicion) return;
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.fallo.set(REFERENCIAS_NO_DISPONIBLES);
      } else {
        this.reportar(error, 'No se pudieron cargar las referencias.');
      }
    } finally {
      if (this.edicion() === edicion) this.cargandoEdicion.set(false);
    }
  }

  async abrirVistaPrevia() {
    const edicion = this.edicion();
    if (!edicion || this.accionesSuspendidas() || this.ocupado()) return;
    this.vistaPrevia.set(true);
    this.cargandoVistaPrevia.set(true);
    this.falloVistaPrevia.set('');
    this.referenciasVistaPrevia.set([]);
    try {
      const { revision, referencias } = await this.pedir(
        this.api.editor(edicion, 'alumno'),
      );
      if (this.edicion() !== edicion || !this.vistaPrevia()) return;
      if (revision !== edicion.revision) {
        this.suspenderRevision();
        return;
      }
      this.referenciasVistaPrevia.set(
        referencias.filter(
          (ref) =>
            ref.estado === 'publicada' &&
            ref.tipo !== 'SUGERIDO' &&
            ref.revision === revision,
        ),
      );
    } catch (error) {
      if (this.edicion() !== edicion || !this.vistaPrevia()) return;
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.falloVistaPrevia.set(REFERENCIAS_NO_DISPONIBLES);
      } else if (error instanceof HttpErrorResponse && error.status === 409) {
        this.suspenderRevision();
      } else {
        this.falloVistaPrevia.set(
          'No se pudo cargar la vista previa del Librillo.',
        );
      }
    } finally {
      if (this.edicion() === edicion) this.cargandoVistaPrevia.set(false);
    }
  }

  volverAEdicion() {
    this.vistaPrevia.set(false);
    this.cargandoVistaPrevia.set(false);
    this.falloVistaPrevia.set('');
    this.referenciasVistaPrevia.set([]);
  }

  async recargarRevision() {
    const visor = this.visor();
    if (!visor || this.cargandoEdicion() || this.ocupado()) return;
    this.volverAEdicion();
    this.cargandoEdicion.set(true);
    try {
      await visor.abrir();
    } finally {
      if (!visor.edicion()) this.cargandoEdicion.set(false);
    }
  }

  private suspenderRevision() {
    this.revisionCaducada.set(true);
    this.edicionValidada.set(false);
    this.fallo.set(
      'La revisión del PDF cambió. Recarga y valida la revisión antes de continuar.',
    );
  }

  async seleccionar(fragmento: FragmentoPdf) {
    const edicion = this.edicion();
    if (this.accionesSuspendidas() || !(await this.confirmarAccion())) return;
    if (this.edicion() !== edicion || this.accionesSuspendidas()) return;
    this.limpiar();
    this.edicionFormulario.set(edicion);
    this.seleccion.set(fragmento);
    this.texto.set(fragmento.fragmento);
    this.enfocarReferencia(fragmento.pagina, null);
  }

  confirmarSalida() {
    // El enlace del menú lateral puede emitir dos navegaciones por clic.
    return (this.salidaPendiente ??= this.confirmarAccion().finally(() => {
      this.salidaPendiente = undefined;
    }));
  }

  @HostListener('window:beforeunload', ['$event'])
  confirmarCierre(evento: BeforeUnloadEvent) {
    if (this.hayCambios() || this.ocupado()) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  }

  private confirmarAccion(cambios = this.hayCambios()): Promise<boolean> {
    if (this.ocupado() || this.confirmarCambios())
      return Promise.resolve(false);
    if (!cambios) return Promise.resolve(true);
    return new Promise((resolver) => {
      this.resolverConfirmacion = resolver;
      this.confirmarCambios.set(true);
    });
  }

  resolverCambios(continuar: boolean) {
    const resolver = this.resolverConfirmacion;
    if (!resolver) return;
    this.restaurarFoco = !continuar;
    this.resolverConfirmacion = undefined;
    this.confirmarCambios.set(false);
    resolver(continuar);
  }

  enfocarEdicion() {
    if (!this.restaurarFoco || this.confirmarCambios()) return;
    this.restaurarFoco = false;
    const control = this.campoTexto() ?? this.botonVistaPrevia();
    control?.nativeElement.focus({ preventScroll: true });
  }

  async guardarYContinuar() {
    if (this.ocupado() || !this.confirmarCambios()) return;
    const guardada = await this.guardar(
      this.publicada() ? 'publicada' : 'borrador',
    );
    this.resolverCambios(guardada);
  }

  async cancelarEdicion() {
    if (await this.confirmarAccion()) this.limpiar();
  }

  async seleccionarTipo(tipo: TipoReferenciaPdf) {
    if (this.ocupado()) return;
    this.tipo.set(tipo);
    this.materialId.set(null);
    this.opciones.set([]);
    if (this.usaBanco()) await this.buscarMaterial();
  }

  async buscarMaterial() {
    const temaId = this.documento()?.temaId;
    const tipo = this.tipo();
    const consulta = this.buscar().trim();
    if (
      this.accionesSuspendidas() ||
      !this.formularioVigente() ||
      !temaId ||
      !this.usaBanco()
    )
      return;
    const filtro = {
      take: 25,
      skip: 0,
      searchTerm: consulta,
      where: {
        temaId,
        dificultad: { notIn: [Dificultad.PRIVADAS, Dificultad.EXAMEN] },
      },
    };
    try {
      const { data } =
        tipo === 'PREGUNTA'
          ? await this.pedir(this.preguntas.getPreguntas$(filtro))
          : await this.pedir(this.tarjetas.getFlashcards$(filtro));
      if (
        this.documento()?.temaId !== temaId ||
        this.tipo() !== tipo ||
        this.buscar().trim() !== consulta
      )
        return;
      this.opciones.set(
        data
          .filter(
            (item) =>
              item.temaId === temaId &&
              ![Dificultad.PRIVADAS, Dificultad.EXAMEN].includes(
                item.dificultad,
              ),
          )
          .map((item) => ({
            id: item.id,
            nombre:
              item.identificador +
              ' · ' +
              item.descripcion.replace(/<[^>]+>/g, ' ').slice(0, 120),
          })),
      );
    } catch (error) {
      this.reportar(error, 'No se pudo buscar en el banco del tema.');
    }
  }

  async editar(ref: ReferenciaPdf) {
    if (this.accionesSuspendidas() || this.ocupado()) return;
    if (this.editando() === ref.id) {
      this.enfocarReferencia(ref.pagina, ref.id);
      return;
    }
    if (!(await this.confirmarAccion())) return;
    if (this.edicion()?.revision !== ref.revision || this.accionesSuspendidas())
      return;
    this.abrirFormularioReferencia(ref);
    await this.buscarMaterial();
  }

  private abrirFormularioReferencia(ref: ReferenciaPdf) {
    this.edicionFormulario.set(this.edicion());
    this.referenciaEditada.set(ref);
    this.opciones.set([]);
    this.seleccion.set({
      pagina: ref.pagina,
      rectangulos: ref.rectangulos,
      fragmento: ref.texto ?? '',
    });
    this.tipo.set(ref.tipo);
    this.texto.set(ref.texto ?? '');
    this.color.set(ref.color ?? COLOR_INICIAL);
    this.materialId.set(ref.preguntaId ?? ref.flashcardId ?? null);
    this.enfocarReferencia(ref.pagina, ref.id);
  }

  private enfocarReferencia(pagina: number, referencia: number | null) {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { pagina, referencia },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async guardar(estado: ReferenciaPdf['estado']) {
    const edicion = this.edicion();
    const seleccion = this.seleccion();
    if (
      !edicion ||
      !seleccion ||
      !this.puedeGuardar() ||
      this.ocupado() ||
      (estado === 'publicada' && this.tipo() === 'SUGERIDO') ||
      (estado === 'borrador' && this.publicada())
    )
      return false;
    const yaPublicada = this.publicada();
    this.ocupado.set(true);
    this.fallo.set('');
    try {
      const tipo = this.tipo();
      const sugerencia =
        tipo === 'SUGERIDO' ? this.referenciaEditada() : undefined;
      const ref = await this.pedir(
        this.api.guardarReferencia(edicion, {
          id: this.editando(),
          pagina: seleccion.pagina,
          tipo,
          estado,
          rectangulos: seleccion.rectangulos,
          texto: this.texto().trim() || undefined,
          color: this.color(),
          preguntaId:
            tipo === 'PREGUNTA' ? this.materialId()! : sugerencia?.preguntaId,
          flashcardId:
            tipo === 'TARJETA' ? this.materialId()! : sugerencia?.flashcardId,
        }),
      );
      if (this.edicion() !== edicion) return false;
      this.actualizar(ref);
      this.aviso.set(
        yaPublicada
          ? 'Referencia publicada actualizada.'
          : estado === 'publicada'
            ? 'Referencia publicada.'
            : 'Borrador guardado.',
      );
      this.limpiar();
      return true;
    } catch (error) {
      this.reportar(error, 'No se pudo guardar la referencia.');
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }

  async sugerir() {
    const edicion = this.edicion();
    const seleccion = this.seleccion();
    if (
      !edicion ||
      !seleccion?.fragmento ||
      this.accionesSuspendidas() ||
      !this.formularioVigente() ||
      this.editando()
    )
      return;
    const sustituyeCambios =
      this.tipo() !== TIPO_INICIAL ||
      this.color() !== COLOR_INICIAL ||
      this.texto().trim() !== seleccion.fragmento.trim();
    if (!(await this.confirmarAccion(sustituyeCambios))) return;
    if (this.edicion() !== edicion || this.accionesSuspendidas()) return;
    this.ocupado.set(true);
    this.fallo.set('');
    try {
      const ref = await this.pedir(
        this.api.sugerir(
          edicion,
          seleccion.pagina,
          seleccion.fragmento,
          seleccion.rectangulos,
        ),
      );
      if (this.edicion() !== edicion) return;
      this.actualizar(ref);
      this.abrirFormularioReferencia(ref);
      this.aviso.set('Coincidencia guardada como borrador.');
    } catch (error) {
      this.reportar(
        error,
        'No se encontró una coincidencia única en el banco.',
      );
    } finally {
      this.ocupado.set(false);
    }
  }

  async retirar(ref: ReferenciaPdf) {
    const edicion = this.edicion();
    if (!edicion || this.accionesSuspendidas()) return;
    if (
      !(await this.confirmarAccion(
        this.editando() === ref.id && this.hayCambios(),
      ))
    )
      return;
    if (this.edicion() !== edicion || this.accionesSuspendidas()) return;
    this.ocupado.set(true);
    this.fallo.set('');
    try {
      await this.pedir(this.api.quitarReferencia(edicion, ref.id));
      if (this.edicion() !== edicion) return;
      this.referencias.update((actuales) =>
        actuales.filter(({ id }) => id !== ref.id),
      );
      if (this.editando() === ref.id) this.limpiar();
      this.aviso.set('Referencia retirada.');
    } catch (error) {
      this.reportar(error, 'No se pudo retirar la referencia.');
    } finally {
      this.ocupado.set(false);
    }
  }

  private limpiar() {
    this.edicionFormulario.set(null);
    this.referenciaEditada.set(null);
    this.seleccion.set(null);
    this.tipo.set(TIPO_INICIAL);
    this.texto.set('');
    this.color.set(COLOR_INICIAL);
    this.materialId.set(null);
    this.opciones.set([]);
    this.buscar.set('');
  }

  nombre(tipo: TipoReferenciaPdf) {
    return TIPOS.find((entrada) => entrada.tipo === tipo)?.nombre ?? tipo;
  }

  private actualizar(ref: ReferenciaPdf) {
    this.referencias.update((actuales) =>
      [...actuales.filter(({ id }) => id !== ref.id), ref].sort(
        (a, b) => a.pagina - b.pagina || a.id - b.id,
      ),
    );
  }

  private pedir<T>(peticion: Observable<T>) {
    return firstValueFrom(
      peticion.pipe(timeout(15000), takeUntilDestroyed(this.destruir)),
    );
  }

  private reportar(error: unknown, alternativa: string) {
    if (
      error instanceof HttpErrorResponse &&
      error.status === 409 &&
      error.error?.code === 'LIBRILLO_PDF_REVISION_CAMBIADA'
    ) {
      this.suspenderRevision();
      return;
    }
    const mensaje =
      error instanceof HttpErrorResponse ? error.error?.message : null;
    this.fallo.set(typeof mensaje === 'string' ? mensaje : alternativa);
  }
}
