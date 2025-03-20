import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamenesDashboardAdminComponent } from './examenes-dashboard-admin.component';

describe('ExamenesDashboardAdminComponent', () => {
  let component: ExamenesDashboardAdminComponent;
  let fixture: ComponentFixture<ExamenesDashboardAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamenesDashboardAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesDashboardAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
