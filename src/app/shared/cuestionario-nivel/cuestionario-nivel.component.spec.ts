import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';
import { AutoasignacionService } from '../../planificacion/services/autoasignacion.service';
import { NivelOposicion } from '../models/pregunta.model';
import { CuestionarioNivelComponent } from './cuestionario-nivel.component';

const cuestionario = {
  version: 42,
  preguntas: Array.from({ length: 5 }, (_, indice) => ({
    id: `nivel-${indice + 1}`,
    texto: `Pregunta ${indice + 1}`,
    opciones: [0, 1, 2, 3].map((valor) => ({
      valor,
      etiqueta: `Opción ${valor}`,
    })),
  })),
};

describe('CuestionarioNivelComponent', () => {
  let component: CuestionarioNivelComponent;
  let fixture: ComponentFixture<CuestionarioNivelComponent>;
  const estadoAceptado = {
    evaluacionId: 8,
    completado: true as const,
    nivelRecomendado: NivelOposicion.AVANZADO,
    nivelElegido: NivelOposicion.AVANZADO,
    versionCuestionario: 42,
    aceptadaEn: '2026-09-15T12:00:00.000Z',
  };
  let service: {
    getCuestionarioNivel$: jest.Mock;
    recomendarNivel$: jest.Mock;
    aceptarEvaluacionNivel$: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getCuestionarioNivel$: jest.fn(() => of(cuestionario)),
      recomendarNivel$: jest.fn(() =>
        of({ evaluacionId: 8, nivelRecomendado: NivelOposicion.AVANZADO }),
      ),
      aceptarEvaluacionNivel$: jest.fn(() => of(estadoAceptado)),
    };
    await TestBed.configureTestingModule({
      imports: [CuestionarioNivelComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AutoasignacionService, useValue: service },
        {
          provide: ToastrService,
          useValue: { error: jest.fn(), warning: jest.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CuestionarioNivelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('calcular y cancelar no marcan el test como completado', async () => {
    component.abrir();
    component.respuestas = [3, 2, 3, 1, 3];

    await component.obtenerRecomendacion();
    component.cancelar();

    expect(service.recomendarNivel$).toHaveBeenCalledWith([3, 2, 3, 1, 3], 42);
    expect(service.aceptarEvaluacionNivel$).not.toHaveBeenCalled();
    expect(component.estadoTest).toBeNull();
  });

  it('persiste antes de emitir el nivel aceptado', async () => {
    const emitSpy = jest.spyOn(component.nivelAceptado, 'emit');
    component.abrir();
    component.respuestas = [3, 2, 3, 1, 3];
    await component.obtenerRecomendacion();

    await component.aceptarRecomendacion();

    expect(service.aceptarEvaluacionNivel$).toHaveBeenCalledWith(
      8,
      NivelOposicion.AVANZADO,
    );
    expect(emitSpy).toHaveBeenCalledWith(estadoAceptado);
    expect(component.estadoTest).toEqual(estadoAceptado);
  });

  it('permite aceptar el test manteniendo un nivel distinto del recomendado', async () => {
    component.nivelActual = NivelOposicion.INICIACION;
    component.abrir();
    component.respuestas = [3, 2, 3, 1, 3];
    await component.obtenerRecomendacion();

    await component.aceptarNivel(NivelOposicion.INICIACION);

    expect(service.aceptarEvaluacionNivel$).toHaveBeenCalledWith(
      8,
      NivelOposicion.INICIACION,
    );
  });

  it('muestra el estado persistido sin exponer puntuación bruta', () => {
    fixture.componentRef.setInput('estadoTest', estadoAceptado);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Test completado');
    expect(texto).toContain('Avanzado');
    expect(texto.toLowerCase()).not.toContain('puntuación');
  });
});
