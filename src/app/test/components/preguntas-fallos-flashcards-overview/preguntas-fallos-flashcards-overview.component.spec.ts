import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { PreguntasFallosFlashcardsOverviewComponent } from './preguntas-fallos-flashcards-overview.component';

describe('PreguntasFallosFlashcardsOverviewComponent', () => {
  let component: PreguntasFallosFlashcardsOverviewComponent;
  let fixture: ComponentFixture<PreguntasFallosFlashcardsOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasFallosFlashcardsOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasFallosFlashcardsOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
