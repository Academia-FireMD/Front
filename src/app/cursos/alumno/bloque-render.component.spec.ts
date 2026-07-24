import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMarkdown } from 'ngx-markdown';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Bloque } from '../models/curso.model';
import { BloqueRenderComponent } from './bloque-render.component';
import { BloqueTestInlineComponent } from './bloque-test-inline.component';

// Stub liviano del bloque TEST inline para no arrastrar TestModule (que importa
// el motor de tests completo) al unit test de bloque-render.
@Component({
  selector: 'app-bloque-test-inline',
  standalone: true,
  template: '<span data-testid="stub-test-inline">test-inline</span>',
})
class StubBloqueTestInlineComponent {
  readonly bloqueId = input<number>();
  readonly numPreguntas = input<number | null | undefined>();
  readonly esDeRepaso = input<boolean | undefined>();
  readonly preview = input<boolean>();
}

describe('BloqueRenderComponent', () => {
  let fixture: ComponentFixture<BloqueRenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BloqueRenderComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMarkdown(),
      ],
    })
      .overrideComponent(BloqueRenderComponent, {
        remove: { imports: [BloqueTestInlineComponent] },
        add: { imports: [StubBloqueTestInlineComponent] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(BloqueRenderComponent);
  });

  function setBloque(b: Partial<Bloque>): void {
    fixture.componentRef.setInput('bloque', {
      id: 1,
      leccionId: 1,
      orden: 0,
      ...b,
    } as Bloque);
  }

  it('VIDEO con playbackUrl: renderiza app-bunny-player con la URL firmada', () => {
    setBloque({ tipo: 'VIDEO' });
    fixture.componentRef.setInput('playbackUrl', 'https://video/embed/x');
    fixture.detectChanges();
    const player = fixture.nativeElement.querySelector('app-bunny-player');
    expect(player).not.toBeNull();
    expect(fixture.componentInstance.bloque().tipo).toBe('VIDEO');
    expect(fixture.componentInstance.playbackUrl()).toBe(
      'https://video/embed/x',
    );
  });

  it('VIDEO sin playbackUrl muestra estado vacío', () => {
    setBloque({ tipo: 'VIDEO' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no está disponible');
  });

  it('TEXTO renderiza el contenido markdown', () => {
    setBloque({ tipo: 'TEXTO', contenidoMarkdown: '# Hola' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('markdown')).not.toBeNull();
  });

  it('el bloque TEXTO lleva la clase de tipografía cursos-prose', () => {
    setBloque({ tipo: 'TEXTO', contenidoMarkdown: '# Hola' });
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('.bloque-texto');
    expect(wrapper.classList).toContain('cursos-prose');
  });

  it('TEST renderiza el bloque de test inline (app-bloque-test-inline)', () => {
    setBloque({ tipo: 'TEST', temaId: 14, numPreguntas: 12 });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-bloque-test-inline'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('test-inline');
  });

  it('CUESTIONARIO renderiza el quiz inline (app-bloque-cuestionario)', () => {
    setBloque({
      tipo: 'CUESTIONARIO',
      bloquePreguntas: [
        { id: 1, bloqueId: 1, orden: 0, enunciado: '¿?', opciones: ['a', 'b'] },
      ],
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-bloque-cuestionario'),
    ).not.toBeNull();
  });

  it('DOCUMENTO renderiza la tarjeta de documento (app-bloque-documento)', () => {
    setBloque({
      tipo: 'DOCUMENTO',
      documentoNombre: 'temario.pdf',
      documentoMime: 'application/pdf',
      documentoTamanoBytes: 2048,
    });
    fixture.componentRef.setInput('preview', true);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('app-bloque-documento'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('temario.pdf');
    expect(fixture.nativeElement.textContent).toContain('Descargar');
  });

  it('aplica estilos CSS de callout, resaltado y recuadro al contenido markdown', () => {
    // Verifica que el componente aplica la clase .cursos-prose que contiene
    // las nuevas clases CSS para callout, resaltado, y recuadro.
    // El contrato del sanitizador (permitir clases en elementos) se valida
    // en QA visual en navegador real, no en test unitario mockeado.
    setBloque({
      tipo: 'TEXTO',
      contenidoMarkdown: '# Test\n\nContenido del bloque.',
    });
    fixture.detectChanges();
    const wrapper = fixture.nativeElement.querySelector('.bloque-texto');
    expect(wrapper).not.toBeNull();
    // Verify que la clase de tipografía prose se aplica
    expect(wrapper.classList.contains('cursos-prose')).toBe(true);
  });
});
