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

const COLORES = ['azul', 'rosa', 'violeta', 'turquesa', 'naranja'] as const;
type ColorSubrayado = (typeof COLORES)[number];
// Cada marca sigue siendo una lista de rectángulos. Los anteriores se muestran en amarillo.
type Trazo = Rectangulo & { color?: ColorSubrayado; fragmento?: string };

interface SeleccionPdf {
  rectangulos: Rectangulo[];
  fragmento: string;
  izquierda: number;
  arriba: boolean;
  superior: number;
  pagina: number;
}

interface PaginaAnotada {
  nota: string;
  subrayados: Trazo[][];
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
  private readonly visor = viewChild.required<ElementRef<HTMLElement>>('visor');
  private readonly paleta = viewChild<ElementRef<HTMLDivElement>>('paleta');
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
  readonly colores = COLORES;
  readonly seleccion = signal<SeleccionPdf | null>(null);
  readonly cuaderno = signal<Cuaderno>({ pagina: 1, anotaciones: {} });
  readonly pagina = computed(() => this.cuaderno().pagina);
  readonly anotacion = computed(
    () => this.cuaderno().anotaciones[this.pagina()] ?? PAGINA_VACIA,
  );
  readonly marcas = computed(() => this.anotacion().subrayados.flat());
  readonly subrayados = computed(() =>
    Object.entries(this.cuaderno().anotaciones).flatMap(
      ([pagina, { subrayados }]) =>
        subrayados.map((trazos, indice) => ({
          pagina: Number(pagina),
          indice,
          trazos,
          color: trazos[0]?.color ?? 'amarillo',
          fragmento: trazos[0]?.fragmento ?? 'Subrayado ' + (indice + 1),
        })),
    ),
  );

  ngAfterViewInit() {
    let esperarAncho: ReturnType<typeof setTimeout> | undefined;
    const observarAncho = new ResizeObserver(() => {
      const ancho = this.espacio().nativeElement.clientWidth;
      if (ancho === this.anchoAnterior) return;
      this.anchoAnterior = ancho;
      clearTimeout(esperarAncho);
      if (ancho > 0)
        esperarAncho = setTimeout(() => void this.mostrarPagina(), 120);
    });
    observarAncho.observe(this.espacio().nativeElement);

    this.destruir.onDestroy(() => {
      this.cerrada = true;
      observarAncho.disconnect();
      clearTimeout(esperarAncho);
      this.cerrar();
    });
    this.auth.currentIdentity$
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => {
        if (!this.sesionVigente()) {
          this.cerrar();
          this.cuaderno.set({ pagina: 1, anotaciones: {} });
          this.clave = undefined;
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
    this.irAPagina(this.pagina() + salto);
  }

  irAPagina(destino: number) {
    if (destino < 1 || destino > this.total()) return;
    this.lectura.set(true);
    if (destino === this.pagina()) return;
    this.cerrarPaleta();
    this.cuaderno.update((datos) => ({ ...datos, pagina: destino }));
    this.espacio().nativeElement.scrollTop = 0;
    this.guardar();
    void this.mostrarPagina();
  }

  editarNota(nota: string) {
    this.actualizarPagina(this.pagina(), { ...this.anotacion(), nota });
  }

  mostrarAnotaciones() {
    this.cerrarPaleta();
    this.lectura.set(false);
  }

  @HostListener('document:selectionchange')
  captarSeleccion() {
    const seleccion = document.getSelection();
    const capa = this.texto()?.nativeElement;
    if (!capa || !this.capa || this.cargando() || this.fallo()) return;
    if (!seleccion || seleccion.isCollapsed || !seleccion.rangeCount) {
      if (!this.paleta()?.nativeElement.contains(document.activeElement)) {
        this.seleccion.set(null);
      }
      return;
    }
    const rango = seleccion.getRangeAt(0);
    const fragmento = seleccion
      .toString()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    if (!capa.contains(rango.commonAncestorContainer) || !fragmento) {
      this.seleccion.set(null);
      return;
    }
    const limites = this.hoja().nativeElement.getBoundingClientRect();
    if (limites.width === 0 || limites.height === 0) return;

    const rectangulos = Array.from(rango.getClientRects()).filter(
      ({ width, height }) => width > 0 && height > 0,
    );
    const ventana = this.espacio().nativeElement.getBoundingClientRect();
    const ancla = rectangulos.find(
      ({ top, bottom }) => bottom > ventana.top && top < ventana.bottom,
    );
    if (!ancla) {
      this.seleccion.set(null);
      return;
    }

    const visor = this.visor().nativeElement.getBoundingClientRect();
    const margen = Math.min(164, visor.width / 2);
    const arriba = ancla.top - visor.top >= 64;
    this.seleccion.set({
      rectangulos: rectangulos.map(({ left, top, width, height }) => ({
        x: (left - limites.left) / limites.width,
        y: (top - limites.top) / limites.height,
        ancho: width / limites.width,
        alto: height / limites.height,
      })),
      fragmento,
      izquierda: Math.max(
        margen,
        Math.min(
          ancla.left + ancla.width / 2 - visor.left,
          visor.width - margen,
        ),
      ),
      arriba,
      superior: arriba
        ? ancla.top - visor.top - 8
        : Math.min(ancla.bottom - visor.top + 8, visor.height - 60),
      pagina: this.pagina(),
    });
  }

  subrayar(color: ColorSubrayado) {
    const seleccion = this.seleccion();
    if (
      !seleccion ||
      seleccion.pagina !== this.pagina() ||
      !this.sesionVigente()
    )
      return;
    const trazos = seleccion.rectangulos.map((rectangulo, indice) => ({
      ...rectangulo,
      color,
      ...(indice === 0 ? { fragmento: seleccion.fragmento } : {}),
    }));
    this.actualizarPagina(seleccion.pagina, {
      ...this.anotacion(),
      subrayados: [...this.anotacion().subrayados, trazos],
    });
    this.cerrarPaleta();
  }

  @HostListener('document:keydown.escape')
  cerrarPaleta() {
    if (!this.seleccion()) return;
    if (
      !this.cerrada &&
      this.paleta()?.nativeElement.contains(document.activeElement)
    ) {
      this.visor().nativeElement.focus({ preventScroll: true });
    }
    this.seleccion.set(null);
    document.getSelection()?.removeAllRanges();
  }

  quitarSubrayado(pagina: number, indice: number) {
    const anotacion = this.cuaderno().anotaciones[pagina];
    if (!anotacion) return;
    this.actualizarPagina(pagina, {
      ...anotacion,
      subrayados: anotacion.subrayados.filter(
        (_, posicion) => posicion !== indice,
      ),
    });
  }

  private actualizarPagina(pagina: number, anotacion: PaginaAnotada) {
    if (!this.sesionVigente()) return;
    this.cuaderno.update((estado) => ({
      ...estado,
      anotaciones: { ...estado.anotaciones, [pagina]: anotacion },
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
    this.cerrarPaleta();
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
    this.cerrarPaleta();
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
