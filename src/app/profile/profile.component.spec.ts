import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../testing';
import { AuthService } from '../services/auth.service';

import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let mockAuthService: { getWpSsoUrl$: jest.Mock };

  beforeEach(async () => {
    mockAuthService = {
      getWpSsoUrl$: jest
        .fn()
        .mockReturnValue(
          of({
            url: 'https://staging2.tecnikafire.com/wp-json/tecnika/v1/sso?token=tok.en.sig',
          }),
        ),
    };

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        // Override AuthService con mock que tiene getWpSsoUrl$
        { provide: AuthService, useValue: mockAuthService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('menú de suscripción (WP-linked) incluye "Cambiar tarjeta de pago"', () => {
    component.user = { woocommerceCustomerId: 53 } as any;
    const items = component.getSubscriptionMenuItems({
      status: 'ACTIVE',
    } as any);
    expect(items.map((i: any) => i.label)).toContain('Cambiar tarjeta de pago');
  });

  it('alumno "en negro" (no WP-linked) NO ve "Cambiar tarjeta de pago"', () => {
    component.user = { woocommerceCustomerId: null } as any;
    const items = component.getSubscriptionMenuItems({
      status: 'ACTIVE',
    } as any);
    expect(items.map((i: any) => i.label)).not.toContain(
      'Cambiar tarjeta de pago',
    );
  });

  describe('abrirCambioTarjeta — SSO con magic-link', () => {
    it('cuando el backend devuelve la URL SSO, la usa para navegar (no el fallback)', async () => {
      const ssoUrl =
        'https://staging2.tecnikafire.com/wp-json/tecnika/v1/sso?token=tok.en.sig';
      mockAuthService.getWpSsoUrl$.mockReturnValue(of({ url: ssoUrl }));

      // Ventana simulada que acepta location.href
      const mockWindow = { closed: false, location: { href: '' } } as any;
      const openSpy = jest
        .spyOn(window, 'open')
        .mockReturnValueOnce(mockWindow); // primera apertura (vacía, síncrona)

      await component.abrirCambioTarjeta();

      // La ventana vacía fue abierta de forma síncrona
      expect(openSpy).toHaveBeenCalledWith('', '_blank', 'noopener');
      // Su location.href fue actualizado a la URL SSO
      expect(mockWindow.location.href).toBe(ssoUrl);
      // NO se abrió una segunda ventana con la URL de fallback
      expect(openSpy).toHaveBeenCalledTimes(1);

      openSpy.mockRestore();
    });

    it('cuando el backend falla, usa la URL plana de WP como fallback', async () => {
      mockAuthService.getWpSsoUrl$.mockReturnValue(
        throwError(() => new Error('500 Server Error')),
      );

      const mockWindow = { closed: false, location: { href: '' } } as any;
      const openSpy = jest
        .spyOn(window, 'open')
        .mockReturnValueOnce(mockWindow);

      // wordpressUrl del environment de test
      (component as any).wordpressUrl = 'https://staging2.tecnikafire.com';

      await component.abrirCambioTarjeta();

      expect(mockWindow.location.href).toContain('/mi-cuenta/subscriptions/');
      openSpy.mockRestore();
    });

    it('cuando la ventana fue bloqueada (null), abre la URL SSO con window.open', async () => {
      const ssoUrl =
        'https://staging2.tecnikafire.com/wp-json/tecnika/v1/sso?token=tok.en.sig';
      mockAuthService.getWpSsoUrl$.mockReturnValue(of({ url: ssoUrl }));

      const openSpy = jest
        .spyOn(window, 'open')
        .mockReturnValueOnce(null as any) // ventana bloqueada por el navegador
        .mockReturnValueOnce({} as any); // segunda apertura con la URL resuelta

      await component.abrirCambioTarjeta();

      // Segunda apertura fue con la URL SSO real
      expect(openSpy).toHaveBeenNthCalledWith(2, ssoUrl, '_blank', 'noopener');

      openSpy.mockRestore();
    });

    it('cuando ventana bloqueada y backend falla, abre el fallback con window.open', async () => {
      mockAuthService.getWpSsoUrl$.mockReturnValue(
        throwError(() => new Error('error')),
      );

      const openSpy = jest
        .spyOn(window, 'open')
        .mockReturnValueOnce(null as any)
        .mockReturnValueOnce({} as any);

      (component as any).wordpressUrl = 'https://staging2.tecnikafire.com';

      await component.abrirCambioTarjeta();

      expect(openSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/mi-cuenta/subscriptions/'),
        '_blank',
        'noopener',
      );

      openSpy.mockRestore();
    });
  });
});
