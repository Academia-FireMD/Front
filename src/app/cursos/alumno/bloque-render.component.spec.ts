import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMarkdown } from 'ngx-markdown';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Bloque } from '../models/curso.model';
import { environment } from '../../../environments/environment';
import { BloqueRenderComponent } from './bloque-render.component';

describe('BloqueRenderComponent', () => {
  let fixture: ComponentFixture<BloqueRenderComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BloqueRenderComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMarkdown(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BloqueRenderComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function setBloque(b: Partial<Bloque>): void {
    fixture.componentRef.setInput('bloque', {
      id: 1,
      leccionId: 1,
      orden: 0,
      ...b,
    } as Bloque);
  }

  it('VIDEO con playbackUrl: el reproductor se alimenta de la URL firmada', () => {
    // No renderizamos el iframe (requiere DomSanitizer real; cubierto por QA
    // visual). Verificamos el cableado del input y la URL.
    setBloque({ tipo: 'VIDEO' });
    fixture.componentRef.setInput('playbackUrl', 'https://video/embed/x');
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

  it('TEST muestra meta + botón "Iniciar test"', () => {
    setBloque({ tipo: 'TEST', temaId: 14, numPreguntas: 12 });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('12 preguntas');
    expect(text).toContain('Iniciar test');
  });

  it('CUESTIONARIO muestra placeholder de próximamente', () => {
    setBloque({ tipo: 'CUESTIONARIO' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('próximamente');
  });

  it('iniciarTest hace POST a /bloques/:id/iniciar-test', async () => {
    setBloque({ tipo: 'TEST', temaId: 14, numPreguntas: 10 });
    fixture.detectChanges();
    const promise = fixture.componentInstance.iniciarTest();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/bloques/1/iniciar-test`,
    );
    expect(req.request.method).toBe('POST');
    req.flush({ id: 99 });
    await promise;
  });

  it('en preview NO llama al backend', async () => {
    setBloque({ tipo: 'TEST', temaId: 14, numPreguntas: 10 });
    fixture.componentRef.setInput('preview', true);
    fixture.detectChanges();
    await fixture.componentInstance.iniciarTest();
    httpMock.expectNone(`${environment.apiUrl}/bloques/1/iniciar-test`);
  });
});
