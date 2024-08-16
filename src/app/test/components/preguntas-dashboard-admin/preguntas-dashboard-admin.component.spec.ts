import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreguntasDashboardAdminComponent } from './preguntas-dashboard-admin.component';

describe('PreguntasDashboardAdminComponent', () => {
  let component: PreguntasDashboardAdminComponent;
  let fixture: ComponentFixture<PreguntasDashboardAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasDashboardAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasDashboardAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
