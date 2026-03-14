import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { VistaSemanalComponent } from './vista-semanal.component';

describe('VistaSemanalComponent', () => {
  let component: VistaSemanalComponent;
  let fixture: ComponentFixture<VistaSemanalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VistaSemanalComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(VistaSemanalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
