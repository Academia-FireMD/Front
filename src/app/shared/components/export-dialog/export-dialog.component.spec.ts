import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {
  ExportDialogComponent,
  ExportDialogEvent,
} from './export-dialog.component';
import { Dificultad } from '../../models/pregunta.model';
import { COMMON_TEST_PROVIDERS } from '../../../testing';

describe('ExportDialogComponent', () => {
  let component: ExportDialogComponent;
  let fixture: ComponentFixture<ExportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Override imports and template so SharedModule's PrimeNG components
      // (p-dialog, p-dropdown, TemaSelectComponent, etc.) are not rendered in
      // unit tests. FormControls, signals and methods on the class are unaffected.
      .overrideComponent(ExportDialogComponent, {
        set: {
          imports: [ReactiveFormsModule, FormsModule],
          template: '', // stub — these tests exercise logic, not the rendered DOM
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ExportDialogComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders with default state', () => {
    expect(component).toBeTruthy();
    expect(component.temasControl.value).toEqual([]);
    expect(component.dificultadControl.value).toBeNull();
    expect(component.selectedFormato()).toBe('excel');
  });

  describe('onExportar', () => {
    it('emits exportar with filled filtros and formato', () => {
      const emitSpy = jest.spyOn(component.exportar, 'emit');

      component.temasControl.setValue([1]);
      component.dificultadControl.setValue(Dificultad.BASICO);
      component.selectedFormato.set('excel');

      component.onExportar();

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith({
        filtros: { temas: [1], dificultad: Dificultad.BASICO },
        formato: 'excel',
      });
    });

    it('omits temas when empty array', () => {
      const emitSpy = jest.spyOn(component.exportar, 'emit');

      component.temasControl.setValue([]);
      component.dificultadControl.setValue(Dificultad.INTERMEDIO);
      component.selectedFormato.set('word');

      component.onExportar();

      const payload = emitSpy.mock.calls[0][0] as ExportDialogEvent;
      expect(payload.filtros.temas).toBeUndefined();
      expect(payload.filtros.dificultad).toBe(Dificultad.INTERMEDIO);
      expect(payload.formato).toBe('word');
    });

    it('omits dificultad when null', () => {
      const emitSpy = jest.spyOn(component.exportar, 'emit');

      component.temasControl.setValue([5, 10]);
      component.dificultadControl.setValue(null);
      component.selectedFormato.set('excel');

      component.onExportar();

      const payload = emitSpy.mock.calls[0][0] as ExportDialogEvent;
      expect(payload.filtros.temas).toEqual([5, 10]);
      expect(payload.filtros.dificultad).toBeUndefined();
      expect(payload.formato).toBe('excel');
    });

    it('emits empty filtros object when both temas and dificultad are unset', () => {
      const emitSpy = jest.spyOn(component.exportar, 'emit');

      component.temasControl.setValue([]);
      component.dificultadControl.setValue(null);
      component.selectedFormato.set('word');

      component.onExportar();

      expect(emitSpy).toHaveBeenCalledWith({ filtros: {}, formato: 'word' });
    });
  });

  describe('onCerrar', () => {
    it('emits cerrar event', () => {
      const emitSpy = jest.spyOn(component.cerrar, 'emit');

      component.onCerrar();

      expect(emitSpy).toHaveBeenCalledTimes(1);
    });

    it('resets temasControl, dificultadControl and selectedFormato to defaults', () => {
      component.temasControl.setValue([1, 2]);
      component.dificultadControl.setValue(Dificultad.DIFICIL);
      component.selectedFormato.set('word');

      component.onCerrar();

      expect(component.temasControl.value).toEqual([]);
      expect(component.dificultadControl.value).toBeNull();
      expect(component.selectedFormato()).toBe('excel');
    });
  });
});
