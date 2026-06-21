import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Calle, RecorridoResponse } from '../models/callejero.model';
import {
  RecorridoExamenView,
  RecorridoPaneComponent,
  RecorridoResultadoView,
} from './recorrido-pane.component';

/**
 * Tests del pane PRESENTACIONAL de recorridos. No hay Leaflet ni HttpClient
 * aquí (D5): solo verificamos que renderiza según los inputs, emite los outputs
 * de intención y gestiona el estado local (minimizar). El render del mapa y las
 * llamadas a la API son responsabilidad del padre (probadas aparte).
 */

const CALLE = (id: number, nombre: string): Calle => ({
  id,
  zonaId: 1,
  codigoExterno: `c${id}`,
  nombre,
  tipoVia: 'Calle',
  codigoPostal: null,
  geometria: { type: 'LineString', coordinates: [] },
});

const RECORRIDO: RecorridoResponse = {
  polyline: {
    type: 'LineString',
    coordinates: [
      [-0.37, 39.47],
      [-0.36, 39.46],
    ],
  },
  calles: ['Av. del Cid', 'Calle Colón', 'Gran Vía'],
  km: 2.4,
  minutos: 6,
  estacion: { nombre: 'Parque Campanar', lat: 39.48, lng: -0.38 },
};

function txt(fixture: ComponentFixture<RecorridoPaneComponent>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}
function byTestId(
  fixture: ComponentFixture<RecorridoPaneComponent>,
  id: string,
): HTMLElement | null {
  return (fixture.nativeElement as HTMLElement).querySelector(
    `[data-testid="${id}"]`,
  );
}

