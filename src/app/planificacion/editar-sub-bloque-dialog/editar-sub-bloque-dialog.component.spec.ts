import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COMMON_TEST_PROVIDERS } from '../../testing';
import { AppConfigService } from '../../services/app-config.service';
import { EstadoModulos } from '../../shared/models/app-config.model';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { EditarSubBloqueDialogComponent } from './editar-sub-bloque-dialog.component';

describe('EditarSubBloqueDialogComponent', () => {
  let component: EditarSubBloqueDialogComponent;
  const estado = signal<EstadoModulos>({
    [ModuloApp.PLANIFICACION_FISICA]: true,
  } as EstadoModulos);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarSubBloqueDialogComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: AppConfigService, useValue: { estadoModulos: estado } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    component = TestBed.createComponent(
      EditarSubBloqueDialogComponent,
    ).componentInstance;
    component.role = 'ADMIN';
  });

  it('mantiene la edición física disponible solo si está activo el módulo', () => {
    estado.set({ [ModuloApp.PLANIFICACION_FISICA]: true } as EstadoModulos);
    expect(component.planificacionFisicaHabilitada()).toBe(true);
    estado.set({ [ModuloApp.PLANIFICACION_FISICA]: false } as EstadoModulos);
    expect(component.planificacionFisicaHabilitada()).toBe(false);
  });

  it('resetea el flag físico cuando un dato antiguo no lo contiene', () => {
    component.formGroup.patchValue({ esEntrenamientoFisico: true });
    component.data = { id: 1, nombre: 'Contenido', duracion: 60 };
    expect(component.formGroup.get('esEntrenamientoFisico')?.value).toBe(false);
  });

  it('permite editar una copia del catálogo sin alterar su procedencia ni el Markdown', async () => {
    component.data = {
      id: 4,
      catalogoContenidoId: 9,
      nombre: 'Original',
      comentarios: '**Contenido**',
      color: '#abcdef',
      duracion: 75,
    };
    expect(component.formGroup.get('nombre')?.enabled).toBe(true);
    component.formGroup.patchValue({
      nombre: 'Personalizado',
      comentarios: '## Revisado',
    });
    const emit = jest.spyOn(component.savedSubBloque, 'emit');
    await component.guardarEdicion();
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogoContenidoId: 9,
        nombre: 'Personalizado',
        comentarios: '## Revisado',
        duracion: 75,
      }),
    );
  });
});
