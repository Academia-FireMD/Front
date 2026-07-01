import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { CallejeroEmbedComponent } from './callejero-embed.component';

describe('CallejeroEmbedComponent', () => {
  let fixture: ComponentFixture<CallejeroEmbedComponent>;
  let component: CallejeroEmbedComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CallejeroEmbedComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CallejeroEmbedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('crea el componente', () => {
    expect(component).toBeTruthy();
  });

  it('el iframe apunta al estático del HTML de Raúl (URL saneada)', () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    const url = sanitizer.sanitize(
      4 /* SecurityContext.RESOURCE_URL */,
      component.src,
    );
    expect(url).toContain('/callejero-embed/valencia_27.html');
    const iframe: HTMLIFrameElement | null =
      fixture.nativeElement.querySelector(
        '[data-testid=callejero-embed-iframe]',
      );
    expect(iframe).toBeTruthy();
    expect(iframe!.getAttribute('allow')).toContain('geolocation');
  });
});
