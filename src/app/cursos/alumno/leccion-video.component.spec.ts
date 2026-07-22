import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { Leccion } from '../models/curso.model';
import { LeccionVideoComponent } from './leccion-video.component';

/**
 * La reproducción HLS (Safari nativo vs hls.js) se cubre en el spec de
 * app-bunny-player; aquí va la lógica de progreso de la lección.
 */
describe('LeccionVideoComponent', () => {
  let fixture: ComponentFixture<LeccionVideoComponent>;
  let component: LeccionVideoComponent;
  let service: { upsertProgreso: jest.Mock };
  let toastr: { success: jest.Mock; error: jest.Mock };

  const crearFixture = () => {
    fixture = TestBed.createComponent(LeccionVideoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('leccion', {
      id: 10,
      duracionSegundos: 120,
    } as Leccion);
    fixture.componentRef.setInput(
      'playbackUrl',
      'https://vz-test.b-cdn.net/abc/playlist.m3u8?token=x&expires=1',
    );
    fixture.detectChanges();
  };

  beforeEach(async () => {
    service = { upsertProgreso: jest.fn().mockReturnValue(of(void 0)) };
    toastr = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LeccionVideoComponent],
      providers: [
        provideHttpClient(),
        { provide: CursosAlumnoService, useValue: service },
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
  });

  it('renderiza app-bunny-player con la URL firmada', () => {
    crearFixture();
    const player = fixture.nativeElement.querySelector('app-bunny-player');
    expect(player).not.toBeNull();
  });

  it('el progreso real (tiempoActual) se envía en el heartbeat', () => {
    jest.useFakeTimers();
    try {
      crearFixture();
      component.onTiempoActual(42);
      expect(component.segundosVisto()).toBe(42);

      jest.advanceTimersByTime(15_000);
      expect(service.upsertProgreso).toHaveBeenCalledWith(10, {
        segundosVisto: 42,
        porcentajeVisto: 35,
        completada: false,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('al terminar el vídeo (terminado) envía el 100% y para el heartbeat', () => {
    jest.useFakeTimers();
    try {
      crearFixture();
      component.onTerminado();
      expect(service.upsertProgreso).toHaveBeenCalledWith(10, {
        segundosVisto: 120,
        porcentajeVisto: 100,
        completada: false,
      });
      service.upsertProgreso.mockClear();
      jest.advanceTimersByTime(30_000);
      expect(service.upsertProgreso).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('marcarComoVista persiste completada y frena el heartbeat', () => {
    jest.useFakeTimers();
    try {
      crearFixture();
      component.marcarComoVista();
      expect(service.upsertProgreso).toHaveBeenCalledWith(10, {
        segundosVisto: 0,
        porcentajeVisto: 100,
        completada: true,
      });
      expect(component.completada()).toBe(true);
      expect(toastr.success).toHaveBeenCalled();
      service.upsertProgreso.mockClear();
      jest.advanceTimersByTime(30_000);
      expect(service.upsertProgreso).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
