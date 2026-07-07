import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { GRUPO_COMUNIDAD_VALENCIANA } from '../../utils/consts';
import { Oposicion } from '../models/subscription.model';
import {
  OposicionPickerComponent,
  PickerOption,
} from './oposicion-picker.component';

const VAL = Oposicion.VALENCIA_AYUNTAMIENTO;
const ALI = Oposicion.ALICANTE_CPBA;
const MAD = Oposicion.MADRID;
const GEN = Oposicion.GENERAL;

describe('OposicionPickerComponent', () => {
  let component: OposicionPickerComponent;
  let fixture: ComponentFixture<OposicionPickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [OposicionPickerComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(OposicionPickerComponent);
    component = fixture.componentInstance;
  });

  /** Simula que el padre carga un valor de entrada. */
  function load(ops: Oposicion[]): void {
    const previo = component.oposiciones;
    component.oposiciones = ops;
    component.ngOnChanges({
      oposiciones: new SimpleChange(previo, ops, previo === undefined),
    });
  }

  function grupoOption(): PickerOption {
    return component.listboxOptions.find(
      (o) => o.code === GRUPO_COMUNIDAD_VALENCIANA.code,
    )!;
  }

  function indOption(code: Oposicion): PickerOption {
    return component.listboxOptions.find((o) => o.code === code && !o.members)!;
  }

  /** Argumento (Oposicion[]) de la última llamada a updateSelection.emit. */
  function lastEmit(emit: jest.SpyInstance): Oposicion[] {
    const calls = emit.mock.calls;
    return calls[calls.length - 1][0] as Oposicion[];
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('(a) seleccionar la agrupadora emite [VALENCIA, ALICANTE]', () => {
    load([]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([grupoOption()]);
    expect(emit).toHaveBeenLastCalledWith([VAL, ALI]);
    expect(component.grupoActivo).toBe(true);
  });

  it('(b) cargar exactamente el par muestra la agrupadora ACTIVA (un solo badge)', () => {
    load([VAL, ALI]);
    expect(component.grupoActivo).toBe(true);
    expect(component.displayItems.length).toBe(1);
    expect(component.displayItems[0].code).toBe(
      GRUPO_COMUNIDAD_VALENCIANA.code,
    );
  });

  it('(b bis) el par en orden inverso también se agrupa (comparación por conjunto)', () => {
    load([ALI, VAL]);
    expect(component.grupoActivo).toBe(true);
  });

  it('(c) cargar solo Valencia muestra la individual (no agrupada)', () => {
    load([VAL]);
    expect(component.grupoActivo).toBe(false);
    expect(component.displayItems.map((i) => i.code)).toEqual([VAL]);
  });

  it('(d) cargar el par + Madrid muestra las individuales (no agrupada)', () => {
    load([VAL, ALI, MAD]);
    expect(component.grupoActivo).toBe(false);
    expect(component.displayItems.length).toBe(3);
    expect(component.displayItems.map((i) => i.code).sort()).toEqual(
      [VAL, ALI, MAD].sort(),
    );
  });

  it('(e) marcar una individual con la agrupadora activa rompe la agrupación', () => {
    load([VAL, ALI]);
    expect(component.grupoActivo).toBe(true);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    // PrimeNG añade la individual al valor que ya contenía el grupo.
    component.onSelectionChange([grupoOption(), indOption(VAL)]);
    expect(component.grupoActivo).toBe(false);
    expect(component.displayItems.length).toBe(2);
    expect(emit).toHaveBeenLastCalledWith(expect.arrayContaining([VAL, ALI]));
    expect(lastEmit(emit)).toHaveLength(2);
  });

  it('activar la agrupadora desmarca GENERAL (conceptos distintos)', () => {
    load([GEN]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([indOption(GEN), grupoOption()]);
    expect(emit).toHaveBeenLastCalledWith([VAL, ALI]);
    expect(lastEmit(emit)).not.toContain(GEN);
    expect(component.grupoActivo).toBe(true);
  });

  it('desmarcar la agrupadora limpia ambas oposiciones', () => {
    load([VAL, ALI]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([]); // el usuario desmarca el grupo
    expect(emit).toHaveBeenLastCalledWith([]);
    expect(component.grupoActivo).toBe(false);
  });

  it('activar la agrupadora con Madrid presente cae a modo individual (par + Madrid)', () => {
    load([MAD]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([indOption(MAD), grupoOption()]);
    expect(component.grupoActivo).toBe(false);
    expect(lastEmit(emit).slice().sort()).toEqual([VAL, ALI, MAD].sort());
  });

  it('write-back del padre con el mismo conjunto conserva el modo individual roto', () => {
    load([VAL, ALI]);
    component.onSelectionChange([grupoOption(), indOption(VAL)]); // rompe la agrupación
    expect(component.grupoActivo).toBe(false);
    load([VAL, ALI]); // el padre reescribe el mismo par tras la emisión
    expect(component.grupoActivo).toBe(false); // no re-agrupa
  });

  it('multiple=false: no ofrece agrupadora y emite selección simple', () => {
    component.multiple = false;
    load([]);
    expect(component.listboxOptions.some((o) => !!o.members)).toBe(false);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange(indOption(MAD));
    expect(emit).toHaveBeenLastCalledWith([MAD]);
    expect(component.grupoActivo).toBe(false);
  });
});
