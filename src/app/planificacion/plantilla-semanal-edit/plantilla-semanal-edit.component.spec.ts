import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit.component';

describe('PlantillaSemanalEditComponent', () => {
  let component: PlantillaSemanalEditComponent;
  let fixture: ComponentFixture<PlantillaSemanalEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlantillaSemanalEditComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlantillaSemanalEditComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
