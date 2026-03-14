import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../../testing';


import { AvatarUploadComponent } from './avatar-upload.component';

describe('AvatarUploadComponent', () => {
  let component: AvatarUploadComponent;
  let fixture: ComponentFixture<AvatarUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AvatarUploadComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AvatarUploadComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
