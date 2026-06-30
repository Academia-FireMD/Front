import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CjDificultadChipsComponent } from './cj-dificultad-chips.component';
import { DificultadCallejero } from '../models/callejero.model';

const DESC: Record<DificultadCallejero, string> = {
  FACIL: 'Descripción fácil.',
  MEDIO: 'Descripción medio.',
  DIFICIL: 'Descripción difícil.',
};

describe('CjDificultadChipsComponent', () => {
  let fixture: ComponentFixture<CjDificultadChipsComponent>;
  let component: CjDificultadChipsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CjDificultadChipsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CjDificultadChipsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('dificultad', 'MEDIO' as DificultadCallejero);
    fixture.componentRef.setInput('descripciones', DESC);
    fixture.detectChanges();
  });

  it('renderiza 3 botones con los labels Fácil/Medio/Difícil', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button.cj-dif-btn');
    expect(buttons.length).toBe(3);
    const labels = Array.from(buttons).map((b: any) => b.textContent?.trim());
    expect(labels).toContain('Fácil');
    expect(labels).toContain('Medio');
    expect(labels).toContain('Difícil');
  });

  it('el botón del nivel activo tiene clase .on; los demás no', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button.cj-dif-btn');
    const onButtons = Array.from(buttons).filter((b: any) =>
      b.classList.contains('on'),
    );
    expect(onButtons.length).toBe(1);
    expect((onButtons[0] as HTMLElement).textContent?.trim()).toBe('Medio');
  });

  it('clic en un botón emite dificultadChange con el valor correcto', () => {
    const emitted: DificultadCallejero[] = [];
    component.dificultadChange.subscribe((v) => emitted.push(v));
    const buttons = fixture.nativeElement.querySelectorAll('button.cj-dif-btn');
    (buttons[0] as HTMLElement).click();
    expect(emitted).toEqual(['FACIL']);
    (buttons[2] as HTMLElement).click();
    expect(emitted).toEqual(['FACIL', 'DIFICIL']);
  });

  it('muestra la descripción del nivel activo via descripcionActiva', () => {
    const desc = fixture.nativeElement.querySelector('p.cj-dif-desc');
    expect(desc.textContent?.trim()).toBe('Descripción medio.');
  });

  it('prefix personalizado genera data-testid correcto', () => {
    fixture.componentRef.setInput('prefix', 'mi-');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('[data-testid="mi-FACIL"]');
    expect(btn).toBeTruthy();
  });
});
