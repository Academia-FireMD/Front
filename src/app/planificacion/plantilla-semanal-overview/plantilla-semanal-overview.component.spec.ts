import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlantillaSemanalOverviewComponent } from './plantilla-semanal-overview.component';

describe('PlantillaSemanalOverviewComponent', () => {
  let component: PlantillaSemanalOverviewComponent;
  let fixture: ComponentFixture<PlantillaSemanalOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlantillaSemanalOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlantillaSemanalOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
