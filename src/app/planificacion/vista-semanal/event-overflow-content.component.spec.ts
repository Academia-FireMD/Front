import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventOverflowContentComponent } from './event-overflow-content.component';

describe('EventOverflowContentComponent: densidad y recorte', () => {
  let fixture: ComponentFixture<EventOverflowContentComponent>;
  let component: EventOverflowContentComponent;
  let surface: HTMLElement;
  let description: HTMLElement;

  const medir = () => {
    (component as any).measureOverflow();
    fixture.detectChanges();
  };

  const fijarAltura = (element: HTMLElement, altura: number) => {
    Object.defineProperty(element, 'clientHeight', {
      configurable: true,
      value: altura,
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EventOverflowContentComponent],
    })
      .overrideComponent(EventOverflowContentComponent, {
        set: {
          template: `
            <div #surface class="event-overflow-surface"
              [class.description-hidden]="descriptionHidden"
              [attr.data-compact]="isCompact ? 'true' : 'false'">
              <div class="event-title">
                <div class="event-title__line">
                  <strong>{{ eventTitle }}</strong>
                </div>
              </div>
              <div class="event-comments" style="font-size: 12px; line-height: 12px">
                {{ description }}
              </div>
              <div class="event-actions">
                <button type="button">Acción</button>
              </div>
              <span class="event-overflow-indicator">…</span>
            </div>
          `,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EventOverflowContentComponent);
    component = fixture.componentInstance;
    component.eventTitle = 'Evento de prueba';
    component.description = '**Descripción** de prueba';
    fixture.detectChanges();
    surface = fixture.nativeElement.querySelector('.event-overflow-surface');
    description = fixture.nativeElement.querySelector('.event-comments');
    Object.defineProperty(surface, 'clientWidth', {
      configurable: true,
      value: 240,
    });
  });

  afterEach(() => fixture.destroy());

  it('marca la tarjeta compacta bajo 56px y publica la clase en el host', () => {
    fijarAltura(surface, 26);
    fijarAltura(description, 24);

    medir();

    expect(component.isCompact).toBe(true);
    expect(fixture.nativeElement.classList).toContain(
      'event-overflow-content--compact',
    );
    expect(surface.getAttribute('data-compact')).toBe('true');
  });

  it('mantiene la densidad normal con 56px o más', () => {
    fijarAltura(surface, 56);
    fijarAltura(description, 30);

    medir();

    expect(component.isCompact).toBe(false);
    expect(fixture.nativeElement.classList).not.toContain(
      'event-overflow-content--compact',
    );
    expect(surface.getAttribute('data-compact')).toBe('false');
  });

  it('oculta la descripción sin una línea completa y la muestra al crecer', () => {
    fijarAltura(surface, 26);
    fijarAltura(description, 8);
    medir();

    expect(component.descriptionHidden).toBe(true);
    expect(component.descriptionIsTruncated).toBe(true);
    expect(component.hasOverflow).toBe(true);
    expect(surface.classList).toContain('description-hidden');
    expect(fixture.nativeElement.classList).toContain(
      'event-overflow-content--description-truncated',
    );

    fijarAltura(surface, 60);
    fijarAltura(description, 20);
    medir();

    expect(component.descriptionHidden).toBe(false);
    expect(component.descriptionIsTruncated).toBe(false);
    expect(component.hasOverflow).toBe(false);
    expect(surface.classList).not.toContain('description-hidden');
    expect(fixture.nativeElement.classList).not.toContain(
      'event-overflow-content--description-truncated',
    );
  });

  it('considera que una línea completa sí cabe', () => {
    fijarAltura(surface, 30);
    fijarAltura(description, 12);
    medir();

    expect(component.descriptionHidden).toBe(false);
    expect(component.descriptionIsTruncated).toBe(false);
  });
});

