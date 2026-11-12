import { TestBed } from '@angular/core/testing';
import { AlumnoAccesosComponent } from './alumno-accesos.component';
describe('tarjeta compartida de accesos', () => {
  it('calcula el progreso real sobre lecciones visibles y respeta las completadas', () => {
    const card = new AlumnoAccesosComponent();
    const curso: any = {
      curso: { secciones: [{ lecciones: [{ id: 1 }, { id: 2 }] }] },
      progreso: [
        { leccionId: 1, porcentajeVisto: 0, completada: true },
        { leccionId: 2, porcentajeVisto: 50, completada: false },
        { leccionId: 99, porcentajeVisto: 100, completada: true },
      ],
    };
    expect(card.progreso(curso)).toBe(75);
    expect(card.progreso({ ...curso, progreso: [] })).toBe(0);
    expect(card.progreso({ curso: { secciones: [] } } as any)).toBe(0);
  });
  it('emite el curso explícito en Perfil y presenta solo lectura para administración', async () => {
    const fixture = TestBed.createComponent(AlumnoAccesosComponent);
    const card = fixture.componentInstance;
    const curso: any = { curso: { titulo: 'Curso QA', secciones: [] } };
    card.cursos = [curso];
    card.perfil = true;
    const emit = jest.spyOn(card.abrirCurso, 'emit');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(emit).toHaveBeenCalledWith(curso);
    card.perfil = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
