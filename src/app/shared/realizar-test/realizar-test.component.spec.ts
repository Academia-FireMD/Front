import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { RealizarTestComponent } from './realizar-test.component';

describe('RealizarTestComponent', () => {
  let component: RealizarTestComponent;
  let fixture: ComponentFixture<RealizarTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarTestComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(RealizarTestComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('exclusividad de switches (desafío)', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('activar desafío apaga examen y repaso', () => {
      component.formGroup.get('generarTestDeExamen')?.setValue(true);
      component.formGroup.get('generarTestDeRepaso')?.setValue(true);

      component.formGroup.get('generarTestDesafio')?.setValue(true);

      expect(component.formGroup.get('generarTestDeExamen')?.value).toBe(false);
      expect(component.formGroup.get('generarTestDeRepaso')?.value).toBe(false);
      expect(component.formGroup.get('generarTestDesafio')?.value).toBe(true);
    });

    it('activar examen apaga desafío', () => {
      component.formGroup.get('generarTestDesafio')?.setValue(true);

      component.formGroup.get('generarTestDeExamen')?.setValue(true);

      expect(component.formGroup.get('generarTestDesafio')?.value).toBe(false);
      expect(component.formGroup.get('generarTestDeExamen')?.value).toBe(true);
    });

    it('activar repaso apaga desafío', () => {
      component.formGroup.get('generarTestDesafio')?.setValue(true);

      component.formGroup.get('generarTestDeRepaso')?.setValue(true);

      expect(component.formGroup.get('generarTestDesafio')?.value).toBe(false);
      expect(component.formGroup.get('generarTestDeRepaso')?.value).toBe(true);
    });

    it('activar desafío abre el popup explicativo', () => {
      component.formGroup.get('generarTestDesafio')?.setValue(true);
      expect(component.displayPopupDesafio).toBe(true);
    });
  });
});
