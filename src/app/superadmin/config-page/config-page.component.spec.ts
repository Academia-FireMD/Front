import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { AppConfigService } from '../../services/app-config.service';
import { AppConfig, EstadoModulos } from '../../shared/models/app-config.model';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { ConfigPageComponent } from './config-page.component';

function makeMockAppConfigService() {
  const config = signal<AppConfig>({
    appName: 'Acme',
    logoUrl: null,
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
    updatedAt: '2026-05-21T10:00:00Z',
  });
  const estado = signal<EstadoModulos>({
    [ModuloApp.PLANIFICACION]: true,
    [ModuloApp.SIMULACROS]: true,
    [ModuloApp.HORARIOS]: true,
    [ModuloApp.DOCUMENTACION]: true,
    [ModuloApp.CURSOS]: true,
    [ModuloApp.EXAMEN]: true,
    [ModuloApp.TEST]: true,
    [ModuloApp.FLASHCARDS]: true,
    [ModuloApp.FACTURACION]: true,
  });

  const updateConfig: jest.Mock<Promise<any>, any[]> = jest.fn(async () => ({
    ok: true,
    config: config(),
  }));
  const toggleModulo = jest.fn(async () => true);
  const uploadLogo = jest.fn(async () => 'https://cdn/logo.png');
  const deleteLogo = jest.fn(async () => true);

  return {
    appConfig: config,
    estadoModulos: estado,
    updateConfig,
    toggleModulo,
    uploadLogo,
    deleteLogo,
    // mutators usados por el test
    _setConfig: config.set.bind(config),
  };
}

describe('ConfigPageComponent', () => {
  let fixture: ComponentFixture<ConfigPageComponent>;
  let component: ConfigPageComponent;
  let appConfigService: ReturnType<typeof makeMockAppConfigService>;
  let toast: { success: jest.Mock; error: jest.Mock; warning: jest.Mock };
  let confirmation: ConfirmationService;

  beforeEach(async () => {
    appConfigService = makeMockAppConfigService();
    toast = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
    };
    // Usamos la ConfirmationService real, pero spy en confirm() para forzar
    // accept() inmediato. Esto evita tener que mockear los Subjects internos
    // de PrimeNG.
    const realService = new ConfirmationService();
    jest
      .spyOn(realService, 'confirm')
      .mockImplementation(({ accept }: any) => {
        if (accept) accept();
        return realService;
      });
    confirmation = realService as any;
    await TestBed.configureTestingModule({
      imports: [ConfigPageComponent, HttpClientTestingModule],
      providers: [
        { provide: AppConfigService, useValue: appConfigService },
        { provide: ToastrService, useValue: toast },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(ConfigPageComponent, {
        set: {
          providers: [
            { provide: ConfirmationService, useValue: confirmation },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ConfigPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renderiza 3 secciones (branding, logo, modulos)', () => {
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="section-branding"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="section-logo"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="section-modulos"]')).toBeTruthy();
  });

  it('saveBranding llama appConfigService.updateConfig', async () => {
    component.brandingForm.setValue({
      appName: 'Otro',
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });
    await component.onSaveBranding();
    expect(appConfigService.updateConfig).toHaveBeenCalledWith(
      { appName: 'Otro', primaryColor: '#112233', secondaryColor: '#445566' },
      '2026-05-21T10:00:00Z',
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('toggleModulo llama appConfigService.toggleModulo', async () => {
    await component.onToggleModulo(ModuloApp.SIMULACROS, false);
    expect(appConfigService.toggleModulo).toHaveBeenCalledWith(
      ModuloApp.SIMULACROS,
      false,
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('uploadLogo llama appConfigService.uploadLogo cuando hay archivo pendiente', async () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    component.onLogoSelected({ files: [file] });
    // emular preview ya cargado para habilitar el botón
    (component as any).logoPreview.set('data:image/png;base64,xxx');
    await component.onUploadLogo();
    expect(appConfigService.uploadLogo).toHaveBeenCalledWith(file);
  });

  it('hex inválido bloquea save', async () => {
    component.brandingForm.setValue({
      appName: 'Otro',
      primaryColor: 'INVALID',
      secondaryColor: '#445566',
    });
    await component.onSaveBranding();
    expect(appConfigService.updateConfig).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('409 STALE_CONFIG dispara warning y refilea el form', async () => {
    appConfigService.updateConfig.mockResolvedValueOnce({
      ok: false,
      code: 'STALE_CONFIG' as const,
      message: 'stale',
    });
    // simular que tras reload el signal se actualizó
    appConfigService._setConfig({
      appName: 'Refreshed',
      logoUrl: null,
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
      updatedAt: '2026-05-21T11:00:00Z',
    });
    component.brandingForm.setValue({
      appName: 'Otro',
      primaryColor: '#112233',
      secondaryColor: '#445566',
    });
    await component.onSaveBranding();
    expect(toast.warning).toHaveBeenCalled();
    expect(component.brandingForm.value.appName).toBe('Refreshed');
  });
});
