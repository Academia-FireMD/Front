import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { AppConfigService } from '../../services/app-config.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { ToastrService } from 'ngx-toastr';
import { EstadoModulos } from '../../shared/models/app-config.model';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog.component';

function makeMockAppConfigService(planificacionFisicaEnabled = true) {
  const estado = signal<EstadoModulos>(
    Object.values(ModuloApp).reduce((acc, key) => {
      acc[key] =
        key === ModuloApp.PLANIFICACION_FISICA
          ? planificacionFisicaEnabled
          : true;
      return acc;
    }, {} as EstadoModulos),
  );
  return {
    appConfig: signal({
      appName: 'AcmeAcademy',
      logoUrl: null,
      primaryColor: '#123456',
      secondaryColor: '#abcdef',
      updatedAt: '2026-05-21T10:00:00Z',
    }),
    estadoModulos: estado,
    isModuloHabilitado: (m: ModuloApp) => estado()[m] === true,
    modulosFailedToLoad: signal(false),
    isLoaded: signal(true),
    setEstado: estado.set.bind(estado),
  };
}

describe('EditarSubBloqueDialogComponent', () => {
  let fixture: ComponentFixture<EditarSubBloqueDialogComponent>;
  let component: EditarSubBloqueDialogComponent;
  let appConfigService: ReturnType<typeof makeMockAppConfigService>;
  let planificacionesService: jest.Mocked<Partial<PlanificacionesService>>;
  let toastrService: jest.Mocked<Partial<ToastrService>>;

  beforeEach(async () => {
    appConfigService = makeMockAppConfigService(true);
    planificacionesService = {
      buscarCatalogoContenido: jest.fn(() => of([])),
      componerContenidoCatalogo: jest.fn(() =>
        of({
          codigo: 'T01',
          nombre: 'Test compuesto',
          color: '#ff0000',
          comentarios: 'Comentarios compuestos',
        }),
      ),
    };
    toastrService = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn(),
      info: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [EditarSubBloqueDialogComponent],
      imports: [ReactiveFormsModule, FormsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: AppConfigService, useValue: appConfigService },
        {
          provide: PlanificacionesService,
          useValue: planificacionesService,
        },
        { provide: ToastrService, useValue: toastrService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(EditarSubBloqueDialogComponent);
    component = fixture.componentInstance;
  });

  it('expone el texto explicativo del bridge físico', () => {
    expect(component.textoExplicativoFisica).toContain(
      'El alumno verá este bloque',
    );
    expect(component.textoExplicativoFisica).toContain('planificación física');
  });

  it('el checkbox de entrenamiento físico empieza desmarcado', () => {
    expect(component.formGroup.get('esEntrenamientoFisico')?.value).toBe(false);
  });

  it('habilita el checkbox de entrenamiento físico para admin cuando PLANIFICACION_FISICA está activo', () => {
    expect(component.planificacionFisicaHabilitada()).toBe(true);
  });

  it('deshabilita el checkbox de entrenamiento físico para admin cuando PLANIFICACION_FISICA está OFF', () => {
    appConfigService.setEstado({
      ...appConfigService.estadoModulos(),
      [ModuloApp.PLANIFICACION_FISICA]: false,
    });

    expect(component.planificacionFisicaHabilitada()).toBe(false);
  });

  describe('setter de data — reset defensivo de esEntrenamientoFisico', () => {
    it('un payload antiguo sin esEntrenamientoFisico resetea el campo a false', () => {
      // Simular un diálogo anterior que dejó el campo a true.
      component.formGroup.patchValue({ esEntrenamientoFisico: true });
      expect(component.formGroup.get('esEntrenamientoFisico')?.value).toBe(
        true,
      );

      component.data = { id: 1, nombre: 'Bloque sin campo físico' };

      expect(component.formGroup.get('esEntrenamientoFisico')?.value).toBe(
        false,
      );
    });

    it('un payload con esEntrenamientoFisico=true conserva el valor true', () => {
      component.data = {
        id: 2,
        nombre: 'Bloque físico',
        esEntrenamientoFisico: true,
      };

      expect(component.formGroup.get('esEntrenamientoFisico')?.value).toBe(
        true,
      );
    });
  });

  describe('Fase 3 — catálogo de contenido', () => {
    it('la sección de catálogo no aparece para rol ALUMNO', () => {
      component.role = 'ALUMNO';
      component.data = { id: 1, nombre: 'Bloque normal' };

      expect(component.mostrarSeccionCatalogo).toBe(false);
    });

    it('la sección de catálogo no aparece cuando es entrenamiento físico', () => {
      component.role = 'ADMIN';
      component.data = { id: 1, esEntrenamientoFisico: true };

      expect(component.mostrarSeccionCatalogo).toBe(false);
    });

    it('la sección de catálogo aparece para ADMIN y bloque no físico', () => {
      component.role = 'ADMIN';
      component.data = { id: 1, nombre: 'Bloque normal' };

      expect(component.mostrarSeccionCatalogo).toBe(true);
    });

    it('buscarCatalogoContenido consulta al servicio y guarda sugerencias', () => {
      const items = [
        { id: 1, codigo: 'T01', nombreCorto: 'Tema 1', color: '#ff0000' },
      ];
      planificacionesService.buscarCatalogoContenido = jest.fn(() => of(items));

      component.buscarCatalogoContenido('T0');

      expect(
        planificacionesService.buscarCatalogoContenido,
      ).toHaveBeenCalledWith('T0');
      expect(component.catalogoSugerencias).toEqual(items);
    });

    it('rellenarDesdeCatalogo no hace nada si no hay código seleccionado', () => {
      component.catalogoItemSeleccionado = null;
      component.rellenarDesdeCatalogo();

      expect(
        planificacionesService.componerContenidoCatalogo,
      ).not.toHaveBeenCalled();
    });

    it('rellenarDesdeCatalogo patchea nombre, color y comentarios y actualiza el editor', () => {
      const setMarkdownSpy = jest.fn();
      component.editorComentarios = { setMarkdown: setMarkdownSpy } as any;
      component.catalogoItemSeleccionado = {
        id: 1,
        codigo: 'T01',
        nombreCorto: 'Tema 1',
        color: '#ff0000',
      };

      component.rellenarDesdeCatalogo();

      expect(
        planificacionesService.componerContenidoCatalogo,
      ).toHaveBeenCalledWith('T01', undefined);
      expect(component.formGroup.get('nombre')?.value).toBe('Test compuesto');
      expect(component.formGroup.get('color')?.value).toBe('#ff0000');
      expect(component.formGroup.get('comentarios')?.value).toBe(
        'Comentarios compuestos',
      );
      expect(setMarkdownSpy).toHaveBeenCalledWith('Comentarios compuestos');
      expect(toastrService.success).toHaveBeenCalledWith(
        'Bloque rellenado desde catálogo',
      );
    });

    it('rellenarDesdeCatalogo incluye el tipo de trabajo cuando se selecciona', () => {
      component.catalogoItemSeleccionado = {
        id: 1,
        codigo: 'T01',
        nombreCorto: 'Tema 1',
        color: '#ff0000',
      };
      component.tipoTrabajoSeleccionado = 'R1';

      component.rellenarDesdeCatalogo();

      expect(
        planificacionesService.componerContenidoCatalogo,
      ).toHaveBeenCalledWith('T01', 'R1');
    });

    it('error 404 en componer muestra toast de error y deja el formulario intacto', () => {
      const error = new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found',
      });
      planificacionesService.componerContenidoCatalogo = jest.fn(() =>
        throwError(() => error),
      );
      component.formGroup.patchValue({ nombre: 'Inicial', color: '#000000' });
      const nombreInicial = component.formGroup.get('nombre')?.value;
      const colorInicial = component.formGroup.get('color')?.value;
      component.catalogoItemSeleccionado = {
        id: 1,
        codigo: 'NOEXISTE',
        nombreCorto: 'No existe',
        color: '#000000',
      };

      component.rellenarDesdeCatalogo();

      expect(toastrService.error).toHaveBeenCalledWith(
        'Código no encontrado en el catálogo',
      );
      expect(component.formGroup.get('nombre')?.value).toBe(nombreInicial);
      expect(component.formGroup.get('color')?.value).toBe(colorInicial);
    });
  });
});
