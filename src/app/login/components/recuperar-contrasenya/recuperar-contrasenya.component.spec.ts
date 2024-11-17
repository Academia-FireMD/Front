import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecuperarContrasenyaComponent } from './recuperar-contrasenya.component';

describe('RecuperarContrasenyaComponent', () => {
  let component: RecuperarContrasenyaComponent;
  let fixture: ComponentFixture<RecuperarContrasenyaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RecuperarContrasenyaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecuperarContrasenyaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
