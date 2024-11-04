import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit.component';

describe('PlantillaSemanalEditComponent', () => {
  let component: PlantillaSemanalEditComponent;
  let fixture: ComponentFixture<PlantillaSemanalEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlantillaSemanalEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlantillaSemanalEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
