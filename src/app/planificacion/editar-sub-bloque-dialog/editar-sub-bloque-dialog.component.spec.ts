import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog.component';

describe('EditarSubBloqueDialogComponent', () => {
  let component: EditarSubBloqueDialogComponent;
  let fixture: ComponentFixture<EditarSubBloqueDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditarSubBloqueDialogComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditarSubBloqueDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
