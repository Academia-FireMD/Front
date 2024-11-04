import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BloquesEditComponent } from './bloques-edit.component';

describe('BloquesEditComponent', () => {
  let component: BloquesEditComponent;
  let fixture: ComponentFixture<BloquesEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BloquesEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BloquesEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
