import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlashcardDetailviewAdminComponent } from './flashcard-detailview-admin.component';

describe('FlashcardDetailviewAdminComponent', () => {
  let component: FlashcardDetailviewAdminComponent;
  let fixture: ComponentFixture<FlashcardDetailviewAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FlashcardDetailviewAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlashcardDetailviewAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
