import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { FlashcardOverviewAdminComponent } from './flashcard-overview-admin.component';

describe('FlashcardOverviewAdminComponent', () => {
  let component: FlashcardOverviewAdminComponent;
  let fixture: ComponentFixture<FlashcardOverviewAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FlashcardOverviewAdminComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlashcardOverviewAdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
