import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComunidadPickerComponent } from './comunidad-picker.component';

describe('ComunidadPickerComponent', () => {
  let component: ComunidadPickerComponent;
  let fixture: ComponentFixture<ComunidadPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ComunidadPickerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComunidadPickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
