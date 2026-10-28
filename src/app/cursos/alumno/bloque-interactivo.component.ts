import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  input,
  OnChanges,
  OnDestroy,
  signal,
  SimpleChanges,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import { Subscription } from 'rxjs';
import { Bloque } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import {
  ControlHidraulicaInteractivo,
  HIDRAULICA_APLICACION_CODIGO,
  HidraulicaInteractivoService,
  HidraulicaSyncEstado,
} from '../services/hidraulica-interactivo.service';

/**
 * Bloque INTERACTIVO del aula (2026-10-28): aplicación autocontenida de
 * Hidráulica servida por el backend como HTML protegido.
 *
 * Seguridad: el HTML se pide con HttpClient (AuthInterceptor añade el bearer),
 * se convierte en Blob y se carga en un iframe. El token NUNCA entra en el
 * iframe ni en una URL. El puente solo acepta mensajes del frame y del mismo
 * origen; el estado viaja como JSON validado.
 *
 * Preview admin: placeholder sin fetch ni progreso real.
 */
@Component({
  selector: 'app-bloque-interactivo',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './bloque-interactivo.component.html',
  styleUrl: './bloque-interactivo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BloqueInteractivoComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  bloque = input.required<Bloque>();
  /** En preview admin no se descarga el HTML ni se toca el progreso. */
  preview = input<boolean>(false);

  private readonly cursoService = inject(CursosAlumnoService);
  private readonly puente = inject(HidraulicaInteractivoService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly estado = signal<HidraulicaSyncEstado>('loading');
  readonly texto = signal('Cargando aplicación…');
  readonly frameUrl = signal<SafeResourceUrl | null>(null);
  readonly altura = signal(680);
  readonly cargandoHtml = signal(false);
  readonly falloHtml = signal(false);
  readonly puedeReintentar = signal(false);

  private control: ControlHidraulicaInteractivo | null = null;
  private cargaSub: Subscription | null = null;
  private objectUrl: string | null = null;
  private cargaId = 0;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.cargar();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    if (changes['bloque'] || changes['preview']) {
      this.cargar();
    }
  }

  ngOnDestroy(): void {
    this.cargaId += 1;
    this.cargaSub?.unsubscribe();
    this.cargaSub = null;
    this.control?.destruir();
    this.control = null;
    this.revocarObjectUrl();
  }

  reintentar(): void {
    if (this.falloHtml() || !this.frameUrl()) {
      this.cargar();
      return;
    }
    this.control?.reintentar();
  }

  private cargar(): void {
    const id = ++this.cargaId;
    this.cargaSub?.unsubscribe();
    this.cargaSub = null;
    this.control?.destruir();
    this.control = null;
    this.revocarObjectUrl();
    this.frameUrl.set(null);
    this.falloHtml.set(false);
    this.puedeReintentar.set(false);
    this.estado.set('loading');
    this.texto.set('Cargando aplicación…');

    if (this.preview()) return;

    const bloque = this.bloque();
    const aplicacionCodigo = bloque.aplicacionCodigo;
    if (
      bloque.tipo !== 'INTERACTIVO' ||
      aplicacionCodigo !== HIDRAULICA_APLICACION_CODIGO
    ) {
      this.falloHtml.set(true);
      this.estado.set('error');
      this.texto.set('Aplicación interactiva no disponible.');
      return;
    }

    this.cargandoHtml.set(true);
    this.cargaSub = this.cursoService
      .descargarAplicacionInteractiva(bloque.id)
      .subscribe({
        next: (blob) => {
          if (id !== this.cargaId) return;
          const html = new Blob([blob], { type: 'text/html' });
          this.objectUrl = URL.createObjectURL(html);
          this.frameUrl.set(
            this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl),
          );
          this.cargandoHtml.set(false);
          this.cdr.detectChanges();
          if (id !== this.cargaId) return;
          const iframe = (
            this.host.nativeElement as HTMLElement
          ).querySelector<HTMLIFrameElement>(
            'iframe[data-testid="hidraulica-iframe"]',
          );
          if (!iframe) {
            this.falloHtml.set(true);
            this.estado.set('error');
            this.texto.set('No se pudo preparar la aplicación interactiva.');
            return;
          }
          this.control = this.puente.connect(
            iframe,
            {
              leccionId: bloque.leccionId,
              bloqueId: bloque.id,
              aplicacionCodigo: aplicacionCodigo!,
            },
            {
              publicarEstado: ({ estado, texto }) => {
                if (id !== this.cargaId) return;
                this.estado.set(estado);
                this.texto.set(texto);
                this.puedeReintentar.set(estado === 'error');
                this.cdr.markForCheck();
              },
              publicarAltura: (px) => {
                if (id !== this.cargaId) return;
                this.altura.set(px);
                this.cdr.markForCheck();
              },
            },
          );
        },
        error: () => {
          if (id !== this.cargaId) return;
          this.cargandoHtml.set(false);
          this.falloHtml.set(true);
          this.estado.set('error');
          this.texto.set(
            'No se pudo cargar la aplicación interactiva. Comprueba tu conexión e inténtalo de nuevo.',
          );
          this.puedeReintentar.set(true);
          this.cdr.markForCheck();
        },
      });
  }

  private revocarObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
