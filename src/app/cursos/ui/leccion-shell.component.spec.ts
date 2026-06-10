import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeccionShellComponent } from './leccion-shell.component';
import { Leccion, Seccion } from '../models/curso.model';

const secciones = [
  {
    id: 1,
    orden: 0,
    titulo: 'A',
    cursoId: 1,
    lecciones: [
      { id: 10, orden: 0, titulo: 'L1', tipo: 'VIDEO', seccionId: 1 },
      { id: 11, orden: 1, titulo: 'L2', tipo: 'TEXTO', seccionId: 1 },
    ],
  },
  {
    id: 2,
    orden: 1,
    titulo: 'B',
    cursoId: 1,
    lecciones: [
      { id: 12, orden: 0, titulo: 'L3', tipo: 'VIDEO', seccionId: 2 },
    ],
  },
] as unknown as Seccion[];

describe('LeccionShellComponent', () => {
  let fixture: ComponentFixture<LeccionShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeccionShellComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LeccionShellComponent);
    fixture.componentRef.setInput('secciones', secciones);
  });

  it('siguiente() emite la lección posterior en orden plano', () => {
    fixture.componentRef.setInput('leccionActivaId', 11);
    fixture.detectChanges();
    let emit: Leccion | undefined;
    fixture.componentInstance.navegar.subscribe((l) => (emit = l));
    fixture.componentInstance.siguiente();
    expect(emit?.id).toBe(12);
  });

  it('anterior() emite la lección previa', () => {
    fixture.componentRef.setInput('leccionActivaId', 11);
    fixture.detectChanges();
    let emit: Leccion | undefined;
    fixture.componentInstance.navegar.subscribe((l) => (emit = l));
    fixture.componentInstance.anterior();
    expect(emit?.id).toBe(10);
  });

  it('en la primera lección no hay anterior; en la última no hay siguiente', () => {
    fixture.componentRef.setInput('leccionActivaId', 10);
    fixture.detectChanges();
    expect(fixture.componentInstance.anteriorL()).toBeNull();
    fixture.componentRef.setInput('leccionActivaId', 12);
    fixture.detectChanges();
    expect(fixture.componentInstance.siguienteL()).toBeNull();
  });

  it('toggleDrawer alterna el estado del drawer', () => {
    expect(fixture.componentInstance.drawerAbierto()).toBe(false);
    fixture.componentInstance.toggleDrawer();
    expect(fixture.componentInstance.drawerAbierto()).toBe(true);
  });
});
