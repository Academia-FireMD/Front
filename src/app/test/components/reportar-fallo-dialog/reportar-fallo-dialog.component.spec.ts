import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportarFalloDialogComponent } from './reportar-fallo-dialog.component';

describe('ReportarFalloDialogComponent', () => {
  let component: ReportarFalloDialogComponent;
  let fixture: ComponentFixture<ReportarFalloDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ReportarFalloDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportarFalloDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
