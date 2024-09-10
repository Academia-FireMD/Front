import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlashcardOverviewAdminComponent } from './flashcard-overview-admin.component';

describe('FlashcardOverviewAdminComponent', () => {
  let component: FlashcardOverviewAdminComponent;
  let fixture: ComponentFixture<FlashcardOverviewAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FlashcardOverviewAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlashcardOverviewAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