describe('RecorridoPaneComponent', () => {
  let fixture: ComponentFixture<RecorridoPaneComponent>;
  let component: RecorridoPaneComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecorridoPaneComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(RecorridoPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('renderiza el hint inicial cuando no hay búsqueda', () => {
    expect(byTestId(fixture, 'cj-rec-hint')).not.toBeNull();
    expect(byTestId(fixture, 'cj-rec-iniciar-examen')).not.toBeNull();
  });

  it('estado "ruta no disponible" DURO (D7) cuando error=no-disponible', () => {
    fixture.componentRef.setInput('error', 'no-disponible');
    fixture.detectChanges();
    const el = byTestId(fixture, 'cj-rec-no-disponible');
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('Ruta no disponible');
    // No debe haber resumen de recorrido a la vez.
    expect(byTestId(fixture, 'cj-rec-resumen')).toBeNull();
  });

  it('muestra spinner mientras loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(byTestId(fixture, 'cj-rec-loading')).not.toBeNull();
  });

  it('renderiza km, min y la lista ORDENADA de calles del recorrido', () => {
    fixture.componentRef.setInput('recorrido', RECORRIDO);
    fixture.componentRef.setInput('destino', CALLE(9, 'Calle Colón'));
    fixture.detectChanges();
    expect(byTestId(fixture, 'cj-rec-resumen')).not.toBeNull();
    const calles = byTestId(fixture, 'cj-rec-calles');
    expect(calles?.querySelectorAll('li').length).toBe(3);
    expect(txt(fixture)).toContain('km');
    expect(txt(fixture)).toContain('Parque Campanar');
    expect(txt(fixture)).toContain('Calle Colón');
  });

  it('emite buscarDestino con el id al seleccionar una calle', () => {
    const emitted: number[] = [];
    component.buscarDestino.subscribe((id) => emitted.push(id));
    component.onSeleccionarCalle({
      originalEvent: new Event('select'),
      value: CALLE(42, 'Av. del Cid'),
    });
    expect(emitted).toEqual([42]);
  });

  it('filtrarCalles filtra por texto y limita a 20', () => {
    const muchas: Calle[] = Array.from({ length: 30 }, (_, i) =>
      CALLE(i + 1, `Calle Mayor ${i + 1}`),
    );
    fixture.componentRef.setInput('calles', muchas);
    fixture.detectChanges();
    component.filtrarCalles({ originalEvent: new Event('c'), query: 'mayor' });
    expect(component.sugerencias().length).toBe(20);
    component.filtrarCalles({ originalEvent: new Event('c'), query: 'zzz' });
    expect(component.sugerencias().length).toBe(0);
  });

  it('toggle minimizar alterna el estado y emite minimizarToggle', () => {
    const emitted: boolean[] = [];
    component.minimizarToggle.subscribe((v) => emitted.push(v));
    expect(component.minimizado()).toBe(false);
    component.toggleMinimizar();
    expect(component.minimizado()).toBe(true);
    expect(emitted).toEqual([true]);
    fixture.detectChanges();
    // Cuerpo oculto al minimizar.
    expect(byTestId(fixture, 'cj-rec-body')).toBeNull();
    component.toggleMinimizar();
    expect(component.minimizado()).toBe(false);
    expect(emitted).toEqual([true, false]);
  });

  it('emite iniciarExamenRecorridos al pulsar el botón', () => {
    let called = 0;
    component.iniciarExamenRecorridos.subscribe(() => called++);
    (byTestId(fixture, 'cj-rec-iniciar-examen') as HTMLButtonElement).click();
    expect(called).toBe(1);
  });

  describe('modo examen', () => {
    const VIEW: RecorridoExamenView = {
      calleNombre: 'Av. del Cid',
      opciones: ['Campanar', 'Centro', 'Marítimo'],
      indice: 1,
      total: 5,
      aciertos: 0,
      feedback: null,
      elegido: null,
      correctos: ['Campanar'],
      esUltimo: false,
    };

    it('renderiza la pregunta y los botones de parque', () => {
      fixture.componentRef.setInput('examen', VIEW);
      fixture.detectChanges();
      const exam = byTestId(fixture, 'cj-rec-examen');
      expect(exam).not.toBeNull();
      expect(exam?.textContent).toContain('Av. del Cid');
      expect(exam?.querySelectorAll('.cj-rec__op').length).toBe(3);
      // Sin feedback aún → no hay botón siguiente.
      expect(byTestId(fixture, 'cj-rec-siguiente')).toBeNull();
    });

    it('emite responderParque al pulsar una opción', () => {
      const emitted: string[] = [];
      component.responderParque.subscribe((p) => emitted.push(p));
      fixture.componentRef.setInput('examen', VIEW);
      fixture.detectChanges();
      component.onResponder('Centro');
      expect(emitted).toEqual(['Centro']);
    });

    it('no reemite si ya hay feedback (anti doble-respuesta)', () => {
      const emitted: string[] = [];
      component.responderParque.subscribe((p) => emitted.push(p));
      fixture.componentRef.setInput('examen', {
        ...VIEW,
        elegido: 'Centro',
        feedback: { ok: false, texto: 'Cubre: Campanar.' },
      });
      fixture.detectChanges();
      component.onResponder('Marítimo');
      expect(emitted).toEqual([]);
    });

    it('estadoOpcion resalta correcta/elegida tras responder', () => {
      fixture.componentRef.setInput('examen', {
        ...VIEW,
        elegido: 'Centro',
        feedback: { ok: false, texto: 'Cubre: Campanar.' },
      });
      fixture.detectChanges();
      expect(component.estadoOpcion('Campanar')).toBe('ok');
      expect(component.estadoOpcion('Centro')).toBe('bad');
      expect(component.estadoOpcion('Marítimo')).toBe('idle');
      // Botón siguiente aparece con feedback.
      expect(byTestId(fixture, 'cj-rec-siguiente')).not.toBeNull();
    });

    it('botón siguiente emite siguienteOtraCalle', () => {
      let called = 0;
      component.siguienteOtraCalle.subscribe(() => called++);
      fixture.componentRef.setInput('examen', {
        ...VIEW,
        feedback: { ok: true, texto: 'Campanar cubre esta calle.' },
      });
      fixture.detectChanges();
      (byTestId(fixture, 'cj-rec-siguiente') as HTMLButtonElement).click();
      expect(called).toBe(1);
    });

    it('muestra el resultado final del examen', () => {
      const res: RecorridoResultadoView = {
        nota: 8,
        aciertos: 4,
        total: 5,
        aprobado: true,
      };
      fixture.componentRef.setInput('resultado', res);
      fixture.detectChanges();
      const r = byTestId(fixture, 'cj-rec-resultado');
      expect(r).not.toBeNull();
      expect(byTestId(fixture, 'cj-rec-nota')?.textContent).toContain('8');
      expect(r?.textContent).toContain('Aprobado');
    });
  });

  // ── Selector de dificultad (port v27) ─────────────────────────────────────
  describe('selector de dificultad', () => {
    it('renderiza los 3 niveles y emite cambiarDificultad al pulsar', () => {
      expect(byTestId(fixture, 'cj-rec-dificultad')).not.toBeNull();
      let emitido: string | undefined;
      component.cambiarDificultad.subscribe((d) => (emitido = d));
      (byTestId(fixture, 'cj-rec-dif-DIFICIL') as HTMLButtonElement).click();
      expect(emitido).toBe('DIFICIL');
    });

    it('marca con .on el nivel activo según el input dificultad', () => {
      fixture.componentRef.setInput('dificultad', 'FACIL');
      fixture.detectChanges();
      const facil = byTestId(fixture, 'cj-rec-dif-FACIL') as HTMLElement;
      const medio = byTestId(fixture, 'cj-rec-dif-MEDIO') as HTMLElement;
      expect(facil.classList.contains('on')).toBe(true);
      expect(medio.classList.contains('on')).toBe(false);
    });
  });
});
