import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { ExamenesDashboardAdminComponent } from './examenes-dashboard-admin.component';

describe('ExamenesDashboardAdminComponent', () => {
  let component: ExamenesDashboardAdminComponent;
  let fixture: ComponentFixture<ExamenesDashboardAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamenesDashboardAdminComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesDashboardAdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
