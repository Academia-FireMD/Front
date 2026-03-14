import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { AjustesAdminComponent } from './ajustes-admin.component';

describe('AjustesAdminComponent', () => {
  let component: AjustesAdminComponent;
  let fixture: ComponentFixture<AjustesAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AjustesAdminComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AjustesAdminComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
