import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
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

  function crear(estadoActual: EstadoDatosFiscalesCompra): void {
    cerrar = jest.fn();
    guardar = jest.fn(() => of({ ...estadoActual, completo: true }));
    TestBed.configureTestingModule({
      imports: [CompraDatosFiscalesDialogComponent],
      providers: [
        {
          provide: DynamicDialogConfig,
          useValue: { data: { estado: estadoActual, guardar } },
        },
        { provide: DynamicDialogRef, useValue: { close: cerrar } },
      ],
    });
    fixture = TestBed.createComponent(CompraDatosFiscalesDialogComponent);
    component = fixture.componentInstance;
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
});
