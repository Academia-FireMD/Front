import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { PlantillaSemanalOverviewComponent } from './plantilla-semanal-overview.component';

describe('PlantillaSemanalOverviewComponent', () => {
  let component: PlantillaSemanalOverviewComponent;
  let fixture: ComponentFixture<PlantillaSemanalOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PlantillaSemanalOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlantillaSemanalOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
