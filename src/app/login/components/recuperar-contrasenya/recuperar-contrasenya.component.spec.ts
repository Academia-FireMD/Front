import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../../testing';


import { RecuperarContrasenyaComponent } from './recuperar-contrasenya.component';

describe('RecuperarContrasenyaComponent', () => {
  let component: RecuperarContrasenyaComponent;
  let fixture: ComponentFixture<RecuperarContrasenyaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RecuperarContrasenyaComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecuperarContrasenyaComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
