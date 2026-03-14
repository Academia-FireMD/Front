import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { ExamenesDashboardAdminDetailviewComponent } from './examenes-dashboard-admin-detailview.component';

describe('ExamenesDashboardAdminDetailviewComponent', () => {
  let component: ExamenesDashboardAdminDetailviewComponent;
  let fixture: ComponentFixture<ExamenesDashboardAdminDetailviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamenesDashboardAdminDetailviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesDashboardAdminDetailviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
