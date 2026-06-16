import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CursoCardComponent } from './curso-card.component';
import { Curso } from '../models/curso.model';
import { Oposicion } from '../../shared/models/subscription.model';

const baseCurso: Curso = {
  id: 1,
  titulo: 'Curso X',
  slug: 'curso-x',
  estado: 'PUBLICADO',
  wooProductId: 5,
  precio: 49.9,
};

describe('CursoCardComponent', () => {
  let fixture: ComponentFixture<CursoCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CursoCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CursoCardComponent);
  });

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  it('CTA = Comprar cuando no hay acceso', () => {
    fixture.componentRef.setInput('curso', baseCurso);
    fixture.componentRef.setInput('tieneAcceso', false);
    fixture.detectChanges();
    expect(text()).toContain('Comprar');
  });

  it('CTA = Continuar cuando hay acceso y progreso > 0', () => {
    fixture.componentRef.setInput('curso', baseCurso);
    fixture.componentRef.setInput('tieneAcceso', true);
    fixture.componentRef.setInput('progreso', 40);
    fixture.detectChanges();
    expect(text()).toContain('Continuar');
    expect(fixture.componentInstance.mostrarProgreso()).toBe(true);
  });

  it('CTA = Empezar cuando hay acceso y progreso 0', () => {
    fixture.componentRef.setInput('curso', baseCurso);
    fixture.componentRef.setInput('tieneAcceso', true);
    fixture.componentRef.setInput('progreso', 0);
    fixture.detectChanges();
    expect(text()).toContain('Empezar');
  });

  it('emite comprar (no abrir) al pulsar la CTA de compra', () => {
    fixture.componentRef.setInput('curso', baseCurso);
    fixture.componentRef.setInput('tieneAcceso', false);
    fixture.detectChanges();
    const comprar = jest.fn();
    const abrir = jest.fn();
    fixture.componentInstance.comprar.subscribe(comprar);
    fixture.componentInstance.abrir.subscribe(abrir);
    fixture.componentInstance.onCta(new Event('click'));
    expect(comprar).toHaveBeenCalledTimes(1);
    expect(abrir).not.toHaveBeenCalled();
  });

  it('muestra badges de relevancia solo para oposiciones específicas (no GENERAL)', () => {
    fixture.componentRef.setInput('curso', {
      ...baseCurso,
      relevancia: [Oposicion.GENERAL, Oposicion.VALENCIA_AYUNTAMIENTO],
    });
    fixture.componentRef.setInput('tieneAcceso', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.oposicionBadges()).toEqual([
      'Valencia Ayuntamiento',
    ]);
  });

  it('relevancia vacía o solo GENERAL → sin badges', () => {
    fixture.componentRef.setInput('curso', {
      ...baseCurso,
      relevancia: [Oposicion.GENERAL],
    });
    fixture.componentRef.setInput('tieneAcceso', true);
    fixture.detectChanges();
    expect(fixture.componentInstance.oposicionBadges()).toEqual([]);
  });

  it('curso gratuito sin acceso → CTA "Acceder gratis" + badge Gratis', () => {
    fixture.componentRef.setInput('curso', {
      ...baseCurso,
      esGratuito: true,
      wooProductId: null,
      precio: null,
    });
    fixture.componentRef.setInput('tieneAcceso', false);
    fixture.detectChanges();
    expect(fixture.componentInstance.cta()).toBe('acceder-gratis');
    expect(text()).toContain('Acceder gratis');
    expect(text()).toContain('Gratis');
  });

  it('curso gratuito → CTA abre (no compra)', () => {
    fixture.componentRef.setInput('curso', {
      ...baseCurso,
      esGratuito: true,
      wooProductId: null,
    });
    fixture.componentRef.setInput('tieneAcceso', false);
    fixture.detectChanges();
    const comprar = jest.fn();
    const abrir = jest.fn();
    fixture.componentInstance.comprar.subscribe(comprar);
    fixture.componentInstance.abrir.subscribe(abrir);
    fixture.componentInstance.onCta(new Event('click'));
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(comprar).not.toHaveBeenCalled();
  });
});
