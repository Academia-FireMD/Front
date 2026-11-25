import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Observable, firstValueFrom, timeout } from 'rxjs';
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
  'Comprueba la publicación y la audiencia de este PDF para acceder a sus referencias.';

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
  imports: [FormsModule, RouterLink, ButtonModule, PreviaLibrillosPdfComponent],
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
  readonly parametrosLista = parametrosListaDocumentacion(
    this.ruta.snapshot.queryParamMap,
  );
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
  readonly tipo = signal<TipoReferenciaPdf>('SUGERIDO');
  readonly texto = signal('');
  readonly color = signal('#ffd646');
  readonly editando = signal<number | undefined>(undefined);
  readonly materialId = signal<number | null>(null);
  readonly buscar = signal('');
  readonly opciones = signal<Array<{ id: number; nombre: string }>>([]);
  readonly usaBanco = computed(
    () => this.tipo() === 'PREGUNTA' || this.tipo() === 'TARJETA',
  );
  readonly tipos = TIPOS;

  constructor() {
    void this.cargarDocumento();
  }

  async cargarDocumento() {
    this.cargando.set(true);
    this.fallo.set('');
    try {
      const id = Number(this.ruta.snapshot.paramMap.get('documentoId'));
      const { data } = await this.pedir(
        this.documentos.getDocumentosPublicos$({
          take: 1,
          skip: 0,
          searchTerm: '',
          where: { id },
        }),
      );
      const doc = data.find((resultado) => resultado.id === id);
      if (!doc?.temaId || !/\.pdf(?:$|[?#])/i.test(doc.fileName || doc.url)) {
        this.fallo.set(
          'Selecciona un PDF asignado a un tema desde Documentación.',
        );
        return;
      }
      this.documento.set({ ...doc, isDownloadable: true, isNew: false });
    } catch (error) {
      this.reportar(error, 'No se pudo abrir el documento.');
    } finally {
      this.cargando.set(false);
    }
  }

  async abrirEdicion(edicion: EdicionPdf) {
    const anterior = this.edicion();
    this.edicion.set(edicion);
    this.cargandoEdicion.set(true);
    this.edicionValidada.set(false);
    this.fallo.set('');
    if (anterior && anterior.revision !== edicion.revision) {
      this.referencias.set([]);
      this.limpiar();
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
        this.api.abrir(edicion),
      );
      if (this.edicion() !== edicion) return;
      if (revision !== edicion.revision) {
        this.suspenderRevision();
        return;
      }
      this.referenciasVistaPrevia.set(
        referencias.filter(
          (ref) => ref.estado === 'publicada' && ref.revision === revision,
        ),
      );
    } catch (error) {
      if (this.edicion() !== edicion) return;
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
      this.cargandoVistaPrevia.set(false);
    }
  }

  volverAEdicion() {
    this.vistaPrevia.set(false);
    this.falloVistaPrevia.set('');
    this.referenciasVistaPrevia.set([]);
  }

  async recargarRevision() {
    const visor = this.visor();
    if (!visor || this.cargandoEdicion()) return;
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

  seleccionar(fragmento: FragmentoPdf) {
    if (this.accionesSuspendidas()) return;
    this.limpiar();
    this.seleccion.set(fragmento);
    this.texto.set(fragmento.fragmento);
  }

  async seleccionarTipo(tipo: TipoReferenciaPdf) {
    if (this.accionesSuspendidas()) return;
    this.tipo.set(tipo);
    this.materialId.set(null);
    this.opciones.set([]);
    if (this.usaBanco()) await this.buscarMaterial();
  }

  async buscarMaterial() {
    const temaId = this.documento()?.temaId;
    const tipo = this.tipo();
    const consulta = this.buscar().trim();
    if (this.accionesSuspendidas() || !temaId || !this.usaBanco()) return;
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
      if (this.tipo() !== tipo || this.buscar().trim() !== consulta) return;
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
    this.abrirFormularioReferencia(ref);
    await this.buscarMaterial();
  }

  private abrirFormularioReferencia(ref: ReferenciaPdf) {
    this.seleccion.set({
      pagina: ref.pagina,
      rectangulos: ref.rectangulos,
      fragmento: ref.texto ?? '',
    });
    this.editando.set(ref.id);
    this.tipo.set(ref.tipo);
    this.texto.set(ref.texto ?? '');
    this.color.set(ref.color ?? '#ffd646');
    this.materialId.set(ref.preguntaId ?? ref.flashcardId ?? null);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { pagina: ref.pagina, referencia: ref.id },
      queryParamsHandling: 'merge',
    });
  }

  async guardar(estado: ReferenciaPdf['estado']) {
    const edicion = this.edicion();
    const seleccion = this.seleccion();
    if (
      !edicion ||
      !seleccion ||
      this.accionesSuspendidas() ||
      this.ocupado() ||
      (estado === 'publicada' && this.tipo() === 'SUGERIDO') ||
      (this.usaBanco() && !this.materialId())
    )
      return;
    this.ocupado.set(true);
    this.fallo.set('');
    try {
      const tipo = this.tipo();
      const sugerencia =
        tipo === 'SUGERIDO'
          ? this.referencias().find(
              (ref) => ref.id === this.editando() && ref.tipo === 'SUGERIDO',
            )
          : undefined;
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
      this.actualizar(ref);
      this.aviso.set(
        estado === 'publicada' ? 'Referencia publicada.' : 'Borrador guardado.',
      );
      this.limpiar();
    } catch (error) {
      this.reportar(error, 'No se pudo guardar la referencia.');
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
      this.ocupado()
    )
      return;
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
    if (!edicion || this.accionesSuspendidas() || this.ocupado()) return;
    this.ocupado.set(true);
    this.fallo.set('');
    try {
      await this.pedir(this.api.quitarReferencia(edicion, ref.id));
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

  limpiar() {
    this.seleccion.set(null);
    this.editando.set(undefined);
    this.tipo.set('SUGERIDO');
    this.texto.set('');
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
      this.edicion()
    ) {
      this.suspenderRevision();
      return;
    }
    const mensaje =
      error instanceof HttpErrorResponse ? error.error?.message : null;
    this.fallo.set(typeof mensaje === 'string' ? mensaje : alternativa);
  }
}
