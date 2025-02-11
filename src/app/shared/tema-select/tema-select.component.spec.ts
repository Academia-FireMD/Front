import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemaSelectComponent } from './tema-select.component';

describe('TemaSelectComponent', () => {
  let component: TemaSelectComponent;
  let fixture: ComponentFixture<TemaSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemaSelectComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemaSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