describe('EventOverflowContentComponent: contexto adicional', () => {
  let fixture: ComponentFixture<EventOverflowContentComponent>;
  let component: EventOverflowContentComponent;
  let surface: HTMLElement;
  let textColumn: HTMLElement;

  const medir = () => {
    (component as any).measureOverflow();
    fixture.detectChanges();
  };

  const fijarAltura = (element: HTMLElement, altura: number) => {
    Object.defineProperty(element, 'clientHeight', {
      configurable: true,
      value: altura,
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EventOverflowContentComponent],
    })
      .overrideComponent(EventOverflowContentComponent, {
        set: {
          template: `
            <div #surface class="event-overflow-surface"
              [attr.data-overflow]="hasOverflow ? 'true' : 'false'"
              [attr.data-compact]="isCompact ? 'true' : 'false'">
              <div class="event-text">
                <div class="event-header">
                  <div class="event-title">
                    <strong>{{ eventTitle }}</strong>
                  </div>
                </div>
                <div class="event-context">{{ contextText }}</div>
                <div class="event-comments"></div>
              </div>
            </div>
          `,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EventOverflowContentComponent);
    component = fixture.componentInstance;
    component.eventTitle = 'Fisico 30';
    fixture.detectChanges();
    surface = fixture.nativeElement.querySelector('.event-overflow-surface');
    textColumn = fixture.nativeElement.querySelector('.event-text');
    Object.defineProperty(surface, 'clientWidth', {
      configurable: true,
      value: 240,
    });
  });

  afterEach(() => fixture.destroy());

  it('en compacto ofrece el contexto completo aunque no haya comentarios', () => {
    component.contextText =
      'Plan físico: 2/4. Carrera de fondo (realizada), Cuerda doble (pendiente)';
    fixture.detectChanges();
    fijarAltura(surface, 26);
    medir();

    expect(component.isCompact).toBe(true);
    expect(component.hasOverflow).toBe(true);
    expect(surface.getAttribute('data-overflow')).toBe('true');
    expect(component.tooltipAccessibleText).toContain('Plan físico: 2/4');
    expect(component.tooltipAccessibleText).toContain(
      'Carrera de fondo (realizada)',
    );
  });

  it('en normal no muestra tooltip si el contexto visible cabe completo', () => {
    component.contextText = 'Plan físico: 1/1. Carrera (realizada)';
    fixture.detectChanges();
    fijarAltura(surface, 120);
    medir();

    expect(component.isCompact).toBe(false);
    expect(component.hasOverflow).toBe(false);
    expect(surface.getAttribute('data-overflow')).toBe('false');
  });

  it('en normal detecta el contexto recortado por la columna de texto', () => {
    component.contextText =
      'Plan físico: 2/4. Carrera de fondo (realizada), Cuerda doble (pendiente)';
    fixture.detectChanges();
    fijarAltura(surface, 56);

    const rect = (
      bottom: number,
      right: number,
      width: number,
      height: number,
    ) =>
      ({
        x: 0,
        y: 0,
        top: 0,
        bottom,
        right,
        left: 0,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect;
    jest
      .spyOn(textColumn, 'getBoundingClientRect')
      .mockReturnValue(rect(40, 240, 240, 40));
    const contexto = fixture.nativeElement.querySelector(
      '.event-context',
    ) as HTMLElement;
    jest
      .spyOn(contexto, 'getBoundingClientRect')
      .mockReturnValue(rect(52, 200, 200, 12));

    medir();

    expect(component.isCompact).toBe(false);
    expect(component.hasOverflow).toBe(true);
    expect(surface.getAttribute('data-overflow')).toBe('true');
  });

  it('refresca el contexto accesible cuando cambia el input físico', () => {
    component.contextText = 'Plan físico: 0/2. Cuerda (pendiente)';
    fixture.detectChanges();
    fijarAltura(surface, 26);
    medir();
    expect(component.hasOverflow).toBe(true);

    component.contextText = 'Plan físico: 2/2. Cuerda (realizada)';
    component.ngOnChanges();
    fixture.detectChanges();
    medir();

    expect(component.tooltipAccessibleText).toContain(
      'Plan físico: 2/2. Cuerda (realizada)',
    );
    expect(component.hasOverflow).toBe(true);
  });

  it('sin contexto mantiene el comportamiento previo', () => {
    component.contextText = null;
    fixture.detectChanges();
    fijarAltura(surface, 26);
    medir();

    expect(component.hasOverflow).toBe(false);
    expect(component.tooltipAccessibleText).toBe('Fisico 30');
  });
});

describe('EventOverflowContentComponent: transferencia del puntero', () => {
  let fixture: ComponentFixture<EventOverflowContentComponent>;
  let surface: HTMLElement;
  let tooltip: HTMLElement;
  let content: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EventOverflowContentComponent],
    })
      .overrideComponent(EventOverflowContentComponent, {
        set: { template: '<div #surface><ng-content></ng-content></div>' },
      })
      .compileComponents();
    fixture = TestBed.createComponent(EventOverflowContentComponent);
    fixture.detectChanges();
    surface = fixture.nativeElement.querySelector('div');
    tooltip = document.createElement('div');
    tooltip.id = 'event-overflow-test-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    content = document.createElement('p');
    content.textContent = 'Descripción completa';
    tooltip.append(content);
    document.body.append(tooltip);
    surface.setAttribute('aria-describedby', tooltip.id);
  });

  afterEach(() => {
    fixture.destroy();
    tooltip.remove();
  });

  it('permite entrar en los descendientes de su tooltip sin alterar el contenido', () => {
    const close = jest.fn();
    surface.addEventListener('mouseleave', close);

    surface.dispatchEvent(
      new MouseEvent('mouseleave', { relatedTarget: content }),
    );

    expect(close).not.toHaveBeenCalled();
    expect(content.className).toBe('');
    expect(content.textContent).toBe('Descripción completa');
  });

  it('conserva el cierre al salir hacia otro tooltip', () => {
    const close = jest.fn();
    const unrelatedTooltip = document.createElement('div');
    unrelatedTooltip.setAttribute('role', 'tooltip');
    surface.addEventListener('mouseleave', close);

    surface.dispatchEvent(
      new MouseEvent('mouseleave', { relatedTarget: unrelatedTooltip }),
    );

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('no intercepta la salida si el elemento ARIA no es un tooltip', () => {
    const close = jest.fn();
    tooltip.setAttribute('role', 'dialog');
    surface.addEventListener('mouseleave', close);

    surface.dispatchEvent(
      new MouseEvent('mouseleave', { relatedTarget: content }),
    );

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('retira su listener al destruir el evento', () => {
    const close = jest.fn();
    surface.addEventListener('mouseleave', close);
    fixture.destroy();

    surface.dispatchEvent(
      new MouseEvent('mouseleave', { relatedTarget: content }),
    );

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('EventOverflowContentComponent: medición agrupada por frame', () => {
  let fixtures: ComponentFixture<EventOverflowContentComponent>[];
  let callbacks: FrameRequestCallback[];
  let requestFrame: jest.SpyInstance;
  let cancelFrame: jest.SpyInstance;

  const crear = (): ComponentFixture<EventOverflowContentComponent> => {
    const fixture = TestBed.createComponent(EventOverflowContentComponent);
    const surface = fixture.nativeElement.querySelector(
      '.event-overflow-surface',
    ) as HTMLElement;
    Object.defineProperty(surface, 'clientWidth', {
      configurable: true,
      value: 240,
    });
    Object.defineProperty(surface, 'clientHeight', {
      configurable: true,
      value: 26,
    });
    fixture.detectChanges();
    fixtures.push(fixture);
    return fixture;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EventOverflowContentComponent],
    })
      .overrideComponent(EventOverflowContentComponent, {
        set: {
          template: `
            <div #surface class="event-overflow-surface">
              <div class="event-title"><strong>Evento</strong></div>
              <div class="event-comments">Descripción</div>
            </div>
          `,
        },
      })
      .compileComponents();

    fixtures = [];
    callbacks = [];
    requestFrame = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    cancelFrame = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const fixture of fixtures) fixture.destroy();
    requestFrame.mockRestore();
    cancelFrame.mockRestore();
  });

  it('agrupa varias instancias en un único frame y las actualiza todas', () => {
    const first = crear();
    const second = crear();

    expect(requestFrame).toHaveBeenCalledTimes(1);

    for (const callback of callbacks) callback(0);

    expect(first.componentInstance.isCompact).toBe(true);
    expect(second.componentInstance.isCompact).toBe(true);
  });

  it('no cancela el frame compartido al destruir una instancia pendiente', () => {
    const first = crear();
    const second = crear();

    first.destroy();
    fixtures = fixtures.filter((fixture) => fixture !== first);

    expect(cancelFrame).not.toHaveBeenCalled();

    for (const callback of callbacks) callback(0);

    expect(second.componentInstance.isCompact).toBe(true);
  });
});
