import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { PreguntasFallosOverviewComponent } from './preguntas-fallos-overview.component';

describe('PreguntasFallosOverviewComponent', () => {
  let component: PreguntasFallosOverviewComponent;
  let fixture: ComponentFixture<PreguntasFallosOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasFallosOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasFallosOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
