import { SecurityContext } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { CallejeroProgresoAdapterService } from '../services/callejero-progreso-adapter.service';
import { ProgresoSyncMensaje } from '../services/callejero-progreso.service';
import { CallejeroAlicanteComponent } from './callejero-alicante.component';

describe('CallejeroAlicanteComponent', () => {
  let fixture: ComponentFixture<CallejeroAlicanteComponent>;
  let component: CallejeroAlicanteComponent;
  let conectarProgreso: jest.Mock;
  let controlProgreso: { reintentar: jest.Mock; destruir: jest.Mock };

  beforeEach(async () => {
    controlProgreso = { reintentar: jest.fn(), destruir: jest.fn() };
    conectarProgreso = jest.fn().mockReturnValue(controlProgreso);
    await TestBed.configureTestingModule({
      imports: [CallejeroAlicanteComponent],
      providers: [
        {
          provide: CallejeroProgresoAdapterService,
          useValue: { connect: conectarProgreso },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CallejeroAlicanteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('apunta al HTML autónomo de Alicante', () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    const iframe: HTMLIFrameElement = fixture.nativeElement.querySelector(
      '[data-testid=callejero-alicante-iframe]',
    );
    expect(
      sanitizer.sanitize(SecurityContext.RESOURCE_URL, component.src),
    ).toBe('/callejero-embed/alicante_16.html?v=17&progreso=1');
    expect(iframe.getAttribute('src')).toBe(
      '/callejero-embed/alicante_16.html?v=17&progreso=1',
    );
    expect(iframe.title).toBe('Callejero Alicante');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(iframe.hasAttribute('allow')).toBe(false);
  });

  it('conecta progreso Alicante y publica el estado en una región accesible', () => {
    expect(conectarProgreso).toHaveBeenCalledWith(
      fixture.nativeElement.querySelector('iframe'),
      'alicante',
      expect.any(Function),
    );
    const publicar = conectarProgreso.mock.calls[0][2] as (
      estado: ProgresoSyncMensaje,
    ) => void;
    publicar({ estado: 'guardado', texto: 'Guardado en tu cuenta.' });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[role="status"]')?.textContent,
    ).toContain('Guardado en tu cuenta.');
  });

  it('no incorpora el puente de credenciales ni un panel de perfil', () => {
    expect('responderAuth' in component).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-testid="perfil"]'),
    ).toBeNull();
  });

  it('destruye el bridge al abandonar la ruta', () => {
    fixture.destroy();
    expect(controlProgreso.destruir).toHaveBeenCalledTimes(1);
  });
});
