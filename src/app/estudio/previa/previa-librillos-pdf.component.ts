import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFWorker,
  RenderTask,
  TextLayer,
} from 'pdfjs-dist';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom, timeout } from 'rxjs';
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';
import { DocumentosService } from '../../documentacion/services/documentacion.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoTemario } from '../../shared/models/documentacion.model';

type Rectangulo = { x: number; y: number; ancho: number; alto: number };

interface PaginaAnotada {
  nota: string;
  subrayados: Rectangulo[][];
}

interface Cuaderno {
  pagina: number;
  anotaciones: Record<number, PaginaAnotada>;
}

const PAGINA_VACIA: PaginaAnotada = { nota: '', subrayados: [] };

@Component({
  selector: 'app-previa-librillos-pdf',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './previa-librillos-pdf.component.html',
  styleUrl: './previa-librillos-pdf.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PreviaLibrillosPdfComponent implements AfterViewInit {
  readonly documento = input.required<DocumentoTemario>();
  private readonly documentos = inject(DocumentosService);
  private readonly auth = inject(AuthService);
  private readonly destruir = inject(DestroyRef);
  private readonly sesion = this.auth.sessionSnapshot();

  private readonly espacio =
    viewChild.required<ElementRef<HTMLDivElement>>('espacio');
  private readonly hoja =
    viewChild.required<ElementRef<HTMLDivElement>>('hoja');
  private readonly imagen =
    viewChild.required<ElementRef<HTMLCanvasElement>>('imagen');
  private readonly texto = viewChild<ElementRef<HTMLDivElement>>('texto');
  private libreria?: typeof import('pdfjs-dist');
  private worker?: Worker;
  private procesador?: PDFWorker;
  private carga?: PDFDocumentLoadingTask;
  private pdf?: PDFDocumentProxy;
  private pintura?: RenderTask;
  private capa?: TextLayer;
  private clave?: string;
  private renderId = 0;
  private anchoAnterior = 0;
  private cerrada = false;

  readonly cargando = signal(true);
  readonly fallo = signal('');
  readonly falloGuardado = signal(false);
  readonly total = signal(0);
  readonly lectura = signal(true);
  readonly seleccion = signal<Rectangulo[]>([]);
  readonly cuaderno = signal<Cuaderno>({ pagina: 1, anotaciones: {} });
  readonly pagina = computed(() => this.cuaderno().pagina);
  readonly anotacion = computed(
    () => this.cuaderno().anotaciones[this.pagina()] ?? PAGINA_VACIA,
  );
  readonly marcas = computed(() => this.anotacion().subrayados.flat());

  ngAfterViewInit() {
    const observarAncho = new ResizeObserver(() => {
      const ancho = this.espacio().nativeElement.clientWidth;
      if (ancho > 0 && ancho !== this.anchoAnterior) {
        this.anchoAnterior = ancho;
        void this.mostrarPagina();
      }
    });
    observarAncho.observe(this.espacio().nativeElement);

    this.destruir.onDestroy(() => {
      this.cerrada = true;
      observarAncho.disconnect();
      this.cerrar();
    });
    this.auth.currentIdentity$
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => {
        if (!this.sesionVigente()) {
          this.cerrar();
          this.fallo.set('Vuelve a abrir el Librillo desde tu cuenta.');
          this.cargando.set(false);
        }
      });

    void this.abrir();
  }

  private sesionVigente() {
    return !this.cerrada && this.auth.isSessionCurrent(this.sesion);
  }

  async abrir() {
    const usuario = usuarioIdDeSubject(this.sesion.sub);
    if (!usuario || !this.sesionVigente()) return;

    this.cerrar();
    this.fallo.set('');
    this.cargando.set(true);
    try {
      const documento = this.documento();
      const [blob, libreria] = await Promise.all([
        firstValueFrom(
          this.documentos
            .downloadWithWatermark$(documento.id)
            .pipe(timeout(30000), takeUntilDestroyed(this.destruir)),
        ),
        import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<
          typeof import('pdfjs-dist')
        >,
      ]);
      const datos = await blob.arrayBuffer();
      // La marca de agua puede cambiar los bytes entre dos descargas de la misma edición.
      const edicion =
        documento.requireWatermark && documento.updatedAt
          ? documento.updatedAt
          : Array.from(
              new Uint8Array(await crypto.subtle.digest('SHA-256', datos)),
              (n) => n.toString(16).padStart(2, '0'),
            ).join('');
      if (!this.sesionVigente()) return;
      this.clave = `previa-librillo:${usuario}:${documento.id}:${edicion}`;
      this.libreria = libreria;
      this.worker = new Worker(
        new URL('./previa-librillos-pdf.worker', import.meta.url),
        { type: 'module' },
      );
      this.procesador = libreria.PDFWorker.create({ port: this.worker });
      this.carga = libreria.getDocument({
        data: new Uint8Array(datos),
        worker: this.procesador,
        useWasm: false,
      });
      const pdf = await this.carga.promise;
      if (!this.sesionVigente()) return;
      this.pdf = pdf;
      this.total.set(pdf.numPages);
      this.recuperarCuaderno();
      await this.mostrarPagina();
    } catch {
      if (this.sesionVigente()) {
        this.cerrar();
        this.fallo.set('No se pudo abrir el PDF. Prueba a cargarlo de nuevo.');
      }
    } finally {
      if (this.sesionVigente()) this.cargando.set(false);
    }
  }

  private recuperarCuaderno() {
    try {
      const guardado = JSON.parse(
        localStorage.getItem(this.clave!) ?? 'null',
      ) as Cuaderno | null;
      if (
        guardado &&
        Number.isInteger(guardado.pagina) &&
        guardado.anotaciones
      ) {
        this.cuaderno.set({
          ...guardado,
          pagina: Math.min(Math.max(1, guardado.pagina), this.total()),
        });
      }
    } catch {
      this.falloGuardado.set(true);
    }
  }

  cambiarPagina(salto: number) {
    const destino = this.pagina() + salto;
    if (destino < 1 || destino > this.total()) return;
    this.cuaderno.update((datos) => ({ ...datos, pagina: destino }));
    this.espacio().nativeElement.scrollTop = 0;
    this.guardar();
    void this.mostrarPagina();
  }

  editarNota(nota: string) {
    this.actualizarPagina({ ...this.anotacion(), nota });
  }

  @HostListener('document:selectionchange')
  captarSeleccion() {
    const seleccion = document.getSelection();
    if (!seleccion || seleccion.isCollapsed || !seleccion.rangeCount) return;

    const capa = this.texto()?.nativeElement;
    if (!capa) return;
    const rango = seleccion.getRangeAt(0);
    if (!capa.contains(rango.commonAncestorContainer)) {
      this.seleccion.set([]);
      return;
    }
    const limites = this.hoja().nativeElement.getBoundingClientRect();
    if (limites.width === 0 || limites.height === 0) return;

    this.seleccion.set(
      Array.from(rango.getClientRects())
        .filter(({ width, height }) => width > 0 && height > 0)
        .map(({ left, top, width, height }) => ({
          x: (left - limites.left) / limites.width,
          y: (top - limites.top) / limites.height,
          ancho: width / limites.width,
          alto: height / limites.height,
        })),
    );
  }

  subrayar() {
    const rectangulos = this.seleccion();
    if (!rectangulos.length) return;
    this.actualizarPagina({
      ...this.anotacion(),
      subrayados: [...this.anotacion().subrayados, rectangulos],
    });
    document.getSelection()?.removeAllRanges();
    this.seleccion.set([]);
  }

  quitarUltimoSubrayado() {
    this.actualizarPagina({
      ...this.anotacion(),
      subrayados: this.anotacion().subrayados.slice(0, -1),
    });
  }

  private actualizarPagina(anotacion: PaginaAnotada) {
    this.cuaderno.update((estado) => ({
      ...estado,
      anotaciones: { ...estado.anotaciones, [estado.pagina]: anotacion },
    }));
    this.guardar();
  }

  private guardar() {
    if (!this.clave || !this.sesionVigente()) return;
    try {
      localStorage.setItem(this.clave, JSON.stringify(this.cuaderno()));
      this.falloGuardado.set(false);
    } catch {
      this.falloGuardado.set(true);
    }
  }

  private async mostrarPagina() {
    const pdf = this.pdf;
    const libreria = this.libreria;
    const ancho = this.espacio().nativeElement.clientWidth;
    if (!pdf || !libreria || ancho < 100 || !this.sesionVigente()) return;

    this.cancelarDibujo();
    this.seleccion.set([]);
    const id = this.renderId;

    try {
      const pagina = await pdf.getPage(this.pagina());
      if (id !== this.renderId || !this.sesionVigente()) return;
      const original = pagina.getViewport({ scale: 1 });
      const escala = Math.min((ancho - 24) / original.width, 1.75);
      const viewport = pagina.getViewport({ scale: escala });
      const hoja = this.hoja().nativeElement;
      hoja.style.width = `${viewport.width}px`;
      hoja.style.height = `${viewport.height}px`;
      hoja.style.setProperty('--scale-factor', String(escala));
      hoja.style.setProperty('--total-scale-factor', String(escala));

      const canvas = this.imagen().nativeElement;
      const densidad = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * densidad);
      canvas.height = Math.ceil(viewport.height * densidad);
      this.pintura = pagina.render({
        canvas,
        viewport,
        transform: [densidad, 0, 0, densidad, 0, 0],
      });
      const texto = this.texto()?.nativeElement;
      if (!texto) return;
      texto.replaceChildren();
      this.capa = new libreria.TextLayer({
        textContentSource: pagina.streamTextContent(),
        container: texto,
        viewport,
      });
      await Promise.all([this.pintura.promise, this.capa.render()]);
    } catch {
      if (id === this.renderId && this.sesionVigente()) {
        this.fallo.set('No se pudo mostrar esta página del PDF.');
      }
    }
  }

  private cancelarDibujo() {
    this.renderId++;
    this.pintura?.cancel();
    this.capa?.cancel();
    this.pintura = undefined;
    this.capa = undefined;
  }

  private cerrar() {
    this.cancelarDibujo();
    const carga = this.carga;
    const procesador = this.procesador;
    const worker = this.worker;
    this.carga = undefined;
    this.procesador = undefined;
    this.worker = undefined;
    this.pdf = undefined;
    this.total.set(0);

    if (carga) {
      void carga
        .destroy()
        .catch(() => {})
        .finally(() => {
          procesador?.destroy();
          worker?.terminate();
        });
    } else {
      procesador?.destroy();
      worker?.terminate();
    }
  }
}
