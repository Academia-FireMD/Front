import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DificultadDropdownComponent } from './dificultad-dropdown.component';

describe('DificultadDropdownComponent', () => {
  let component: DificultadDropdownComponent;
  let fixture: ComponentFixture<DificultadDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DificultadDropdownComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DificultadDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
