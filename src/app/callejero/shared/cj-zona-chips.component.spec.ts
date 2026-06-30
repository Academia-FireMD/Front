import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CjZonaChipsComponent } from './cj-zona-chips.component';

const PARQUES = ['A', 'B', 'C'];

describe('CjZonaChipsComponent', () => {
  let fixture: ComponentFixture<CjZonaChipsComponent>;
  let component: CjZonaChipsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CjZonaChipsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CjZonaChipsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('parques', PARQUES);
    fixture.componentRef.setInput('seleccion', new Set(PARQUES));
    fixture.detectChanges();
  });

  it('con todos seleccionados: desc() = "Todas las zonas marcadas (los 3 parques)."', () => {
    const p = fixture.nativeElement.querySelector(
      '[data-testid="cj-zona-desc"]',
    );
    expect(p.textContent?.trim()).toBe(
      'Todas las zonas marcadas (los 3 parques).',
    );
  });

  it('con 0 seleccionados: desc() = "Ninguna zona marcada — marca al menos una."', () => {
    fixture.componentRef.setInput('seleccion', new Set<string>());
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector(
      '[data-testid="cj-zona-desc"]',
    );
    expect(p.textContent?.trim()).toBe(
      'Ninguna zona marcada — marca al menos una.',
    );
  });

  it('con selección parcial: desc() = "Solo: A + B."', () => {
    fixture.componentRef.setInput('seleccion', new Set(['A', 'B']));
    fixture.detectChanges();
    const p = fixture.nativeElement.querySelector(
      '[data-testid="cj-zona-desc"]',
    );
    expect(p.textContent?.trim()).toBe('Solo: A + B.');
  });

  it('clic en chip no seleccionado → emite Set con el parque AÑADIDO', () => {
    fixture.componentRef.setInput('seleccion', new Set(['A']));
    fixture.detectChanges();
    const emitted: Set<string>[] = [];
    component.seleccionChange.subscribe((v) => emitted.push(v));
    const buttons = fixture.nativeElement.querySelectorAll(
      'button.cj-zona-chip',
    );
    (buttons[1] as HTMLElement).click(); // 'B' not selected
    expect(emitted.length).toBe(1);
    expect(emitted[0].has('B')).toBe(true);
    expect(emitted[0].has('A')).toBe(true);
  });

  it('clic en chip seleccionado → emite Set con el parque ELIMINADO', () => {
    fixture.componentRef.setInput('seleccion', new Set(['A', 'B']));
    fixture.detectChanges();
    const emitted: Set<string>[] = [];
    component.seleccionChange.subscribe((v) => emitted.push(v));
    const buttons = fixture.nativeElement.querySelectorAll(
      'button.cj-zona-chip',
    );
    (buttons[0] as HTMLElement).click(); // 'A' is selected → remove
    expect(emitted.length).toBe(1);
    expect(emitted[0].has('A')).toBe(false);
    expect(emitted[0].has('B')).toBe(true);
  });

  it('inmutabilidad: el Set emitido es una nueva instancia', () => {
    const original = new Set(['A', 'B']);
    fixture.componentRef.setInput('seleccion', original);
    fixture.detectChanges();
    const emitted: Set<string>[] = [];
    component.seleccionChange.subscribe((v) => emitted.push(v));
    const buttons = fixture.nativeElement.querySelectorAll(
      'button.cj-zona-chip',
    );
    (buttons[2] as HTMLElement).click(); // 'C' not in original
    expect(emitted[0]).not.toBe(original);
    expect(original.has('C')).toBe(false); // original unchanged
  });
});
