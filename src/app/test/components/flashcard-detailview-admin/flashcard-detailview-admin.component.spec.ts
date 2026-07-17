import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { COMMON_TEST_PROVIDERS } from '../../../testing';

import { FlashcardDetailviewAdminComponent } from './flashcard-detailview-admin.component';

describe('FlashcardDetailviewAdminComponent', () => {
  let component: FlashcardDetailviewAdminComponent;
  let fixture: ComponentFixture<FlashcardDetailviewAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FlashcardDetailviewAdminComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(FlashcardDetailviewAdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Regresion: el checkbox "Crear otra" quedaba con una zona pulsable de 20x20,
  // imposible de marcar con el dedo (reportado por Raul, 2026-07-16). La clase
  // .checkbox-touch es la que la lleva a 44x44; si alguien la quita, el bug vuelve.
  it('envuelve el checkbox "Crear otra" en .checkbox-touch junto a su label', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot.paramMap.get as jest.Mock).mockReturnValue('new');
    component.mode = 'edit';
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.checkbox-touch');
    expect(wrapper).toBeTruthy();
    expect(wrapper.querySelector('p-checkbox')).toBeTruthy();
    expect(wrapper.querySelector('label[for="crearOtra"]')).toBeTruthy();
  });
});
