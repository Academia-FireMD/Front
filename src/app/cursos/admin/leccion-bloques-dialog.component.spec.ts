import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { Bloque, Leccion } from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { BloqueFormResult } from './bloque-form.component';
import { LeccionBloquesDialogComponent } from './leccion-bloques-dialog.component';

function leccion(bloques: Bloque[] = []): Leccion {
  return {
    id: 1,
    titulo: 'L1',
    orden: 0,
    tipo: 'VIDEO',
    seccionId: 1,
    bloques,
  };
}

describe('LeccionBloquesDialogComponent', () => {
  let fixture: ComponentFixture<LeccionBloquesDialogComponent>;
  let component: LeccionBloquesDialogComponent;
  let service: jest.Mocked<Partial<CursosAdminService>>;

  beforeEach(async () => {
    service = {
      createBloque: jest.fn(),
      updateBloque: jest.fn(),
      deleteBloque: jest.fn(),
      reorderBloques: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LeccionBloquesDialogComponent],
      providers: [
        { provide: CursosAdminService, useValue: service },
        {
          provide: ToastrService,
          useValue: {
            success: jest.fn(),
            warning: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(LeccionBloquesDialogComponent);
    component = fixture.componentInstance;
  });

  function setLeccion(l: Leccion): void {
    fixture.componentRef.setInput('leccion', l);
    fixture.detectChanges(); // dispara el effect de sincronización
  }

  it('sincroniza la pila local desde leccion.bloques', () => {
    const bloques: Bloque[] = [
      { id: 1, leccionId: 1, orden: 0, tipo: 'VIDEO' },
      { id: 2, leccionId: 1, orden: 1, tipo: 'TEXTO', contenidoMarkdown: 'x' },
    ];
    setLeccion(leccion(bloques));
    expect(component.bloques().length).toBe(2);
    expect(component.vacio()).toBe(false);
  });

  it('vacio()=true cuando no hay bloques', () => {
    setLeccion(leccion([]));
    expect(component.vacio()).toBe(true);
  });

  it('meta() devuelve label e icono por tipo', () => {
    expect(component.meta('VIDEO').label).toBe('Vídeo');
    expect(component.meta('TEST').icon).toContain('question-circle');
  });

  it('resumen() formatea cada tipo', () => {
    expect(
      component.resumen({
        id: 1,
        leccionId: 1,
        orden: 0,
        tipo: 'VIDEO',
        duracionSegundos: 120,
      }),
    ).toBe('2 min');
    expect(
      component.resumen({
        id: 1,
        leccionId: 1,
        orden: 0,
        tipo: 'TEXTO',
        contenidoMarkdown: 'abcd',
      }),
    ).toBe('4 caracteres');
    expect(
      component.resumen({
        id: 1,
        leccionId: 1,
        orden: 0,
        tipo: 'TEST',
        numPreguntas: 12,
        esDeRepaso: true,
      }),
    ).toBe('12 preguntas · repaso');
  });

  it('openAdd() pone modo form sin bloque en edición', () => {
    setLeccion(leccion([]));
    component.openAdd();
    expect(component.mode()).toBe('form');
    expect(component.editando()).toBeNull();
  });

  it('openEdit() pone modo form con el bloque', () => {
    const b: Bloque = { id: 7, leccionId: 1, orden: 0, tipo: 'TEXTO' };
    setLeccion(leccion([b]));
    component.openEdit(b);
    expect(component.mode()).toBe('form');
    expect(component.editando()).toBe(b);
  });

  it('onFormSaved (create) llama createBloque, añade a la pila y emite', async () => {
    setLeccion(leccion([]));
    const created: Bloque = {
      id: 9,
      leccionId: 1,
      orden: 0,
      tipo: 'TEXTO',
      contenidoMarkdown: '# Hi',
    };
    (service.createBloque as jest.Mock).mockReturnValue(of(created));
    const emit = jest.fn();
    component.bloquesChanged.subscribe(emit);

    const result: BloqueFormResult = {
      tipo: 'TEXTO',
      contenidoMarkdown: '# Hi',
    };
    component.openAdd();
    await component.onFormSaved(result);

    expect(service.createBloque).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tipo: 'TEXTO',
        orden: 0,
        contenidoMarkdown: '# Hi',
      }),
    );
    expect(component.bloques()).toEqual([created]);
    expect(emit).toHaveBeenCalledWith([created]);
    expect(component.mode()).toBe('list');
  });

  it('onFormSaved (create) usa orden = longitud actual de la pila', async () => {
    const existente: Bloque = { id: 1, leccionId: 1, orden: 0, tipo: 'VIDEO' };
    setLeccion(leccion([existente]));
    (service.createBloque as jest.Mock).mockReturnValue(
      of({ id: 2, leccionId: 1, orden: 1, tipo: 'TEXTO' }),
    );
    component.openAdd();
    await component.onFormSaved({ tipo: 'TEXTO', contenidoMarkdown: 'x' });
    expect(service.createBloque).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ orden: 1 }),
    );
  });

  it('onFormSaved (edit) llama updateBloque y refleja el cambio', async () => {
    const b: Bloque = {
      id: 5,
      leccionId: 1,
      orden: 0,
      tipo: 'TEXTO',
      contenidoMarkdown: 'old',
    };
    setLeccion(leccion([b]));
    (service.updateBloque as jest.Mock).mockReturnValue(
      of({ ...b, contenidoMarkdown: 'new' }),
    );
    component.openEdit(b);
    await component.onFormSaved({ tipo: 'TEXTO', contenidoMarkdown: 'new' });
    expect(service.updateBloque).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ contenidoMarkdown: 'new' }),
    );
    expect(component.bloques()[0].contenidoMarkdown).toBe('new');
  });

  it('deleteBloque() llama deleteBloque y quita de la pila', async () => {
    const b: Bloque = { id: 4, leccionId: 1, orden: 0, tipo: 'VIDEO' };
    setLeccion(leccion([b]));
    (service.deleteBloque as jest.Mock).mockReturnValue(of(undefined));
    const emit = jest.fn();
    component.bloquesChanged.subscribe(emit);
    await component.deleteBloque(b);
    expect(service.deleteBloque).toHaveBeenCalledWith(4);
    expect(component.bloques()).toEqual([]);
    expect(emit).toHaveBeenCalledWith([]);
  });

  it('drop() reordena y persiste con reorderBloques', async () => {
    const b1: Bloque = { id: 1, leccionId: 1, orden: 0, tipo: 'VIDEO' };
    const b2: Bloque = { id: 2, leccionId: 1, orden: 1, tipo: 'TEXTO' };
    setLeccion(leccion([b1, b2]));
    (service.reorderBloques as jest.Mock).mockReturnValue(of(undefined));
    await component.drop({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<
      Bloque[]
    >);
    expect(component.bloques().map((b) => b.id)).toEqual([2, 1]);
    expect(service.reorderBloques).toHaveBeenCalledWith([
      { id: 2, orden: 0 },
      { id: 1, orden: 1 },
    ]);
  });

  it('drop() sin movimiento no llama al servicio', async () => {
    setLeccion(leccion([{ id: 1, leccionId: 1, orden: 0, tipo: 'VIDEO' }]));
    await component.drop({ previousIndex: 0, currentIndex: 0 } as CdkDragDrop<
      Bloque[]
    >);
    expect(service.reorderBloques).not.toHaveBeenCalled();
  });
});
