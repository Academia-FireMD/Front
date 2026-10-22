import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventOverflowContentComponent } from './event-overflow-content.component';

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
