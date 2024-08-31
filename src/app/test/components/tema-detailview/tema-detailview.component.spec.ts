import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemaDetailviewComponent } from './tema-detailview.component';

describe('TemaDetailviewComponent', () => {
  let component: TemaDetailviewComponent;
  let fixture: ComponentFixture<TemaDetailviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemaDetailviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemaDetailviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
