import { NO_ERRORS_SCHEMA, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { TemaService } from '../../services/tema.service';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { Oposicion } from '../models/subscription.model';
import { TemaSelectComponent } from './tema-select.component';

describe('TemaSelectComponent', () => {
  let component: TemaSelectComponent;
  let fixture: ComponentFixture<TemaSelectComponent>;

  const TEMAS: any[] = [
    {
      id: 1,
      numero: 1,
      descripcion: 'Madrid Tema',
      modulo: { nombre: 'Madrid', esPublico: true, relevancia: ['MADRID'] },
    },
    {
      id: 2,
      numero: 2,
      descripcion: 'Valencia Tema',
      modulo: {
        nombre: 'Valencia',
        esPublico: true,
        relevancia: ['VALENCIA_AYUNTAMIENTO'],
      },
    },
    {
      id: 3,
      numero: 3,
      descripcion: 'Sin restricción',
      modulo: { nombre: 'General', esPublico: true, relevancia: [] },
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemaSelectComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: TemaService, useValue: { getAllTemas$: () => of(TEMAS) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(TemaSelectComponent);
    component = fixture.componentInstance;
    component.formControl = new FormControl(null);
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('sin oposicion muestra TODOS los temas', () => {
    component.oposicion = null;
    component.ngOnInit();
    const labels = component.grupos.flatMap((g: any) =>
      g.items.map((i: any) => i.label),
    );
    expect(labels.length).toBe(3);
  });

  it('con oposicion MADRID sólo muestra temas del módulo Madrid (y sin restricción)', () => {
    component.oposicion = Oposicion.MADRID;
    component.ngOnInit();
    const labels = component.grupos.flatMap((g: any) =>
      g.items.map((i: any) => i.label),
    );
    // tema 1 (Madrid) + tema 3 (sin restricción → siempre visible)
    expect(labels.length).toBe(2);
    expect(labels.some((l: string) => l.includes('Madrid'))).toBe(true);
    expect(labels.some((l: string) => l.includes('Valencia'))).toBe(false);
  });

  it('Oposicion.GENERAL muestra todos los temas (sin filtrar)', () => {
    component.oposicion = Oposicion.GENERAL;
    component.ngOnInit();
    const labels = component.grupos.flatMap((g: any) =>
      g.items.map((i: any) => i.label),
    );
    expect(labels.length).toBe(3);
  });

  it('ngOnChanges al cambiar [oposicion] recomputa el grupo', () => {
    component.oposicion = null;
    component.ngOnInit();
    const before = component.grupos.flatMap((g: any) => g.items).length;
    component.oposicion = Oposicion.MADRID;
    component.ngOnChanges({
      oposicion: new SimpleChange(null, Oposicion.MADRID, false),
    });
    const after = component.grupos.flatMap((g: any) => g.items).length;
    expect(after).toBeLessThan(before);
  });
});
