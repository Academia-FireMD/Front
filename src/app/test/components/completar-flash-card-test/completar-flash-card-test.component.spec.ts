import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompletarFlashCardTestComponent } from './completar-flash-card-test.component';

describe('CompletarFlashCardTestComponent', () => {
  let component: CompletarFlashCardTestComponent;
  let fixture: ComponentFixture<CompletarFlashCardTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompletarFlashCardTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompletarFlashCardTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
