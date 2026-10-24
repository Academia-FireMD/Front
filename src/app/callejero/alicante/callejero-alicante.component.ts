import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  CallejeroProgresoAdapterService,
  ControlProgresoEmbed,
} from '../services/callejero-progreso-adapter.service';
import { ProgresoSyncMensaje } from '../services/callejero-progreso.service';

/**
 * Wrapper aislado para la beta de Alicante. El bridge solo sincroniza progreso;
 * no envía credenciales ni crea un panel de perfil.
 */
@Component({
  selector: 'app-callejero-alicante',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-alicante.component.html',
  styleUrl: '../embed/callejero-embed.component.scss',
})
export class CallejeroAlicanteComponent implements AfterViewInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly progreso = inject(CallejeroProgresoAdapterService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private controlProgreso: ControlProgresoEmbed | null = null;

  @ViewChild('callejeroFrame', { static: true })
  iframeRef!: ElementRef<HTMLIFrameElement>;

  readonly src: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    '/callejero-embed/alicante_16.html?v=17&progreso=1',
  );

  estadoProgreso: ProgresoSyncMensaje = {
    estado: 'cargando',
    texto: 'Cargando progreso de tu cuenta…',
  };

  get puedeReintentar(): boolean {
    return (
      this.estadoProgreso.estado === 'error' ||
      this.estadoProgreso.estado === 'pendiente'
    );
  }

  ngAfterViewInit(): void {
    this.controlProgreso = this.progreso.connect(
      this.iframeRef.nativeElement,
      'alicante',
      (estado) => {
        this.estadoProgreso = estado;
        this.changeDetector.markForCheck();
      },
    );
  }

  ngOnDestroy(): void {
    this.controlProgreso?.destruir();
  }

  reintentarProgreso(): void {
    this.controlProgreso?.reintentar();
  }
}
