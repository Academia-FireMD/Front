import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { EstadoModulos } from '../models/app-config.model';
import { ModuloApp } from '../models/modulo-app.enum';
import { Rol, Usuario } from '../models/user.model';
import { AppMenuItem, LayoutComponent } from './layout.component';

function makeUser(rol: Rol): Usuario {
  return {
    id: 1,
    email: 'x@y.com',
    rol,
    nombre: 'X',
    apellidos: 'Y',
    suscripciones: [],
  } as any;
}

function makeMockAppConfigService(allEnabled = true) {
  const cfg = signal({
    appName: 'A',
    logoUrl: null,
    primaryColor: '#FF0000',
    secondaryColor: '#00FF00',
    updatedAt: '2026-05-21T10:00:00Z',
  });
  const estado = signal<EstadoModulos>(
    Object.values(ModuloApp).reduce((acc, key) => {
      acc[key] = allEnabled;
      return acc;
    }, {} as EstadoModulos),
  );
  return {
    appConfig: cfg,
    estadoModulos: estado,
    isModuloHabilitado: (m: ModuloApp) => estado()[m] === true,
    modulosFailedToLoad: signal(false),
    isLoaded: signal(true),
    setEstado: estado.set.bind(estado),
  };
}

function findItemByLabel(
  items: AppMenuItem[],
  label: string,
): AppMenuItem | undefined {
  for (const i of items) {
    if (i.label === label) return i;
    if (i.items) {
      const found = findItemByLabel(i.items as AppMenuItem[], label);
      if (found) return found;
    }
  }
  return undefined;
}

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let appConfigService: ReturnType<typeof makeMockAppConfigService>;

  beforeEach(async () => {
    appConfigService = makeMockAppConfigService(true);
    await TestBed.configureTestingModule({
      declarations: [LayoutComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: AppConfigService, useValue: appConfigService },
        {
          provide: AuthService,
          useValue: {
            currentUser$: of(null),
            isImpersonating: () => false,
            logout$: () => of(true),
            stopImpersonation$: () => of({}),
            decodeToken: () => null,
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // -------- D18 filter recursivo (T1) --------
  it('filterByModulo: parent TEST=OFF + child FLASHCARDS=ON → ambos ocultos', () => {
    const items: AppMenuItem[] = [
      {
        label: 'Test',
        modulo: ModuloApp.TEST,
        items: [
          { label: 'Realizar tests', modulo: ModuloApp.TEST },
          { label: 'Flashcards (override)', modulo: ModuloApp.FLASHCARDS },
        ],
      },
      { label: 'Profile' },
    ];
    const modulos = appConfigService.estadoModulos();
    const filtered = component.filterByModulo(
      items,
      { ...modulos, [ModuloApp.TEST]: false, [ModuloApp.FLASHCARDS]: true },
      false,
    );
    expect(findItemByLabel(filtered, 'Test')).toBeUndefined();
    expect(findItemByLabel(filtered, 'Flashcards (override)')).toBeUndefined();
    expect(findItemByLabel(filtered, 'Profile')).toBeDefined();
  });

  it('ALUMNO ve menú filtrado (TEST oculto si TEST=OFF)', () => {
    appConfigService.setEstado({
      ...appConfigService.estadoModulos(),
      [ModuloApp.TEST]: false,
    });
    const items: AppMenuItem[] = [
      { label: 'Test', modulo: ModuloApp.TEST, items: [{ label: 'X' }] },
      { label: 'Profile' },
    ];
    const filtered = component.filterByModulo(
      items,
      appConfigService.estadoModulos(),
      false,
    );
    expect(findItemByLabel(filtered, 'Test')).toBeUndefined();
  });

  it('filterByModulo: enlace directo con items:[] sobrevive (regresión Documentos/Planificación 2026-06-04)', () => {
    const items: AppMenuItem[] = [
      {
        label: 'Documentos',
        routerLink: '/app/documentacion/alumno',
        modulo: ModuloApp.DOCUMENTACION,
        items: [],
      },
      {
        label: 'Planificación mensual',
        routerLink: '/app/planificacion/planificacion-mensual-alumno',
        modulo: ModuloApp.PLANIFICACION,
        items: [],
      },
      { label: 'Submenú vacío', items: [] }, // sin routerLink → debe podarse
    ];
    const modulos = appConfigService.estadoModulos();
    const filtered = component.filterByModulo(
      items,
      {
        ...modulos,
        [ModuloApp.DOCUMENTACION]: true,
        [ModuloApp.PLANIFICACION]: true,
      },
      false,
    );
    // Enlaces directos con items:[] NO se podan; el submenú vacío sí.
    expect(findItemByLabel(filtered, 'Documentos')).toBeDefined();
    expect(findItemByLabel(filtered, 'Planificación mensual')).toBeDefined();
    expect(findItemByLabel(filtered, 'Submenú vacío')).toBeUndefined();
  });

  it('SUPERADMIN ve todo incluso si módulos OFF', () => {
    appConfigService.setEstado({
      ...appConfigService.estadoModulos(),
      [ModuloApp.TEST]: false,
    });
    const items: AppMenuItem[] = [
      { label: 'Test', modulo: ModuloApp.TEST, items: [{ label: 'X' }] },
    ];
    const filtered = component.filterByModulo(
      items,
      appConfigService.estadoModulos(),
      true,
    );
    expect(findItemByLabel(filtered, 'Test')).toBeDefined();
  });

  it('SUPERADMIN ve entrada Configuración; ADMIN no', () => {
    (component as any).currentUserSignal.set(makeUser(Rol.SUPERADMIN));
    const superItems = component.items();
    expect(findItemByLabel(superItems, 'Configuración')).toBeDefined();

    (component as any).currentUserSignal.set(makeUser(Rol.ADMIN));
    const adminItems = component.items();
    expect(findItemByLabel(adminItems, 'Configuración')).toBeUndefined();
  });

  // -------- T5 logo fallback --------
  it('onLogoError cae al fallback /white_logo.png', () => {
    const img = document.createElement('img');
    img.src = 'https://broken/logo.png';
    const event = { target: img } as unknown as Event;
    component.onLogoError(event);
    expect(img.src).toContain('/white_logo.png');
  });
});
