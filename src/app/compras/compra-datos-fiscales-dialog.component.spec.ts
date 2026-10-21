import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of, Subject, throwError } from 'rxjs';
import {
  DatosFiscalesCompra,
  EstadoDatosFiscalesCompra,
} from './datos-fiscales-compra.model';
import { CompraDatosFiscalesDialogComponent } from './compra-datos-fiscales-dialog.component';

const DATOS_PERSONA: DatosFiscalesCompra = {
  nombre: 'Ana',
  apellidos: 'García',
  empresa: '',
  direccion: 'Calle Uno 1',
  direccion2: '',
  poblacion: 'Valencia',
  provincia: 'Valencia',
  codigoPostal: '46001',
  pais: 'ES',
  nif: '12345678Z',
};

function estado(
  cambios: Partial<EstadoDatosFiscalesCompra> = {},
): EstadoDatosFiscalesCompra {
  return {
    datos: { ...DATOS_PERSONA },
    faltantes: [],
    invalidos: [],
    conflictos: [],
    completo: false,
    version: 'v1',
    ...cambios,
  };
}

describe('CompraDatosFiscalesDialogComponent', () => {
  let fixture: ComponentFixture<CompraDatosFiscalesDialogComponent>;
  let component: CompraDatosFiscalesDialogComponent;
  let cerrar: jest.Mock;
  let guardar: jest.Mock;
  let comprobar: jest.Mock;

  function crear(estadoActual: EstadoDatosFiscalesCompra): void {
    cerrar = jest.fn();
    guardar = jest.fn(() => of({ ...estadoActual, completo: true }));
    comprobar = jest.fn(() => of(estadoActual));
    TestBed.configureTestingModule({
      imports: [CompraDatosFiscalesDialogComponent],
      providers: [
        {
          provide: DynamicDialogConfig,
          useValue: { data: { estado: estadoActual, guardar, comprobar } },
        },
        { provide: DynamicDialogRef, useValue: { close: cerrar } },
      ],
    });
    fixture = TestBed.createComponent(CompraDatosFiscalesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function pulsarComprobarGuardado(): void {
    fixture.detectChanges();
    const botones = Array.from(
      fixture.nativeElement.querySelectorAll(
        'button',
      ) as NodeListOf<HTMLButtonElement>,
    );
    const comprobarButton = botones.find((button) =>
      button.textContent?.includes('Comprobar guardado'),
    );
    expect(comprobarButton).toBeDefined();
    comprobarButton?.click();
    fixture.detectChanges();
  }

  it('muestra solo campos reportados y no exige apellidos a una empresa', () => {
    const fiscal = estado({
      datos: {
        ...DATOS_PERSONA,
        nombre: '',
        apellidos: '',
        empresa: 'Bomberos SL',
        direccion: '',
        nif: '',
      },
      faltantes: ['apellidos', 'direccion'],
      conflictos: ['nif'],
    });
    crear(fiscal);

    expect(component.campos.map(({ campo }) => campo)).toEqual([
      'direccion',
      'nif',
    ]);
    expect(component.formulario.get('apellidos')).toBeNull();
    expect(component.formulario.get('nombre')).toBeNull();
    expect(component.formulario.get('direccion')?.value).toBe('');
  });

  it('dirección línea 2 es opcional y solo se envían los campos señalados', () => {
    const fiscal = estado({ faltantes: ['direccion2'] });
    crear(fiscal);

    expect(component.formulario.get('direccion2')?.valid).toBe(true);
    component.guardar();

    expect(guardar).toHaveBeenCalledWith({ direccion2: '' });
    expect(cerrar).toHaveBeenCalledWith({ guardado: true });
  });

  it('exige provincia para España pero no la hace dependiente de otros campos', () => {
    crear(
      estado({
        datos: { ...DATOS_PERSONA, pais: 'ES', provincia: '' },
        invalidos: ['provincia'],
      }),
    );
    expect(component.formulario.get('provincia')?.hasError('required')).toBe(
      true,
    );

    TestBed.resetTestingModule();
    crear(
      estado({
        datos: { ...DATOS_PERSONA, pais: 'FR', provincia: '' },
        invalidos: ['provincia'],
      }),
    );
    expect(component.formulario.get('provincia')?.hasError('required')).toBe(
      false,
    );
  });

  it('si el país faltante pasa a ES añade provincia y la envía al guardar', () => {
    crear(
      estado({
        datos: { ...DATOS_PERSONA, pais: '', provincia: '' },
        faltantes: ['pais'],
      }),
    );

    expect(component.campos.map(({ campo }) => campo)).toEqual(['pais']);
    expect(component.formulario.get('provincia')).toBeNull();

    component.formulario.get('pais')?.setValue('ES');
    expect(component.campos.map(({ campo }) => campo)).toEqual([
      'provincia',
      'pais',
    ]);
    expect(component.formulario.get('provincia')?.hasError('required')).toBe(
      true,
    );

    component.formulario.get('provincia')?.setValue('Madrid');
    component.guardar();

    expect(guardar).toHaveBeenCalledWith({ provincia: 'Madrid', pais: 'ES' });
    expect(cerrar).toHaveBeenCalledWith({ guardado: true });
  });

  it('al cambiar a otro país oculta provincia dinámica y elimina su requisito', () => {
    crear(
      estado({
        datos: { ...DATOS_PERSONA, pais: '', provincia: '' },
        faltantes: ['pais'],
      }),
    );
    component.formulario.get('pais')?.setValue('ES');
    component.formulario.get('pais')?.setValue('FR');

    expect(component.campos.map(({ campo }) => campo)).toEqual(['pais']);
    expect(component.formulario.get('provincia')?.hasError('required')).toBe(
      false,
    );
  });

  it('un NIF inválido muestra un error asociado al control', () => {
    crear(
      estado({
        datos: { ...DATOS_PERSONA, nif: '123' },
        invalidos: ['nif'],
      }),
    );
    component.formulario.get('nif')?.markAsTouched();

    expect(component.campoTieneError('nif')).toBe(true);
    expect(component.errorCampo('nif')).toContain('NIF');
  });

  it('ignora un segundo submit mientras el primer guardado sigue en curso', () => {
    crear(estado({ faltantes: ['direccion2'] }));
    const respuestaGuardado = new Subject<EstadoDatosFiscalesCompra>();
    guardar.mockReturnValue(respuestaGuardado.asObservable());

    component.guardar();
    component.guardar();

    expect(guardar).toHaveBeenCalledTimes(1);
    respuestaGuardado.next(estado({ completo: true }));
    respuestaGuardado.complete();
    expect(cerrar).toHaveBeenCalledWith({ guardado: true });
  });

  it('permite confirmar un guardado incierto leyendo el estado completo', () => {
    crear(estado({ faltantes: ['direccion2'] }));
    component.formulario.get('direccion2')?.setValue('Puerta 2');
    guardar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 499,
            statusText: 'Client Closed Request',
          }),
      ),
    );
    comprobar.mockReturnValue(of(estado({ completo: true })));

    component.guardar();
    expect(cerrar).not.toHaveBeenCalled();
    pulsarComprobarGuardado();

    expect(comprobar).toHaveBeenCalledTimes(1);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(cerrar).toHaveBeenCalledWith({ guardado: true });
  });

  it('mantiene el formulario cuando el guardado o la lectura siguen pendientes', () => {
    crear(estado({ faltantes: ['direccion2'] }));
    component.formulario.get('direccion2')?.setValue('Puerta 2');
    guardar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { codigo: 'SINCRONIZACION_FISCAL_EN_CURSO' },
          }),
      ),
    );
    comprobar
      .mockReturnValueOnce(
        of({
          ...estado({ completo: false, faltantes: ['direccion2'] }),
          fiscalSyncPending: true,
        } as EstadoDatosFiscalesCompra),
      )
      .mockReturnValueOnce(of(estado({ completo: true })));

    component.guardar();
    expect(component.errorGuardado.toLowerCase()).toContain('curso');
    pulsarComprobarGuardado();

    expect(cerrar).not.toHaveBeenCalled();
    expect(component.formulario.get('direccion2')?.value).toBe('Puerta 2');
    expect(component.errorGuardado.toLowerCase()).toContain('curso');
    expect(guardar).toHaveBeenCalledTimes(1);

    pulsarComprobarGuardado();
    expect(comprobar).toHaveBeenCalledTimes(2);
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(cerrar).toHaveBeenCalledWith({ guardado: true });
  });

  it('no vuelve a guardar si la lectura de recuperación sigue incompleta', () => {
    crear(estado({ faltantes: ['direccion2'] }));
    component.formulario.get('direccion2')?.setValue('Puerta 2');
    guardar.mockReturnValue(throwError(() => new Error('respuesta perdida')));
    comprobar.mockReturnValue(
      of(estado({ completo: false, faltantes: ['direccion2'] })),
    );

    component.guardar();
    pulsarComprobarGuardado();

    expect(cerrar).not.toHaveBeenCalled();
    expect(component.formulario.get('direccion2')?.value).toBe('Puerta 2');
    expect(component.errorGuardado.toLowerCase()).toContain('incompleta');
    component.guardar();
    expect(guardar).toHaveBeenCalledTimes(1);
  });

  it('preserva los datos y no reenvía el PUT si falla la lectura de recuperación', () => {
    crear(estado({ faltantes: ['direccion2'] }));
    component.formulario.get('direccion2')?.setValue('Puerta 2');
    guardar.mockReturnValue(throwError(() => new Error('respuesta perdida')));
    comprobar.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: { mensaje: 'Lectura temporalmente no disponible' },
          }),
      ),
    );

    component.guardar();
    pulsarComprobarGuardado();

    expect(cerrar).not.toHaveBeenCalled();
    expect(component.formulario.get('direccion2')?.value).toBe('Puerta 2');
    expect(component.errorGuardado).toContain('No se pudo comprobar');
    component.guardar();
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(comprobar).toHaveBeenCalledTimes(1);
  });
});
