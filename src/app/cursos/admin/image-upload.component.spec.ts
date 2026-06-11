import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import { CursosAdminService } from '../services/cursos-admin.service';
import { ImageUploadComponent } from './image-upload.component';

describe('ImageUploadComponent', () => {
  let fixture: ComponentFixture<ImageUploadComponent>;
  let component: ImageUploadComponent;
  let service: { uploadImage: jest.Mock };
  let toast: { success: jest.Mock; error: jest.Mock; warning: jest.Mock };

  beforeEach(async () => {
    service = { uploadImage: jest.fn() };
    toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [ImageUploadComponent],
      providers: [
        { provide: CursosAdminService, useValue: service },
        { provide: ToastrService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImageUploadComponent);
    component = fixture.componentInstance;
  });

  function fileEvent(name = 'x.png', type = 'image/png'): Event {
    const file = new File(['data'], name, { type });
    return { target: { files: [file], value: '' } } as unknown as Event;
  }

  it('sin imagen muestra el placeholder', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin imagen');
  });

  it('subir una imagen llama al servicio y actualiza imageUrl', async () => {
    service.uploadImage.mockReturnValue(of({ url: 'https://x/img.png' }));
    fixture.detectChanges();
    await component.onFileSelected(fileEvent());
    expect(service.uploadImage).toHaveBeenCalled();
    expect(component.imageUrl()).toBe('https://x/img.png');
    expect(toast.success).toHaveBeenCalled();
  });

  it('rechaza archivos que no son imagen', async () => {
    fixture.detectChanges();
    await component.onFileSelected(fileEvent('doc.pdf', 'application/pdf'));
    expect(service.uploadImage).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
  });

  it('error de subida muestra toast de error', async () => {
    service.uploadImage.mockReturnValue(throwError(() => new Error('boom')));
    fixture.detectChanges();
    await component.onFileSelected(fileEvent());
    expect(toast.error).toHaveBeenCalled();
    expect(component.imageUrl()).toBeNull();
  });

  it('quitar limpia la URL', () => {
    fixture.componentRef.setInput('imageUrl', 'https://x/img.png');
    fixture.detectChanges();
    component.quitar();
    expect(component.imageUrl()).toBeNull();
  });
});
