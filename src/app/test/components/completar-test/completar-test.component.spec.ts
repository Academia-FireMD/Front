import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompletarTestComponent } from './completar-test.component';

describe('CompletarTestComponent', () => {
  let component: CompletarTestComponent;
  let fixture: ComponentFixture<CompletarTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompletarTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompletarTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
