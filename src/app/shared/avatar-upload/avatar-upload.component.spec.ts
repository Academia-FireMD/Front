import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Subject } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { UserService } from '../../services/user.service';

import { AvatarUploadComponent } from './avatar-upload.component';

describe('AvatarUploadComponent', () => {
  let component: AvatarUploadComponent;
  let fixture: ComponentFixture<AvatarUploadComponent>;
  let upload: Subject<{ avatarUrl: string }>;
  let uploadAvatar: jest.Mock;

  beforeEach(async () => {
    upload = new Subject();
    uploadAvatar = jest.fn().mockReturnValue(upload);
    await TestBed.configureTestingModule({
      declarations: [AvatarUploadComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: UserService, useValue: { uploadAvatar$: uploadAvatar } },
        { provide: ToastrService, useValue: { success: jest.fn() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarUploadComponent);
    component = fixture.componentInstance;
  });

  it('permite abrir el selector desde un botón con nombre accesible', () => {
    component.variant = 'profile';
    component.initials = 'LS';
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    const click = jest.spyOn(input, 'click');
    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Cambiar foto de perfil');
    expect(button.textContent).toContain('LS');
    button.click();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('conserva el control compacto con cámara fuera del Perfil', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.querySelector('.pi-camera')).toBeTruthy();
    expect(button.classList.contains('avatar-profile')).toBe(false);
  });

  it('bloquea otra selección mientras sube y muestra la foto devuelta', async () => {
    component.variant = 'profile';
    const file = new File(['qa'], 'perfil.png', { type: 'image/png' });
    const pending = component.onFileSelected({
      target: { files: [file] },
    } as unknown as Event);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(true);
    expect(uploadAvatar.mock.calls[0][0].get('file')).toBe(file);

    upload.next({ avatarUrl: '/nueva-foto.png' });
    await pending;
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      '/nueva-foto.png',
    );
  });

  it('permite reintentar un fallo y conserva la foto anterior', async () => {
    component.avatarUrl = '/foto-anterior.png';
    const file = new File(['qa'], 'perfil.png', { type: 'image/png' });
    const pending = component.onFileSelected({
      target: { files: [file] },
    } as unknown as Event);
    upload.error(new Error('Sin conexión'));
    await pending;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(
      '/foto-anterior.png',
    );
  });
});
