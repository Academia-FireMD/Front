import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFWorker,
  RenderTask,
  TextLayer,
} from 'pdfjs-dist';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { firstValueFrom, timeout } from 'rxjs';
import { usuarioIdDeSubject } from '../../cursos/services/hidraulica-interactivo.service';
import { DocumentosService } from '../../documentacion/services/documentacion.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { DocumentoTemario } from '../../shared/models/documentacion.model';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { TestModule } from '../../test/test.module';
import { LibrilloContextoPdfService } from './librillo-contexto-pdf.service';
import { LibrilloCuadernoService } from './librillo-cuaderno.service';
import {
  EdicionPdf,
  PAGINA_PDF_VACIA,
  PaginaPdf,
  PuntoPdf,
  RectanguloPdf,
  ReferenciaPdf,
  TrazoPdf,
} from './librillo-pdf-api.service';
import {
  coordenadasPdf,
  transformarRectangulo,
} from './librillo-pdf-coordenadas';

const COLORES = ['azul', 'rosa', 'violeta', 'turquesa', 'naranja'] as const;
type ColorSubrayado = (typeof COLORES)[number];
const TINTAS = {
  azul: '#448cfb',
  rosa: '#ed619f',
  violeta: '#a77af0',
  turquesa: '#1bc4b8',
  naranja: '#f99832',
  amarillo: '#ffd646',
};
type MarcaAnterior = RectanguloPdf & {
  color?: ColorSubrayado;
  fragmento?: string;
};
type CapaPdf = 'SUGERIDO' | 'HUECO' | 'DATO' | 'TRAMPA';
const capasDisponibles: Array<{ tipo: CapaPdf; etiqueta: string }> = [
  { tipo: 'SUGERIDO', etiqueta: 'Sugeridos' },
  { tipo: 'HUECO', etiqueta: 'Huecos' },
  { tipo: 'DATO', etiqueta: 'Datos' },
  { tipo: 'TRAMPA', etiqueta: 'Trampas' },
];

export interface FragmentoPdf {
  rectangulos: RectanguloPdf[];
  fragmento: string;
  pagina: number;
}

interface SeleccionPdf extends FragmentoPdf {
  izquierda: number;
  arriba: boolean;
  superior: number;
}

interface CuadernoAnterior {
  pagina: number;
  anotaciones: Record<number, { nota: string; subrayados: MarcaAnterior[][] }>;
}

