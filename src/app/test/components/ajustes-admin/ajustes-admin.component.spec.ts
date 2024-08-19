import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AjustesAdminComponent } from './ajustes-admin.component';

describe('AjustesAdminComponent', () => {
  let component: AjustesAdminComponent;
  let fixture: ComponentFixture<AjustesAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AjustesAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AjustesAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
