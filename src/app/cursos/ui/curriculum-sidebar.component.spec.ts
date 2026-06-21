import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CurriculumSidebarComponent } from './curriculum-sidebar.component';
import { ProgresoLeccion, Seccion } from '../models/curso.model';

const secciones = [
  {
    id: 1,
    orden: 0,
    titulo: 'Sección A',
    cursoId: 1,
    lecciones: [
      { id: 10, orden: 0, titulo: 'L1', tipo: 'VIDEO', seccionId: 1 },
      { id: 11, orden: 1, titulo: 'L2', tipo: 'TEXTO', seccionId: 1 },
    ],
  },
] as unknown as Seccion[];

describe('CurriculumSidebarComponent', () => {
  let fixture: ComponentFixture<CurriculumSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurriculumSidebarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CurriculumSidebarComponent);
  });

  it('marca completadas y resalta la activa', () => {
    fixture.componentRef.setInput('secciones', secciones);
    fixture.componentRef.setInput('progreso', [
      { leccionId: 10, completada: true },
    ] as ProgresoLeccion[]);
    fixture.componentRef.setInput('leccionActivaId', 11);
    fixture.detectChanges();
    const completas = fixture.nativeElement.querySelectorAll(
      '.leccion-row.completada',
    );
    const activas = fixture.nativeElement.querySelectorAll(
      '.leccion-row.activa',
    );
    expect(completas.length).toBe(1);
    expect(activas.length).toBe(1);
  });

  it('emite la lección al click cuando es interactivo', () => {
    fixture.componentRef.setInput('secciones', secciones);
    fixture.componentRef.setInput('interactivo', true);
    fixture.detectChanges();
    const emit = jest.fn();
    fixture.componentInstance.seleccionar.subscribe(emit);
    fixture.componentInstance.onLeccion(secciones[0].lecciones[1]);
    expect(emit).toHaveBeenCalledWith(secciones[0].lecciones[1]);
  });

  it('NO emite en modo lectura (no interactivo)', () => {
    fixture.componentRef.setInput('secciones', secciones);
    fixture.componentRef.setInput('interactivo', false);
    fixture.detectChanges();
    const emit = jest.fn();
    fixture.componentInstance.seleccionar.subscribe(emit);
    fixture.componentInstance.onLeccion(secciones[0].lecciones[0]);
    expect(emit).not.toHaveBeenCalled();
  });

  it('toggle colapsa y expande una sección', () => {
    fixture.componentRef.setInput('secciones', secciones);
    fixture.detectChanges();
    expect(fixture.componentInstance.estaColapsada(1)).toBe(false);
    fixture.componentInstance.toggle(1);
    expect(fixture.componentInstance.estaColapsada(1)).toBe(true);
    fixture.componentInstance.toggle(1);
    expect(fixture.componentInstance.estaColapsada(1)).toBe(false);
  });
});
