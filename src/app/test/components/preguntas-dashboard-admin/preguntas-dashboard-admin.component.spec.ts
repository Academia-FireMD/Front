import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { PreguntasDashboardAdminComponent } from './preguntas-dashboard-admin.component';

describe('PreguntasDashboardAdminComponent', () => {
  let component: PreguntasDashboardAdminComponent;
  let fixture: ComponentFixture<PreguntasDashboardAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PreguntasDashboardAdminComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreguntasDashboardAdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
