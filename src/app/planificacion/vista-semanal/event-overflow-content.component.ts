import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  PLATFORM_ID,
  Renderer2,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface OverflowState {
  hasOverflow: boolean;
  descriptionIsTruncated: boolean;
  descriptionHidden: boolean;
  isCompact: boolean;
}

@Component({
  selector: 'app-event-overflow-content',
  templateUrl: './event-overflow-content.component.html',
  styleUrl: './event-overflow-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventOverflowContentComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() eventTitle: string | null | undefined;
  @Input() description: string | null | undefined;
  /**
   * Contexto adicional en texto plano que la tarjeta no siempre puede mostrar
   * (p. ej. resumen y disciplinas del plan físico en densidad compacta). Se
   * conserva íntegro en el tooltip y en la etiqueta accesible. Es opcional y
   * retrocompatible: sin valor, el componente se comporta como antes.
   */
  @Input() contextText: string | null | undefined;

  @ViewChild('surface', { static: true })
  private surface!: ElementRef<HTMLElement>;

  @HostBinding('class.event-overflow-content--compact')
  isCompact = false;

  hasOverflow = false;
  @HostBinding('class.event-overflow-content--description-truncated')
  descriptionIsTruncated = false;
  descriptionHidden = false;

  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private removeTooltipTransferListener: (() => void) | null = null;
  private removeViewportResizeListener: (() => void) | null = null;
  private viewReady = false;
  private destroyed = false;

  /**
   * Una sola medición por frame para todas las instancias. Cada componente
   * mide su propio DOM; si se intercalan lecturas y escrituras, la clase
   * compacta del primero obliga a recalcular el layout antes de la lectura
   * del siguiente. Se agrupan todas las lecturas y después se aplican los
   * cambios con una única entrada en Angular.
   */
  private static readonly pendingMeasurements =
    new Set<EventOverflowContentComponent>();
  private static measurementFrame: number | null = null;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  get displayedTitle(): string {
    return this.eventTitle?.trim() || 'Sin nombre';
  }

  get tooltipAccessibleText(): string {
    return [
      this.displayedTitle,
      this.contextText?.trim(),
      this.description?.trim(),
    ]
      .filter(Boolean)
      .join('. ');
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.viewReady = true;
    const surface = this.surface.nativeElement;

    this.zone.runOutsideAngular(() => {
      this.bindTooltipPointerTransfer();
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() =>
          this.scheduleMeasurement(),
        );
        this.resizeObserver.observe(surface);
        this.observeContentElements();
      }

      if (typeof MutationObserver !== 'undefined') {
        this.mutationObserver = new MutationObserver(() => {
          this.observeContentElements();
          this.scheduleMeasurement();
        });
        this.mutationObserver.observe(surface, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }

      this.removeViewportResizeListener = this.renderer.listen(
        'window',
        'resize',
        () => this.scheduleMeasurement(),
      );
      this.scheduleMeasurement();
    });
  }

  ngOnChanges(): void {
    this.scheduleMeasurement();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.viewReady = false;
    EventOverflowContentComponent.pendingMeasurements.delete(this);
    if (
      EventOverflowContentComponent.pendingMeasurements.size === 0 &&
      EventOverflowContentComponent.measurementFrame !== null &&
      typeof window !== 'undefined'
    ) {
      window.cancelAnimationFrame(
        EventOverflowContentComponent.measurementFrame,
      );
      EventOverflowContentComponent.measurementFrame = null;
    }
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.removeTooltipTransferListener?.();
    this.removeTooltipTransferListener = null;
    this.removeViewportResizeListener?.();
    this.removeViewportResizeListener = null;
  }

  private static flushMeasurements(): void {
    EventOverflowContentComponent.measurementFrame = null;
    const pending = Array.from(
      EventOverflowContentComponent.pendingMeasurements,
    );
    EventOverflowContentComponent.pendingMeasurements.clear();

    // Fase 1: sólo lecturas de layout, sin tocar clases ni bindings.
    const measurements: Array<{
      component: EventOverflowContentComponent;
      state: OverflowState;
    }> = [];
    for (const component of pending) {
      if (component.destroyed || !component.viewReady) continue;
      const state = component.readOverflowState();
      if (state) measurements.push({ component, state });
    }
    if (!measurements.length) return;

    // Fase 2: una única detección de cambios para todas las instancias.
    measurements[0].component.zone.run(() => {
      for (const { component, state } of measurements) {
        component.applyOverflowState(state);
      }
    });
  }

  private scheduleMeasurement(): void {
    if (!this.viewReady || this.destroyed || typeof window === 'undefined') {
      return;
    }

    EventOverflowContentComponent.pendingMeasurements.add(this);
    if (EventOverflowContentComponent.measurementFrame !== null) return;

    EventOverflowContentComponent.measurementFrame =
      window.requestAnimationFrame(() =>
        EventOverflowContentComponent.flushMeasurements(),
      );
  }

  private measureOverflow(): void {
    const state = this.readOverflowState();
    if (!state) return;

    this.zone.run(() => this.applyOverflowState(state));
  }

  private readOverflowState(): OverflowState | null {
    const surface = this.surface.nativeElement;
    if (surface.clientWidth <= 0 || surface.clientHeight <= 0) return null;

    const title = surface.querySelector<HTMLElement>('.event-title strong');
    const description = surface.querySelector<HTMLElement>('.event-comments');
    const nextCompact = surface.clientHeight < 56;
    const titleOverflows =
      !!title &&
      (title.scrollWidth > title.clientWidth + 1 ||
        title.scrollHeight > title.clientHeight + 1);
    const hasDescription = !!this.description?.trim();
    const descriptionLineHeight = this.lineHeightOf(description);
    // Si el hueco restante ni siquiera admite una línea completa, el texto se
    // oculta (el tooltip conserva el contenido completo) en lugar de dejar
    // una línea cortada a la mitad.
    const nextDescriptionHidden =
      hasDescription &&
      !!description &&
      descriptionLineHeight > 0 &&
      description.clientHeight + 0.5 < descriptionLineHeight;
    const descriptionOverflows =
      hasDescription &&
      !!description &&
      (nextDescriptionHidden ||
        description.scrollWidth > description.clientWidth + 1 ||
        description.scrollHeight > description.clientHeight + 1);
    // En compacto el CSS oculta el contexto físico (no cabe en 24px). En
    // densidad normal puede quedar recortado por la columna de texto aunque
    // el título y los comentarios quepan: ambos casos exigen tooltip.
    const hasContext = !!this.contextText?.trim();
    const contextOverflows =
      hasContext &&
      (nextCompact || this.isTextColumnClipped(surface, description));

    return {
      hasOverflow: titleOverflows || descriptionOverflows || contextOverflows,
      descriptionIsTruncated: descriptionOverflows,
      descriptionHidden: nextDescriptionHidden,
      isCompact: nextCompact,
    };
  }

  private applyOverflowState(state: OverflowState): void {
    if (
      this.hasOverflow === state.hasOverflow &&
      this.descriptionIsTruncated === state.descriptionIsTruncated &&
      this.descriptionHidden === state.descriptionHidden &&
      this.isCompact === state.isCompact
    ) {
      return;
    }

    this.hasOverflow = state.hasOverflow;
    this.descriptionIsTruncated = state.descriptionIsTruncated;
    this.descriptionHidden = state.descriptionHidden;
    this.isCompact = state.isCompact;
    this.changeDetector.markForCheck();
  }

  /**
   * ¿La columna de texto recorta contenido que no sea título/comentarios?
   * Se comprueba el desbordamiento propio de cada bloque y sus descendientes
   * (p. ej. los chips de disciplinas físicas), sin leer nada por binding.
   */
  private isTextColumnClipped(
    surface: HTMLElement,
    description: HTMLElement | null,
  ): boolean {
    const textColumn = surface.querySelector<HTMLElement>('.event-text');
    if (!textColumn) return false;
    const columnRect = textColumn.getBoundingClientRect();
    const overflowsColumn = (element: HTMLElement): boolean => {
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        (rect.bottom > columnRect.bottom + 1 ||
          rect.right > columnRect.right + 1)
      );
    };
    const scrolls = (element: HTMLElement): boolean =>
      element.scrollHeight > element.clientHeight + 1 ||
      element.scrollWidth > element.clientWidth + 1;

    for (const child of Array.from(textColumn.children) as HTMLElement[]) {
      if (
        child === description ||
        child.classList.contains('event-overflow-indicator')
      ) {
        continue;
      }
      if (scrolls(child) || overflowsColumn(child)) return true;
      for (const descendant of Array.from(
        child.querySelectorAll<HTMLElement>('*'),
      )) {
        if (scrolls(descendant) || overflowsColumn(descendant)) return true;
      }
    }
    return false;
  }

  private lineHeightOf(element: HTMLElement | null): number {
    if (!element || typeof getComputedStyle === 'undefined') return 0;
    const styles = getComputedStyle(element);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
    const fontSize = Number.parseFloat(styles.fontSize);
    return Number.isFinite(fontSize) ? fontSize * 1.2 : 0;
  }

  private observeContentElements(): void {
    if (!this.resizeObserver) return;
    const surface = this.surface.nativeElement;
    const title = surface.querySelector<HTMLElement>('.event-title strong');
    const description = surface.querySelector<HTMLElement>('.event-comments');
    if (title) this.resizeObserver.observe(title);
    if (description) this.resizeObserver.observe(description);
  }

  private bindTooltipPointerTransfer(): void {
    const surface = this.surface.nativeElement;
    const listener = (event: MouseEvent): void => {
      if (!(event.relatedTarget instanceof Node)) return;

      // PrimeNG17 sólo reconoce las clases del contenedor al salir del
      // activador. Una plantilla contiene descendientes propios: permitimos
      // el paso a la burbuja asociada por ARIA sin modificar el componente
      // de terceros ni sus clases, y conservamos su cierre al salir de ella.
      const tooltipIds = surface.getAttribute('aria-describedby')?.split(/\s+/);
      const entersOwnTooltip = tooltipIds?.some((id) => {
        const tooltip = document.getElementById(id);
        return (
          tooltip?.getAttribute('role') === 'tooltip' &&
          tooltip.contains(event.relatedTarget as Node)
        );
      });
      if (entersOwnTooltip) event.stopImmediatePropagation();
    };
    surface.addEventListener('mouseleave', listener, true);
    this.removeTooltipTransferListener = () =>
      surface.removeEventListener('mouseleave', listener, true);
  }
}
