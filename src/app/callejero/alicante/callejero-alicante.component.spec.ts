import { SecurityContext } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { CallejeroAlicanteComponent } from './callejero-alicante.component';

describe('CallejeroAlicanteComponent', () => {
  let fixture: ComponentFixture<CallejeroAlicanteComponent>;
  let component: CallejeroAlicanteComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CallejeroAlicanteComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CallejeroAlicanteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('apunta al HTML autónomo de Alicante', () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    const iframe: HTMLIFrameElement = fixture.nativeElement.querySelector(
      '[data-testid=callejero-alicante-iframe]',
    );
    expect(
      sanitizer.sanitize(SecurityContext.RESOURCE_URL, component.src),
    ).toBe('/callejero-embed/alicante_16.html');
    expect(iframe.getAttribute('src')).toBe(
      '/callejero-embed/alicante_16.html',
    );
    expect(iframe.title).toBe('Callejero Alicante');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(iframe.hasAttribute('allow')).toBe(false);
  });

  it('no expone manejadores de mensajes ni autenticación', () => {
    expect('onMessage' in component).toBe(false);
    expect('responderAuth' in component).toBe(false);
  });
});
