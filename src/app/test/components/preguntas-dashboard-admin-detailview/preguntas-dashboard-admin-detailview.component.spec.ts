import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreguntasDashboardAdminDetailviewComponent } from './preguntas-dashboard-admin-detailview.component';

describe('PreguntasDashboardAdminDetailviewComponent', () => {
  let component: PreguntasDashboardAdminDetailviewComponent;
  let fixture: ComponentFixture<PreguntasDashboardAdminDetailviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasDashboardAdminDetailviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasDashboardAdminDetailviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
