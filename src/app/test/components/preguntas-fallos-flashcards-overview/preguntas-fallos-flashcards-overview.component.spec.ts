import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreguntasFallosFlashcardsOverviewComponent } from './preguntas-fallos-flashcards-overview.component';

describe('PreguntasFallosFlashcardsOverviewComponent', () => {
  let component: PreguntasFallosFlashcardsOverviewComponent;
  let fixture: ComponentFixture<PreguntasFallosFlashcardsOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasFallosFlashcardsOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasFallosFlashcardsOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
