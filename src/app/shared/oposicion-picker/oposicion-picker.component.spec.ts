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

  it('(e) con la agrupadora activa, quitar una hija rompe la agrupación y deja la otra', () => {
    load([VAL, ALI]);
    expect(component.grupoActivo).toBe(true);
    // Con el grupo activo, padre + hijas están marcados; el usuario quita VAL →
    // PrimeNG emite el valor sin VAL (padre + ALI).
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([grupoOption(), indOption(ALI)]);
    expect(component.grupoActivo).toBe(false);
    expect(component.displayItems.map((i) => i.code)).toEqual([ALI]);
    expect(emit).toHaveBeenLastCalledWith([ALI]);
  });

  it('(e bis) con la agrupadora activa, el dropdown marca el padre Y sus dos hijas', () => {
    load([VAL, ALI]);
    const codes = (
      component.listboxValue as PickerOption[]
    ).map((o) => o.code);
    expect(codes).toContain(GRUPO_COMUNIDAD_VALENCIANA.code);
    expect(codes).toContain(VAL);
    expect(codes).toContain(ALI);
  });

  it('(e ter) el árbol tiene niveles: GENERAL raíz (0), Madrid/CV comunidad (1), Valencia/Alicante provincia (2)', () => {
    load([]);
    expect(indOption(GEN).nivel).toBe(0);
    expect(indOption(MAD).nivel).toBe(1);
    expect(grupoOption().nivel).toBe(1);
    expect(indOption(VAL).nivel).toBe(2);
    expect(indOption(ALI).nivel).toBe(2);
  });

  it('(e quater) Madrid se muestra como comunidad ("Comunidad de Madrid") y GENERAL como raíz', () => {
    load([]);
    expect(indOption(MAD).label).toBe('Comunidad de Madrid');
    expect(indOption(GEN).label).toBe('Todas las oposiciones');
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

  it('write-back del padre con el par exacto conserva la agrupación (sin parpadeo)', () => {
    load([VAL, ALI]);
    expect(component.grupoActivo).toBe(true);
    load([VAL, ALI]); // el padre reescribe el mismo par tras la emisión
    expect(component.grupoActivo).toBe(true); // sigue agrupado, no se rompe
    expect(component.displayItems.map((i) => i.code)).toEqual([
      GRUPO_COMUNIDAD_VALENCIANA.code,
    ]);
  });

  it('(w1) seleccionar GENERAL es exclusivo: emite [GENERAL] y limpia lo demás', () => {
    load([VAL, ALI]); // arranca agrupado (CV)
    const emit = jest.spyOn(component.updateSelection, 'emit');
    // el dropdown tenía [CV, VAL, ALI] marcados; el usuario añade GENERAL
    component.onSelectionChange([
      grupoOption(),
      indOption(VAL),
      indOption(ALI),
      indOption(GEN),
    ]);
    expect(emit).toHaveBeenLastCalledWith([GEN]);
    expect(component.grupoActivo).toBe(false);
    expect(component.displayItems.map((i) => i.code)).toEqual([GEN]);
  });

  it('(w2) con GENERAL activo, elegir una oposición concreta quita GENERAL', () => {
    load([GEN]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([indOption(GEN), indOption(MAD)]);
    expect(emit).toHaveBeenLastCalledWith([MAD]);
    expect(component.grupoActivo).toBe(false);
  });

  it('(w3) deseleccionar GENERAL deja la selección vacía', () => {
    load([GEN]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([]);
    expect(emit).toHaveBeenLastCalledWith([]);
  });

  it('(w4) activar la agrupadora CV con GENERAL activo sustituye GENERAL por [VAL, ALI]', () => {
    load([GEN]);
    const emit = jest.spyOn(component.updateSelection, 'emit');
    component.onSelectionChange([indOption(GEN), grupoOption()]);
    expect(emit).toHaveBeenLastCalledWith([VAL, ALI]);
    expect(lastEmit(emit)).not.toContain(GEN);
    expect(component.grupoActivo).toBe(true);
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
