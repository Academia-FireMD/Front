import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamenesDashboardAdminDetailviewComponent } from './examenes-dashboard-admin-detailview.component';

describe('ExamenesDashboardAdminDetailviewComponent', () => {
  let component: ExamenesDashboardAdminDetailviewComponent;
  let fixture: ComponentFixture<ExamenesDashboardAdminDetailviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ExamenesDashboardAdminDetailviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExamenesDashboardAdminDetailviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
