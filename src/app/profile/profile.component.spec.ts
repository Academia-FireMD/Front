import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { COMMON_TEST_PROVIDERS } from '../testing';

import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      providers: [...COMMON_TEST_PROVIDERS],
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

  it('abrirCambioTarjeta abre "Mi cuenta → Suscripciones" de WP en nueva pestaña', () => {
    const spy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => null as any);
    component.abrirCambioTarjeta();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/mi-cuenta/subscriptions/'),
      '_blank',
      'noopener',
    );
    spy.mockRestore();
  });
});
