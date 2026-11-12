import { TestBed } from '@angular/core/testing';
import { Oposicion } from '../models/subscription.model';
import { OposicionIdentidadComponent } from './oposicion-identidad.component';

describe('identidad visual de oposición', () => {
  it('muestra las oposiciones del contenido sin duplicar un escudo', () => {
    const fixture = TestBed.createComponent(OposicionIdentidadComponent);
    fixture.componentInstance.oposiciones = [
      Oposicion.MADRID,
      Oposicion.MADRID,
      Oposicion.ALICANTE_CPBA,
    ];
    fixture.detectChanges();
    const images: HTMLImageElement[] = [
      ...fixture.nativeElement.querySelectorAll('img'),
    ];
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      'oposiciones/madrid.png',
      'oposiciones/alicante.png',
    ]);
    expect(images[0].alt).toBe('Madrid');
  });
  it('sustituye un recurso fallido por un icono sin reintentar la imagen rota', () => {
    const fixture = TestBed.createComponent(OposicionIdentidadComponent);
    fixture.componentInstance.oposiciones = [Oposicion.VALENCIA_AYUNTAMIENTO];
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('img')
      .dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.pi-calendar')).toBeTruthy();
  });
  it('ofrece un icono genérico cuando el plan no declara relevancia', () => {
    const fixture = TestBed.createComponent(OposicionIdentidadComponent);
    fixture.componentInstance.oposiciones = undefined;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.pi-calendar')).toBeTruthy();
  });
});
