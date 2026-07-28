import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { AppConfigService } from '../../services/app-config.service';
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

  beforeEach(async () => {
    appConfigService = makeMockAppConfigService(true);
    await TestBed.configureTestingModule({
      declarations: [EditarSubBloqueDialogComponent],
      imports: [ReactiveFormsModule],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: AppConfigService, useValue: appConfigService },
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
});
