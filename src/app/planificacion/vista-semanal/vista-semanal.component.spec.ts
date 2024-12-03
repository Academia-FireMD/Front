import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VistaSemanalComponent } from './vista-semanal.component';

describe('VistaSemanalComponent', () => {
  let component: VistaSemanalComponent;
  let fixture: ComponentFixture<VistaSemanalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VistaSemanalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VistaSemanalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
