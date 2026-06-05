import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeleccionCrearReglaDirective } from './seleccion-crear-regla.directive';
import { StudyAssistantService } from '../services/study-assistant.service';

@Component({
  standalone: true,
  imports: [SeleccionCrearReglaDirective],
  template: `
    <div [appSeleccionCrearRegla]="activa">
      <p>texto largo de prueba para seleccionar</p>
    </div>
  `,
})
class TestHostComponent {
  activa = false;
}

describe('SeleccionCrearReglaDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let studyAssistantSpy: { openWithMessage: jest.Mock };

  beforeEach(() => {
    studyAssistantSpy = { openWithMessage: jest.fn() };

    TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).overrideProvider(StudyAssistantService, { useValue: studyAssistantSpy });

    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelector('.seleccion-crear-regla-btn')?.remove();
    jest.restoreAllMocks();
  });

  it('con activa=true y selección válida: muestra botón y al hacer mousedown llama a openWithMessage con el texto seleccionado', () => {
    component.activa = true;
    fixture.detectChanges();

    const paragraph = fixture.nativeElement.querySelector('p');
    const mockRange = {
      commonAncestorContainer: paragraph,
      getBoundingClientRect: () =>
        ({ top: 100, left: 100, width: 50, height: 20 }) as DOMRect,
    };

    const mockSelection = {
      toString: () => 'texto largo de prueba para seleccionar',
      rangeCount: 1,
      getRangeAt: () => mockRange,
      removeAllRanges: jest.fn(),
    };

    jest
      .spyOn(document, 'getSelection')
      .mockReturnValue(mockSelection as unknown as Selection);

    const div = fixture.nativeElement.querySelector('div');
    div.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();

    const boton = document.querySelector('button.seleccion-crear-regla-btn');
    expect(boton).toBeTruthy();

    boton!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(studyAssistantSpy.openWithMessage).toHaveBeenCalled();
    const llamada = studyAssistantSpy.openWithMessage.mock
      .calls[0][0] as string;
    expect(llamada).toContain('texto largo de prueba para seleccionar');
  });

  it('con activa=false: tras mouseup no aparece ningún botón', () => {
    component.activa = false;
    fixture.detectChanges();

    const div = fixture.nativeElement.querySelector('div');
    div.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();

    const boton = document.querySelector('button.seleccion-crear-regla-btn');
    expect(boton).toBeFalsy();
  });

  it('con selección corta (<8 chars): no aparece botón', () => {
    component.activa = true;
    fixture.detectChanges();

    const paragraph = fixture.nativeElement.querySelector('p');
    const mockRange = {
      commonAncestorContainer: paragraph,
      getBoundingClientRect: () =>
        ({ top: 100, left: 100, width: 50, height: 20 }) as DOMRect,
    };

    const mockSelection = {
      toString: () => 'corto',
      rangeCount: 1,
      getRangeAt: () => mockRange,
      removeAllRanges: jest.fn(),
    };

    jest
      .spyOn(document, 'getSelection')
      .mockReturnValue(mockSelection as unknown as Selection);

    const div = fixture.nativeElement.querySelector('div');
    div.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();

    const boton = document.querySelector('button.seleccion-crear-regla-btn');
    expect(boton).toBeFalsy();
  });
});
