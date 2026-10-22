import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
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

  @ViewChild('surface', { static: true })
  private surface!: ElementRef<HTMLElement>;

  hasOverflow = false;
  descriptionIsTruncated = false;

  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private removeTooltipTransferListener: (() => void) | null = null;
  private removeViewportResizeListener: (() => void) | null = null;
  private measurementFrame: number | null = null;
  private viewReady = false;
  private destroyed = false;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly zone = inject(NgZone);
  private readonly changeDetector = inject(ChangeDetectorRef);

  get displayedTitle(): string {
    return this.eventTitle?.trim() || 'Sin nombre';
  }

  get tooltipAccessibleText(): string {
    return [this.displayedTitle, this.description?.trim()]
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
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.removeTooltipTransferListener?.();
    this.removeTooltipTransferListener = null;
    this.removeViewportResizeListener?.();
    this.removeViewportResizeListener = null;
    if (this.measurementFrame !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.measurementFrame);
      this.measurementFrame = null;
    }
  }

  private scheduleMeasurement(): void {
    if (
      !this.viewReady ||
      this.destroyed ||
      this.measurementFrame !== null ||
      typeof window === 'undefined'
    ) {
      return;
    }

    this.measurementFrame = window.requestAnimationFrame(() => {
      this.measurementFrame = null;
      this.measureOverflow();
    });
  }

  private measureOverflow(): void {
    const surface = this.surface.nativeElement;
    if (surface.clientWidth <= 0 || surface.clientHeight <= 0) return;

    const title = surface.querySelector<HTMLElement>('.event-title strong');
    const description = surface.querySelector<HTMLElement>('.event-comments');
    const titleOverflows =
      !!title &&
      (title.scrollWidth > title.clientWidth + 1 ||
        title.scrollHeight > title.clientHeight + 1);
    const hasDescription = !!this.description?.trim();
    const descriptionOverflows =
      hasDescription &&
      !!description &&
      (description.scrollWidth > description.clientWidth + 1 ||
        description.scrollHeight > description.clientHeight + 1);
    const nextHasOverflow = titleOverflows || descriptionOverflows;

    if (
      this.hasOverflow === nextHasOverflow &&
      this.descriptionIsTruncated === descriptionOverflows
    ) {
      return;
    }

    this.zone.run(() => {
      this.hasOverflow = nextHasOverflow;
      this.descriptionIsTruncated = descriptionOverflows;
      this.changeDetector.markForCheck();
    });
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