@Component({
  selector: 'app-previa-librillos-pdf',
  standalone: true,
  imports: [ButtonModule, DialogModule, TooltipModule, TestModule],
  providers: [LibrilloCuadernoService],
  templateUrl: './previa-librillos-pdf.component.html',
  styleUrl: './previa-librillos-pdf.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class PreviaLibrillosPdfComponent implements AfterViewInit {
  readonly documento = input.required<DocumentoTemario>();
  readonly editor = input(false);
  readonly referenciasEditor = input<ReferenciaPdf[]>([]);
  readonly edicionCargada = output<EdicionPdf>();
  readonly fragmentoEditorial = output<FragmentoPdf>();
  readonly materialPersonal = signal<{
    temaId: number;
    tipo: 'test' | 'flashcards';
    texto: string;
  } | null>(null);
  private readonly documentos = inject(DocumentosService);
  private readonly config = inject(AppConfigService);
  private readonly auth = inject(AuthService);
  private readonly contexto = inject(LibrilloContextoPdfService, {
    optional: true,
  });
  private readonly ruta = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destruir = inject(DestroyRef);
  private readonly sesion = this.auth.sessionSnapshot();
  readonly perfil = inject(LibrilloCuadernoService);
  private readonly params =
    this.ruta &&
    toSignal(this.ruta.queryParamMap, {
      initialValue: this.ruta.snapshot.queryParamMap,
    });

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
  private claveBorradores?: string;
  private cargaId = 0;
  private arrastre?: {
    id: number;
    inicio: PuntoPdf;
    aparte: boolean;
    puntos: PuntoPdf[];
  };
  private readonly geometria = signal<ReturnType<typeof coordenadasPdf> | null>(
    null,
  );
  private readonly local = signal<Record<number, PaginaPdf>>({});

  readonly edicion = signal<EdicionPdf | null>(null);
  readonly avance = computed(
    () =>
      this.editor() ||
      this.config.isModuloHabilitado(ModuloApp.LIBRILLO_PDF_INTERACTIVO),
  );
  readonly testActivo = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.TEST),
  );
  readonly tarjetasActivas = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.FLASHCARDS),
  );
  readonly vistaAnotaciones = computed(() =>
    this.avance() &&
    this.contexto &&
    (this.testActivo() || this.tarjetasActivas())
      ? this.contexto.pestana() === 'anotaciones'
      : !this.lectura(),
  );
  readonly herramienta = signal<'leer' | 'escribir' | 'area'>('leer');
  readonly modoNota = signal<'teclado' | 'hoja' | 'aparte'>('teclado');
  readonly rotacion = signal(0);
  readonly zoom = signal(1);
  readonly tinta = signal('#1e2632');
  readonly borradorTrazo = signal<{
    aparte: boolean;
    puntos: PuntoPdf[];
  } | null>(null);
  readonly area = signal<RectanguloPdf | null>(null);
  readonly capas = signal<CapaPdf[]>(['SUGERIDO']);
  readonly capasDisponibles = capasDisponibles;
  readonly datosRevelados = signal<number[]>([]);
  readonly legado = signal<{
    lote: string;
    partes: Array<{ pagina: number; valor: PaginaPdf }>;
  } | null>(null);
  readonly previoLegado = signal(false);
  readonly confirmarBorrado = signal(false);
  readonly cargando = signal(true);
  readonly fallo = signal('');
  readonly falloGuardado = signal(false);
  readonly total = signal(0);
  readonly lectura = signal(true);
  readonly colores = COLORES;
  readonly seleccion = signal<SeleccionPdf | null>(null);
  readonly pagina = signal(1);
  readonly anotaciones = computed(() =>
    this.edicion() && !this.editor() ? this.perfil.paginas() : this.local(),
  );
  readonly anotacion = computed(
    () => this.anotaciones()[this.pagina()] ?? PAGINA_PDF_VACIA,
  );
  readonly marcas = computed(() =>
    this.anotacion().subrayados.flatMap(({ color, rectangulos }) =>
      rectangulos.map((rectangulo) => ({
        ...this.rectanguloVisible(rectangulo),
        color,
      })),
    ),
  );
  readonly subrayados = computed(() =>
    Object.entries(this.anotaciones()).flatMap(([pagina, { subrayados }]) =>
      subrayados.map((marca, indice) => ({
        pagina: Number(pagina),
        ...marca,
        fragmento: marca.fragmento ?? 'Subrayado ' + (indice + 1),
      })),
    ),
  );
  readonly referenciaActiva = computed(
    () => Number(this.params?.()?.get('referencia')) || null,
  );
  readonly referencias = computed(() =>
    this.editor() ? this.referenciasEditor() : this.perfil.referencias(),
  );
  readonly capasPagina = computed(() =>
    this.referencias()
      .filter(
        (ref) =>
          ref.pagina === this.pagina() &&
          (ref.id === this.referenciaActiva() ||
            this.editor() ||
            this.capas().includes(ref.tipo as CapaPdf)),
      )
      .flatMap((ref) =>
        ref.rectangulos.map((rectangulo) => ({
          ...ref,
          rectangulo: this.rectanguloVisible(rectangulo),
        })),
      ),
  );

  constructor() {
    effect(
      () => {
        const numero = Number(this.params?.()?.get('pagina'));
        const referencia = this.referenciaActiva();
        const total = this.total();
        if (Number.isInteger(numero) && numero > 0 && numero <= total) {
          untracked(() => {
            this.irAPagina(numero, false);
            if (referencia) this.enfocarReferencia();
          });
        }
      },
      { allowSignalWrites: true },
    );
  }

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
          this.local.set({});
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
    const cargaId = this.cargaId;
    this.fallo.set('');
    this.cargando.set(true);
    try {
      const documento = this.documento();
      const [{ archivo, revision }, libreria] = await Promise.all([
        firstValueFrom(
          this.documentos
            .descargarConRevision$(documento.id)
            .pipe(timeout(30000), takeUntilDestroyed(this.destruir)),
        ),
        import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<
          typeof import('pdfjs-dist')
        >,
      ]);
      const datos = await archivo.arrayBuffer();
      // La marca de agua puede cambiar los bytes entre dos descargas de la misma edición.
      const edicion =
        documento.requireWatermark && documento.updatedAt
          ? documento.updatedAt
          : Array.from(
              new Uint8Array(await crypto.subtle.digest('SHA-256', datos)),
              (n) => n.toString(16).padStart(2, '0'),
            ).join('');
      if (!this.sesionVigente() || cargaId !== this.cargaId) return;
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
      if (!this.sesionVigente() || cargaId !== this.cargaId) return;
      this.pdf = pdf;
      this.total.set(pdf.numPages);
      const previo = this.recuperarCuaderno(this.clave);
      const paginaGuardada = this.avance()
        ? Number(localStorage.getItem(this.clave + ':pagina')) || previo?.pagina
        : previo?.pagina;
      const paginaUrl = Number(this.params?.()?.get('pagina'));
      this.pagina.set(
        Math.min(pdf.numPages, Math.max(1, paginaUrl || paginaGuardada || 1)),
      );
      if (this.avance() && revision && /^[a-f0-9]{64}$/.test(revision)) {
        const actual = { doc: documento.id, revision };
        this.edicion.set(actual);
        this.edicionCargada.emit(actual);
        if (!this.editor()) {
          this.claveBorradores = `librillo-pdf:${usuario}:${documento.id}:${revision}:borradores`;
          void this.cargarPerfil(actual, previo, edicion === revision);
        }
      } else {
        this.local.set(this.convertirCuaderno(previo));
      }
      await this.mostrarPagina();
    } catch {
      if (this.sesionVigente() && cargaId === this.cargaId) {
        this.cerrar();
        this.fallo.set('No se pudo abrir el PDF. Prueba a cargarlo de nuevo.');
      }
    } finally {
      if (this.sesionVigente() && cargaId === this.cargaId)
        this.cargando.set(false);
    }
  }

  private recuperarCuaderno(clave: string): CuadernoAnterior | null {
    try {
      const guardado = JSON.parse(
        localStorage.getItem(clave) ?? 'null',
      ) as CuadernoAnterior | null;
      if (
        guardado &&
        Number.isInteger(guardado.pagina) &&
        guardado.anotaciones
      ) {
        return guardado;
      }
    } catch {
      this.falloGuardado.set(true);
    }
    return null;
  }

  private convertirCuaderno(guardado: CuadernoAnterior | null) {
    return Object.fromEntries(
      Object.entries(guardado?.anotaciones ?? {})
        .filter(
          ([pagina, valor]) =>
            Number(pagina) >= 1 &&
            Number(pagina) <= this.total() &&
            typeof valor.nota === 'string' &&
            Array.isArray(valor.subrayados),
        )
        .map(([pagina, valor]) => [
          Number(pagina),
          {
            ...PAGINA_PDF_VACIA,
            nota: valor.nota,
            subrayados: valor.subrayados
              .filter((rectangulos) => rectangulos.length)
              .map((rectangulos, indice) => ({
                id: `anterior-${pagina}-${indice}`,
                fragmento: rectangulos[0]?.fragmento,
                color: TINTAS[rectangulos[0]?.color ?? 'amarillo'],
                rectangulos: rectangulos.map(({ x, y, ancho, alto }) => ({
                  x,
                  y,
                  ancho,
                  alto,
                })),
              })),
          } satisfies PaginaPdf,
        ]),
    );
  }

  private async cargarPerfil(
    edicion: EdicionPdf,
    previo: CuadernoAnterior | null,
    coincide: boolean,
  ) {
    const abierto = await this.perfil.abrir(edicion, this.claveBorradores!);
    if (!this.sesionVigente() || this.edicion() !== edicion) return;
    if (abierto) this.publicarContexto();
    if (!previo || !this.pdf || !this.clave) return;
    try {
      const partes = [];
      for (const [pagina, valor] of Object.entries(
        this.convertirCuaderno(previo),
      )) {
        if (!valor.nota && !valor.subrayados.length) continue;
        const hoja = await this.pdf.getPage(Number(pagina));
        const trasladar = coordenadasPdf(
          hoja.getViewport({ scale: 1 }),
          hoja.view,
        ).alPdf;
        partes.push({
          pagina: Number(pagina),
          valor: {
            ...valor,
            subrayados: valor.subrayados
              .map((marca) => ({
                ...marca,
                rectangulos: marca.rectangulos
                  .map((rectangulo) =>
                    transformarRectangulo(rectangulo, trasladar),
                  )
                  .filter(({ ancho, alto }) => ancho > 0 && alto > 0),
              }))
              .filter((marca) => marca.rectangulos.length),
          },
        });
      }
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(this.clave),
      );
      const lote = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (!partes.length || !this.sesionVigente() || this.edicion() !== edicion)
        return;
      if (localStorage.getItem(this.clave + ':importado:' + edicion.revision))
        return;
      this.legado.set({ lote, partes });
      if (abierto && coincide) await this.importarLegado();
    } catch {
      this.falloGuardado.set(true);
    }
  }

  async importarLegado() {
    const anterior = this.legado();
    if (
      anterior &&
      (await this.perfil.importar(anterior.lote, anterior.partes))
    ) {
      localStorage.setItem(
        this.clave + ':importado:' + this.edicion()?.revision,
        'sí',
      );
      this.legado.set(null);
      this.previoLegado.set(false);
    }
  }

  cambiarPagina(salto: number) {
    this.irAPagina(this.pagina() + salto);
  }

  irAPagina(destino: number, actualizarUrl = true) {
    if (destino < 1 || destino > this.total()) return;
    this.lectura.set(true);
    this.contexto?.pestana.set('lectura');
    if (destino === this.pagina()) return;
    this.cerrarPaleta();
    this.pagina.set(destino);
    this.publicarContexto();
    this.datosRevelados.set([]);
    if (actualizarUrl && this.edicion() && this.router && this.ruta) {
      void this.router.navigate([], {
        relativeTo: this.ruta,
        queryParams: { pagina: destino, referencia: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    this.espacio().nativeElement.scrollTop = 0;
    this.guardar();
    void this.mostrarPagina();
  }

  editarNota(nota: string) {
    this.actualizarPagina(this.pagina(), { ...this.anotacion(), nota });
  }

  activarHerramienta(herramienta: 'leer' | 'escribir' | 'area') {
    this.cerrarPaleta();
    this.cancelarTrazo();
    this.herramienta.update((actual) =>
      actual === herramienta ? 'leer' : herramienta,
    );
  }

  elegirModoNota(modo: 'teclado' | 'hoja' | 'aparte') {
    this.modoNota.set(modo);
    this.cancelarTrazo();
    if (modo === 'hoja') {
      this.herramienta.set('escribir');
      this.contexto?.pestana.set('lectura');
      this.lectura.set(true);
    } else {
      this.herramienta.set('leer');
    }
  }

  iniciarTrazo(evento: PointerEvent, aparte = false) {
    if (
      !this.edicion() ||
      this.cargando() ||
      this.fallo() ||
      (!aparte && this.herramienta() === 'leer') ||
      evento.button !== 0 ||
      this.arrastre
    )
      return;
    const superficie = evento.currentTarget as SVGElement;
    superficie.setPointerCapture(evento.pointerId);
    const inicio = this.puntoEnSuperficie(evento, superficie);
    this.arrastre = { id: evento.pointerId, inicio, aparte, puntos: [inicio] };
    this.borradorTrazo.set({ aparte, puntos: [inicio] });
    evento.preventDefault();
  }

  continuarTrazo(evento: PointerEvent) {
    const arrastre = this.arrastre;
    if (!arrastre || arrastre.id !== evento.pointerId) return;
    const punto = this.puntoEnSuperficie(
      evento,
      evento.currentTarget as SVGElement,
    );
    if (!arrastre.aparte && this.herramienta() === 'area') {
      this.area.set(this.areaDesde(arrastre.inicio, punto));
    } else if (arrastre.puntos.length < 3500) {
      const ultimo = arrastre.puntos.at(-1)!;
      if (Math.hypot(punto.x - ultimo.x, punto.y - ultimo.y) < 0.0015) return;
      arrastre.puntos.push(punto);
      this.borradorTrazo.set({
        aparte: arrastre.aparte,
        puntos: [...arrastre.puntos],
      });
    }
  }

  terminarTrazo(evento: PointerEvent) {
    const arrastre = this.arrastre;
    if (!arrastre || arrastre.id !== evento.pointerId) return;
    const punto = this.puntoEnSuperficie(
      evento,
      evento.currentTarget as SVGElement,
    );
    this.cancelarTrazo();
    if (!arrastre.aparte && this.herramienta() === 'area') {
      const visible = this.areaDesde(arrastre.inicio, punto);
      if (visible.ancho < 0.003 || visible.alto < 0.003) return;
      const fragmento = {
        pagina: this.pagina(),
        fragmento: '',
        rectangulos: [this.rectanguloCanonico(visible)],
      };
      this.herramienta.set('leer');
      if (this.editor()) {
        this.fragmentoEditorial.emit(fragmento);
      } else {
        const ancho = this.visor().nativeElement.clientWidth;
        this.seleccion.set({
          ...fragmento,
          izquierda: ancho / 2,
          superior: 94,
          arriba: false,
        });
      }
      return;
    }
    const alPdf = this.geometria()?.alPdf;
    const trazo: TrazoPdf = {
      id: crypto.randomUUID(),
      color: this.tinta(),
      grosor: 2,
      puntos: [...arrastre.puntos, punto].map((p) =>
        arrastre.aparte || !alPdf ? p : alPdf(p),
      ),
    };
    const campo = arrastre.aparte ? 'aparte' : 'trazos';
    this.actualizarPagina(this.pagina(), {
      ...this.anotacion(),
      [campo]: [...this.anotacion()[campo], trazo],
    });
  }

  cancelarTrazo() {
    this.arrastre = undefined;
    this.area.set(null);
    this.borradorTrazo.set(null);
  }

  deshacerTrazo(aparte: boolean) {
    const campo = aparte ? 'aparte' : 'trazos';
    this.actualizarPagina(this.pagina(), {
      ...this.anotacion(),
      [campo]: this.anotacion()[campo].slice(0, -1),
    });
  }

  puntosParaDibujar(puntos: PuntoPdf[], canonicos = false) {
    const geometria = canonicos ? this.geometria() : null;
    return puntos
      .map((punto) => {
        const { x, y } = geometria ? geometria.aPantalla(punto) : punto;
        return `${x * 1000},${y * 1000}`;
      })
      .join(' ');
  }

  private puntoEnSuperficie(evento: PointerEvent, superficie: SVGElement) {
    const { left, top, width, height } = superficie.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (evento.clientX - left) / width)),
      y: Math.max(0, Math.min(1, (evento.clientY - top) / height)),
    };
  }

  private areaDesde(inicio: PuntoPdf, fin: PuntoPdf): RectanguloPdf {
    return {
      x: Math.min(inicio.x, fin.x),
      y: Math.min(inicio.y, fin.y),
      ancho: Math.abs(fin.x - inicio.x),
      alto: Math.abs(fin.y - inicio.y),
    };
  }

  usarSeleccion(tipo: 'editor' | 'test' | 'flashcards') {
    const { pagina, rectangulos, fragmento } = this.seleccion() ?? {};
    if (!pagina || !rectangulos?.length) return;
    if (tipo === 'editor') {
      this.fragmentoEditorial.emit({
        pagina,
        rectangulos,
        fragmento: fragmento ?? '',
      });
    } else if (fragmento && this.documento().temaId) {
      this.materialPersonal.set({
        tipo,
        temaId: this.documento().temaId!,
        texto: fragmento,
      });
    }
    this.cerrarPaleta();
  }

  materialCreado() {
    this.materialPersonal.set(null);
    this.publicarContexto();
  }

  cambiarZoom(delta: number) {
    this.zoom.update((zoom) => Math.max(0.8, Math.min(2, zoom + delta)));
    void this.mostrarPagina();
  }

  girarPagina() {
    this.rotacion.update((rotacion) => (rotacion + 90) % 360);
    void this.mostrarPagina();
  }

  cambiarCapa(capa: CapaPdf) {
    this.capas.update((capas) =>
      capas.includes(capa)
        ? capas.filter((existente) => existente !== capa)
        : [...capas, capa],
    );
  }

  hayCapa(capa: CapaPdf) {
    return this.referencias().some(({ tipo }) => tipo === capa);
  }

  colorEtiqueta(color: string) {
    return COLORES.find((nombre) => TINTAS[nombre] === color) ?? 'amarillo';
  }

  async reiniciarCuaderno() {
    this.confirmarBorrado.set(false);
    await this.perfil.reiniciar();
  }

  revelarDato(id: number) {
    this.datosRevelados.update((ids) =>
      ids.includes(id)
        ? ids.filter((existente) => existente !== id)
        : [...ids, id],
    );
  }

  private rectanguloCanonico(rectangulo: RectanguloPdf) {
    const geometria = this.geometria();
    return this.edicion() && geometria
      ? transformarRectangulo(rectangulo, geometria.alPdf)
      : rectangulo;
  }

  private rectanguloVisible(rectangulo: RectanguloPdf) {
    const geometria = this.geometria();
    return this.edicion() && geometria
      ? transformarRectangulo(rectangulo, geometria.aPantalla)
      : rectangulo;
  }

  private enfocarReferencia() {
    const referencia = this.capasPagina().find(
      (ref) => ref.id === this.referenciaActiva(),
    );
    if (!referencia || !this.pdf || this.cerrada) return;
    const superior =
      this.hoja().nativeElement.clientHeight * referencia.rectangulo.y;
    this.espacio().nativeElement.scrollTop = Math.max(0, superior - 80);
  }

  mostrarAnotaciones() {
    this.cerrarPaleta();
    this.lectura.set(false);
    this.contexto?.pestana.set('anotaciones');
  }

  private publicarContexto() {
    const edicion = this.edicion();
    if (edicion)
      this.contexto?.contexto.set({ ...edicion, pagina: this.pagina() });
  }

  async guardarAntesDeSalir() {
    await this.perfil.guardarAhora();
    return true;
  }

  @HostListener('window:online')
  async reintentarPerfil() {
    await this.perfil.reintentar();
    if (this.perfil.estado() === 'guardado') this.publicarContexto();
  }

  @HostListener('document:selectionchange')
  captarSeleccion() {
    const seleccion = document.getSelection();
    const capa = this.texto()?.nativeElement;
    if (
      !capa ||
      !this.capa ||
      this.cargando() ||
      this.fallo() ||
      this.herramienta() !== 'leer'
    )
      return;
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
      rectangulos: rectangulos
        .slice(0, 64)
        .map(({ left, top, width, height }) =>
          this.rectanguloCanonico({
            x: (left - limites.left) / limites.width,
            y: (top - limites.top) / limites.height,
            ancho: width / limites.width,
            alto: height / limites.height,
          }),
        )
        .filter(({ ancho, alto }) => ancho > 0 && alto > 0),
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
    if (!seleccion.rectangulos.length) return;
    this.actualizarPagina(seleccion.pagina, {
      ...this.anotacion(),
      subrayados: [
        ...this.anotacion().subrayados,
        {
          id: crypto.randomUUID(),
          color: TINTAS[color],
          fragmento: seleccion.fragmento || undefined,
          rectangulos: seleccion.rectangulos,
        },
      ],
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

  quitarSubrayado(pagina: number, id: string) {
    const anotacion = this.anotaciones()[pagina];
    if (!anotacion) return;
    this.actualizarPagina(pagina, {
      ...anotacion,
      subrayados: anotacion.subrayados.filter((marca) => marca.id !== id),
    });
  }

  private actualizarPagina(pagina: number, anotacion: PaginaPdf) {
    if (!this.sesionVigente()) return;
    if (this.edicion()) this.perfil.editar(pagina, anotacion);
    else
      this.local.update((actuales) => ({ ...actuales, [pagina]: anotacion }));
    this.guardar();
  }

  private guardar() {
    if (!this.clave || !this.sesionVigente()) return;
    try {
      if (this.edicion()) {
        localStorage.setItem(this.clave + ':pagina', String(this.pagina()));
      } else {
        const anotaciones = Object.fromEntries(
          Object.entries(this.anotaciones()).map(([pagina, valor]) => [
            pagina,
            {
              nota: valor.nota,
              subrayados: valor.subrayados.map((marca) =>
                marca.rectangulos.map((rectangulo, indice) => ({
                  ...rectangulo,
                  color: COLORES.find(
                    (nombre) => TINTAS[nombre] === marca.color,
                  ),
                  ...(indice === 0 ? { fragmento: marca.fragmento } : {}),
                })),
              ),
            },
          ]),
        );
        localStorage.setItem(
          this.clave,
          JSON.stringify({ pagina: this.pagina(), anotaciones }),
        );
      }
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
      const rotation = (pagina.rotate + this.rotacion()) % 360;
      const original = pagina.getViewport({ scale: 1, rotation });
      const escala =
        Math.min((ancho - 24) / original.width, 1.75) * this.zoom();
      const viewport = pagina.getViewport({ scale: escala, rotation });
      this.geometria.set(coordenadasPdf(viewport, pagina.view));
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
      if (id === this.renderId) this.enfocarReferencia();
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
    this.cargaId++;
    this.perfil.cerrar();
    this.edicion.set(null);
    this.legado.set(null);
    if (this.contexto?.contexto()?.doc === this.documento().id)
      this.contexto.contexto.set(null);
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
