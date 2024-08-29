import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreguntasFallosOverviewComponent } from './preguntas-fallos-overview.component';

describe('PreguntasFallosOverviewComponent', () => {
  let component: PreguntasFallosOverviewComponent;
  let fixture: ComponentFixture<PreguntasFallosOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasFallosOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasFallosOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
