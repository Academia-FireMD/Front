import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog.component';

describe('EditarSubBloqueDialogComponent', () => {
  let component: EditarSubBloqueDialogComponent;
  let fixture: ComponentFixture<EditarSubBloqueDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditarSubBloqueDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditarSubBloqueDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
