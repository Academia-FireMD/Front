import { Location } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { of, Subject } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import {
  PlantillaSemanal,
  SubBloque,
} from '../../shared/models/planificacion.model';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { EventsService } from '../services/events.service';
import { VistaSemanalComponent } from '../vista-semanal/vista-semanal.component';
import { PlantillaSemanalEditComponent } from './plantilla-semanal-edit.component';

const subBloque: SubBloque = {
  id: 11,
  nombre: 'Hidráulica y mecánica',
  horaInicio: new Date(2026, 9, 28, 9, 0),
  duracion: 60,
  color: '#e65b40',
  comentarios: '',
};

function plantilla(
  overrides: Partial<PlantillaSemanal> = {},
): PlantillaSemanal {
  return {
    id: 7,
    identificador: 'Repaso de hidráulica',
    descripcion: 'Objetivo de la semana',
    subBloques: [subBloque],
    planificaciones: [],
    createdAt: new Date(2026, 9, 1),
    updatedAt: new Date(2026, 9, 1),
    ...overrides,
  };
}

describe('PlantillaSemanalEditComponent', () => {
  let component: PlantillaSemanalEditComponent;
  let fixture: ComponentFixture<PlantillaSemanalEditComponent>;
  let route: ActivatedRoute;
  let router: Router;
  let location: Location;
  const planificacionesService = {
    getPlantillaSemanalById: jest.fn(),
    createPlantillaSemanal$: jest.fn(),
  };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    planificacionesService.getPlantillaSemanalById.mockReset();
    planificacionesService.createPlantillaSemanal$.mockReset();

    await TestBed.configureTestingModule({
      declarations: [PlantillaSemanalEditComponent],
      imports: [ReactiveFormsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: EventsService, useClass: EventsService },
        { provide: PlanificacionesService, useValue: planificacionesService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    route = TestBed.inject(ActivatedRoute);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    (route.snapshot.paramMap.get as jest.Mock).mockReturnValue('new');
    (route.snapshot.queryParamMap.get as jest.Mock).mockReturnValue(null);

    fixture = TestBed.createComponent(PlantillaSemanalEditComponent);
    component = fixture.componentInstance;
  });

  function conRuta(id: string | number): void {
    (route.snapshot.paramMap.get as jest.Mock).mockReturnValue(String(id));
  }

  it('presenta una plantilla nueva con etiquetas persistentes y descripción editable', () => {
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Nueva plantilla semanal',
    );
    expect(
      el.querySelector('label[for="plantilla-nombre"]')?.textContent,
    ).toContain('Nombre de la plantilla');
    expect(
      el.querySelector('label[for="plantilla-descripcion"]')?.textContent,
    ).toContain('Descripción');
    expect(
      el.querySelector('label[for="plantilla-descripcion"]')?.textContent,
    ).not.toContain('*');

    const nombre = el.querySelector<HTMLInputElement>('#plantilla-nombre');
    const descripcion = el.querySelector<HTMLInputElement>(
      '#plantilla-descripcion',
    );
    expect(nombre).not.toBeNull();
    expect(descripcion).not.toBeNull();
    expect(nombre?.readOnly).toBe(false);
    expect(descripcion?.readOnly).toBe(false);
    expect(descripcion?.disabled).toBe(false);
    expect(descripcion?.required).toBe(false);
    expect(descripcion?.getAttribute('aria-required')).toBeNull();
    expect(descripcion?.placeholder).toBe('Objetivo de esta semana');
    expect(el.textContent).toContain(
      'También puedes pulsar una hora del calendario.',
    );
  });

  it('mantiene la descripción editable y conserva los datos al editar', async () => {
    conRuta(7);
    planificacionesService.getPlantillaSemanalById.mockReturnValue(
      of(plantilla()),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Editar plantilla semanal',
    );
    const nombre = el.querySelector<HTMLInputElement>('#plantilla-nombre');
    const descripcion = el.querySelector<HTMLInputElement>(
      '#plantilla-descripcion',
    );
    expect(nombre?.value).toBe('Repaso de hidráulica');
    expect(nombre?.readOnly).toBe(true);
    expect(descripcion?.value).toBe('Objetivo de la semana');
    expect(descripcion?.readOnly).toBe(false);
    expect(descripcion?.disabled).toBe(false);
    expect(component.events).toHaveLength(1);
  });

  it('trata una clonación como plantilla nueva y permite ajustar el nombre', async () => {
    conRuta(8);
    planificacionesService.getPlantillaSemanalById.mockReturnValue(
      of(plantilla({ id: 8, identificador: 'CLON Repaso de hidráulica' })),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe(
      'Nueva plantilla semanal',
    );
    expect(
      el.querySelector<HTMLInputElement>('#plantilla-nombre')?.readOnly,
    ).toBe(false);
  });

  it('no envía un formulario sin nombre y muestra validación accesible', async () => {
    fixture.detectChanges();

    await component.guardarPlantilla();
    fixture.detectChanges();

    expect(
      planificacionesService.createPlantillaSemanal$,
    ).not.toHaveBeenCalled();
    expect(component.formGroup.touched).toBe(true);
    const el: HTMLElement = fixture.nativeElement;
    const errores = el.querySelectorAll('[role="alert"]');
    expect(errores).toHaveLength(1);
    expect(errores[0].textContent).toContain('Escribe un nombre');
    expect(
      el.querySelector('#plantilla-nombre')?.getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      el.querySelector('#plantilla-descripcion')?.getAttribute('aria-invalid'),
    ).toBeNull();
  });

  it('habilita guardar con el nombre aunque la descripción esté vacía', () => {
    fixture.detectChanges();
    const guardar = fixture.nativeElement.querySelector('app-async-button');
    expect(guardar.disabled).toBe(true);

    component.formGroup.patchValue({ identificador: 'Repaso de hidráulica' });
    fixture.detectChanges();

    expect(component.formGroup.get('descripcion')?.value).toBeFalsy();
    expect(component.formGroup.valid).toBe(true);
    expect(guardar.disabled).toBe(false);
  });

  it('guarda con el flujo existente sin perder eventos ni valores cargados', async () => {
    conRuta(7);
    planificacionesService.getPlantillaSemanalById.mockReturnValue(
      of(plantilla()),
    );
    planificacionesService.createPlantillaSemanal$.mockReturnValue(
      of(plantilla()),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.guardarPlantilla();

    expect(planificacionesService.createPlantillaSemanal$).toHaveBeenCalledWith(
      {
        identificador: 'Repaso de hidráulica',
        descripcion: 'Objetivo de la semana',
        id: 7,
        subBloques: [
          expect.objectContaining({
            nombre: 'Hidráulica y mecánica',
            horaInicio: new Date(2026, 9, 28, 9, 0),
          }),
        ],
      },
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion/plantillas-semanales/7',
    ]);
  });

  it('guarda una plantilla existente con descripción vacía sin perder actividades', async () => {
    conRuta(7);
    const sinDescripcion = plantilla({ descripcion: '' });
    planificacionesService.getPlantillaSemanalById.mockReturnValue(
      of(sinDescripcion),
    );
    planificacionesService.createPlantillaSemanal$.mockReturnValue(
      of(sinDescripcion),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const descripcion = el.querySelector<HTMLInputElement>(
      '#plantilla-descripcion',
    );
    expect(descripcion?.value).toBe('');
    expect(descripcion?.getAttribute('aria-invalid')).toBeNull();
    expect(el.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(component.formGroup.valid).toBe(true);
    const guardar = el.querySelector('app-async-button') as
      | (HTMLElement & { disabled?: boolean })
      | null;
    expect(guardar).not.toBeNull();
    expect(guardar!.disabled).toBe(false);

    await component.guardarPlantilla();

    expect(planificacionesService.createPlantillaSemanal$).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        descripcion: '',
        subBloques: [
          expect.objectContaining({ nombre: 'Hidráulica y mecánica' }),
        ],
      }),
    );
  });

  it('una plantilla clonada con descripción vacía guarda el nombre ajustado y sus actividades', async () => {
    conRuta(8);
    planificacionesService.getPlantillaSemanalById.mockReturnValue(
      of(
        plantilla({
          id: 8,
          identificador: 'CLON Repaso de hidráulica',
          descripcion: '',
        }),
      ),
    );
    planificacionesService.createPlantillaSemanal$.mockReturnValue(
      of(
        plantilla({ id: 8, identificador: 'Repaso semanal', descripcion: '' }),
      ),
    );

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    component.formGroup.patchValue({ identificador: 'Repaso semanal' });
    await component.guardarPlantilla();

    expect(planificacionesService.createPlantillaSemanal$).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 8,
        identificador: 'Repaso semanal',
        descripcion: '',
        subBloques: [
          expect.objectContaining({ nombre: 'Hidráulica y mecánica' }),
        ],
      }),
    );
  });

  it('evita el doble envío mientras hay un guardado en curso', async () => {
    fixture.detectChanges();
    component.formGroup.patchValue({ identificador: 'Repaso de hidráulica' });
    const respuesta = new Subject<PlantillaSemanal>();
    planificacionesService.createPlantillaSemanal$.mockReturnValue(
      respuesta.asObservable(),
    );

    const primerEnvio = component.guardarPlantilla();
    const segundoEnvio = component.guardarPlantilla();
    respuesta.next(plantilla());
    respuesta.complete();
    await Promise.all([primerEnvio, segundoEnvio]);

    expect(
      planificacionesService.createPlantillaSemanal$,
    ).toHaveBeenCalledTimes(1);
    expect(planificacionesService.createPlantillaSemanal$).toHaveBeenCalledWith(
      expect.objectContaining({ descripcion: '' }),
    );
  });

  it('abre el menú existente del calendario con el día que muestra la vista', () => {
    fixture.detectChanges();
    const menuItems: MenuItem[] = [{ label: 'Añadir nuevo' }];
    const onTimeClicked = jest.fn();
    const vista = {
      getMenuItems: jest.fn(() => menuItems),
      onTimeClicked,
      viewDate: new Date(2026, 9, 30, 15, 30),
    } as unknown as VistaSemanalComponent;
    component.vistaSemanal = vista;
    const cm = { model: [] as MenuItem[] } as unknown as {
      model: MenuItem[];
    };
    const boton = document.createElement('button');
    boton.getBoundingClientRect = () =>
      ({
        left: 10,
        bottom: 40,
        top: 0,
        right: 0,
        width: 0,
        height: 0,
      }) as DOMRect;
    const evento = {
      currentTarget: boton,
      target: boton,
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    } as unknown as Event;

    component.abrirMenuActividades(cm as never, evento);

    expect(vista.getMenuItems).toHaveBeenCalledWith('ADMIN');
    expect(cm.model).toBe(menuItems);
    expect(onTimeClicked).toHaveBeenCalledTimes(1);
    const [datos, menu] = onTimeClicked.mock.calls[0];
    expect(menu).toBe(cm);
    expect(datos.date).toEqual(new Date(2026, 9, 30, 9, 0, 0, 0));
    expect(datos.sourceEvent.pageX).toBe(10);
    expect(datos.sourceEvent.pageY).toBe(40);
    expect(datos.sourceEvent.target).toBe(boton);
  });

  it('en móvil usa diaMovil para crear en el día realmente visible', () => {
    fixture.detectChanges();
    const onTimeClicked = jest.fn();
    component.vistaSemanal = {
      getMenuItems: () => [{ label: 'Añadir nuevo' }],
      onTimeClicked,
      viewDate: new Date(2026, 9, 26, 12, 0),
      esMovil: () => true,
      diaMovil: new Date(2026, 9, 31, 16, 45),
    } as unknown as VistaSemanalComponent;

    component.abrirMenuActividades(
      { model: [] } as never,
      {
        currentTarget: document.createElement('button'),
        target: document.createElement('button'),
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event,
    );

    const [datos] = onTimeClicked.mock.calls[0];
    expect(datos.date).toEqual(new Date(2026, 9, 31, 9, 0, 0, 0));
  });

  it('en escritorio mantiene viewDate aunque exista diaMovil', () => {
    fixture.detectChanges();
    const onTimeClicked = jest.fn();
    component.vistaSemanal = {
      getMenuItems: () => [{ label: 'Añadir nuevo' }],
      onTimeClicked,
      viewDate: new Date(2026, 9, 26, 12, 0),
      esMovil: () => false,
      diaMovil: new Date(2026, 9, 31, 16, 45),
    } as unknown as VistaSemanalComponent;

    component.abrirMenuActividades(
      { model: [] } as never,
      {
        currentTarget: document.createElement('button'),
        target: document.createElement('button'),
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event,
    );

    const [datos] = onTimeClicked.mock.calls[0];
    expect(datos.date).toEqual(new Date(2026, 9, 26, 9, 0, 0, 0));
  });

  it('si diaMovil no es válido cae en viewDate', () => {
    fixture.detectChanges();
    const onTimeClicked = jest.fn();
    component.vistaSemanal = {
      getMenuItems: () => [{ label: 'Añadir nuevo' }],
      onTimeClicked,
      viewDate: new Date(2026, 9, 26, 12, 0),
      esMovil: () => true,
      diaMovil: new Date(NaN),
    } as unknown as VistaSemanalComponent;

    component.abrirMenuActividades(
      { model: [] } as never,
      {
        currentTarget: document.createElement('button'),
        target: document.createElement('button'),
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      } as unknown as Event,
    );

    const [datos] = onTimeClicked.mock.calls[0];
    expect(datos.date).toEqual(new Date(2026, 9, 26, 9, 0, 0, 0));
  });

  it('usa una hora válida del día visible aunque la vista no exponga una fecha válida', () => {
    fixture.detectChanges();
    const onTimeClicked = jest.fn();
    component.vistaSemanal = {
      getMenuItems: () => [{ label: 'Añadir nuevo' }],
      onTimeClicked,
      viewDate: new Date(NaN),
    } as unknown as VistaSemanalComponent;
    const cm = { model: [] } as never;

    component.abrirMenuActividades(cm, {
      currentTarget: document.createElement('button'),
      target: document.createElement('button'),
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
    } as unknown as Event);

    const [datos] = onTimeClicked.mock.calls[0];
    expect(Number.isNaN(datos.date.getTime())).toBe(false);
    expect(datos.date.getHours()).toBe(9);
  });

  it('el CTA de añadir actividad es accesible y está visible', () => {
    fixture.detectChanges();
    const cta: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.plantilla-contenido__agregar',
    );
    expect(cta).not.toBeNull();
    expect(cta?.getAttribute('aria-haspopup')).toBe('menu');
    expect(cta?.textContent).toContain('Añadir actividad');
    expect(
      fixture.nativeElement.querySelector('#plantilla-contenido-titulo')
        ?.textContent,
    ).toContain('Contenido de la semana');
  });

  it('vuelve con Location cuando la navegación lo pide y al listado en caso contrario', () => {
    (route.snapshot.queryParamMap.get as jest.Mock).mockReturnValue('true');

    component.volver();

    expect(location.back).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalledWith([
      '/app/planificacion/plantillas-semanales',
    ]);

    (route.snapshot.queryParamMap.get as jest.Mock).mockReturnValue(null);
    component.volver();

    expect(router.navigate).toHaveBeenCalledWith([
      '/app/planificacion/plantillas-semanales',
    ]);
  });
});
