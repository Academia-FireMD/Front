import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { PreguntasDashboardAdminDetailviewComponent } from './preguntas-dashboard-admin-detailview.component';

describe('PreguntasDashboardAdminDetailviewComponent', () => {
  let component: PreguntasDashboardAdminDetailviewComponent;
  let fixture: ComponentFixture<PreguntasDashboardAdminDetailviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasDashboardAdminDetailviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasDashboardAdminDetailviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
