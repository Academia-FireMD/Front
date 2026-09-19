import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
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
  let service: {
    getCuestionarioNivel$: jest.Mock;
    recomendarNivel$: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getCuestionarioNivel$: jest.fn(() => of(cuestionario)),
      recomendarNivel$: jest.fn(() =>
        of({ puntuacion: 12, nivelRecomendado: NivelOposicion.AVANZADO }),
      ),
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

  it('carga del servidor la definición del cuestionario', () => {
    expect(service.getCuestionarioNivel$).toHaveBeenCalledTimes(1);
    expect(component.preguntas.map((pregunta) => pregunta.texto)).toEqual([
      'Pregunta 1',
      'Pregunta 2',
      'Pregunta 3',
      'Pregunta 4',
      'Pregunta 5',
    ]);
  });

  it('calcula sin emitir nivel hasta que se acepta la recomendación', async () => {
    const emitSpy = jest.spyOn(component.nivelAceptado, 'emit');
    component.respuestas = [3, 2, 3, 1, 3];

    await component.obtenerRecomendacion();

    expect(service.recomendarNivel$).toHaveBeenCalledWith([3, 2, 3, 1, 3], 42);
    expect(emitSpy).not.toHaveBeenCalled();

    component.aceptarRecomendacion();
    expect(emitSpy).toHaveBeenCalledWith(NivelOposicion.AVANZADO);
  });

  it('no muestra la puntuación al alumno', async () => {
    component.respuestas = [3, 2, 3, 1, 3];
    await component.obtenerRecomendacion();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Te recomendamos el nivel Avanzado.');
    expect(texto.toLowerCase()).not.toContain('puntuación');
    expect(texto).not.toContain('12');
  });

  it('recarga y limpia respuestas ante una versión obsoleta', async () => {
    service.recomendarNivel$.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { codigo: 'CUESTIONARIO_DESACTUALIZADO' },
          }),
      ),
    );
    component.respuestas = [3, 2, 3, 1, 3];

    await component.obtenerRecomendacion();

    expect(service.getCuestionarioNivel$).toHaveBeenCalledTimes(2);
    expect(component.respuestas).toEqual([null, null, null, null, null]);
  });
});
