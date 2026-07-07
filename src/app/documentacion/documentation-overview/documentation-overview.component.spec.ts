import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { DocumentationOverviewComponent } from './documentation-overview.component';

describe('DocumentationOverviewComponent', () => {
  let component: DocumentationOverviewComponent;
  let fixture: ComponentFixture<DocumentationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocumentationOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentationOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el identificador ya NO es obligatorio en el formulario de subida (se autogenera)', () => {
    const control = component.uploadingFileFormGroup.controls['identificador'];
    control.setValue('');
    control.updateValueAndValidity();
    expect(control.valid).toBe(true);
  });

  it('publicarDocumento llama al servicio, marca isPublicado y refresca', async () => {
    const doc: any = { id: 42, identificador: 'DM5.001', isPublicado: false };
    // El DocumentosService de COMMON_TEST_PROVIDERS es un Proxy que devuelve un
    // jest.fn nuevo por acceso, así que inyectamos un fake concreto espiable.
    const publicarSpy = jest
      .fn()
      .mockReturnValue(of({ id: 42, isPublicado: true }));
    (component as any).service = { publicarDocumento$: publicarSpy };
    const refreshSpy = jest
      .spyOn(component as any, 'refresh')
      .mockImplementation(() => {});
    jest
      .spyOn((component as any).toast, 'success')
      .mockImplementation(() => {});

    await component.publicarDocumento(doc);

    expect(publicarSpy).toHaveBeenCalledWith(42);
    expect(doc.isPublicado).toBe(true);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('confirmarPublicacion abre el diálogo de confirmación', () => {
    const doc: any = { id: 7, identificador: 'DM5.007', isPublicado: false };
    const confirmSpy = jest
      .spyOn(component.confirmationService, 'confirm')
      .mockImplementation(() => component.confirmationService);

    component.confirmarPublicacion(doc);

    expect(confirmSpy).toHaveBeenCalled();
    expect(confirmSpy.mock.calls[0][0].header).toBe('Confirmar publicación');
  });
});
