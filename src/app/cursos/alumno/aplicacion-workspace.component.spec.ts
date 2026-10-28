import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AplicacionWorkspaceComponent } from './aplicacion-workspace.component';

const secciones = [
  {
    id: 1,
    cursoId: 10,
    titulo: 'Aplicación',
    orden: 0,
    lecciones: [
      {
        id: 95,
        seccionId: 1,
        titulo: 'Práctica',
        orden: 0,
        tipo: 'TEXTO' as const,
      },
    ],
  },
];

describe('AplicacionWorkspaceComponent', () => {
  let fixture: ComponentFixture<AplicacionWorkspaceComponent>;
  let component: AplicacionWorkspaceComponent;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [AplicacionWorkspaceComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AplicacionWorkspaceComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tituloCurso', 'Hidráulica');
    fixture.componentRef.setInput('tituloLeccion', 'Práctica');
    fixture.componentRef.setInput('secciones', secciones);
    fixture.componentRef.setInput('leccionActivaId', 95);
    fixture.componentRef.setInput('syncEstado', 'saving');
    fixture.componentRef.setInput('syncTexto', 'Guardando progreso…');
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('pinta la cabecera nativa con curso, lección y estado de sync real', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.aw-curso')?.textContent).toContain('Hidráulica');
    expect(el.querySelector('.aw-leccion')?.textContent).toContain('Práctica');
    expect(
      el.querySelector('[data-testid="hidraulica-sync-estado"]')?.textContent,
    ).toContain('Guardando progreso');
    expect(
      el.querySelector('[data-testid="aplicacion-lecciones"]'),
    ).not.toBeNull();
    // El currículum permanente no existe: solo se monta en el drawer temporal.
    expect(el.querySelector('app-curriculum-sidebar')).toBeNull();
  });

  it('abre el drawer temporal, enfoca el cierre y Escape lo cierra devolviendo el foco', () => {
    const el = fixture.nativeElement as HTMLElement;
    const btnLecciones = el.querySelector<HTMLButtonElement>(
      '[data-testid="aplicacion-lecciones"]',
    )!;
    btnLecciones.focus();
    expect(document.activeElement).toBe(btnLecciones);

    btnLecciones.click();
    fixture.detectChanges();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    expect(
      el.querySelector('[data-testid="aplicacion-drawer"]'),
    ).not.toBeNull();
    expect(el.querySelector('app-curriculum-sidebar')).not.toBeNull();
    expect(document.activeElement).toBe(
      el.querySelector('[data-testid="aplicacion-drawer-cerrar"]'),
    );

    component.onEscape();
    fixture.detectChanges();
    jest.runOnlyPendingTimers();

    expect(el.querySelector('[data-testid="aplicacion-drawer"]')).toBeNull();
    expect(document.activeElement).toBe(btnLecciones);
  });

  it('expone Marcar completada solo en el drawer y lo emite al padre', () => {
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>(
      '[data-testid="aplicacion-lecciones"]',
    )!.click();
    fixture.detectChanges();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    const completar = jest.fn();
    component.marcarCompletada.subscribe(completar);
    el.querySelector<HTMLButtonElement>(
      '[data-testid="aplicacion-marcar-completada"]',
    )!.click();
    expect(completar).toHaveBeenCalledTimes(1);
  });
});
