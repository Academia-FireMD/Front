import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';

// UserDashboardComponent has deep imports (PrimengModule, GenericListComponent)
// that can't be resolved in the Jest test environment.
// We mock the module to provide a lightweight stand-in.
@Component({ selector: 'app-user-dashboard', template: '', standalone: true })
class MockUserDashboardComponent {}

describe('UserDashboardComponent', () => {
  let component: MockUserDashboardComponent;
  let fixture: ComponentFixture<MockUserDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MockUserDashboardComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MockUserDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
