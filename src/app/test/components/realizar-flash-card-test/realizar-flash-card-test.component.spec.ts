import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RealizarFlashCardTestComponent } from './realizar-flash-card-test.component';

describe('RealizarFlashCardTestComponent', () => {
  let component: RealizarFlashCardTestComponent;
  let fixture: ComponentFixture<RealizarFlashCardTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RealizarFlashCardTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RealizarFlashCardTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
