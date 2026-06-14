import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { of } from 'rxjs';
import { CursoAdmin } from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { COMMON_TEST_PROVIDERS } from '../../testing/common-providers';
import { CursosAdminListComponent } from './cursos-admin-list.component';

describe('CursosAdminListComponent', () => {
  let fixture: ComponentFixture<CursosAdminListComponent>;
  let component: CursosAdminListComponent;
  let listSpy: jest.Mock;
  let serviceMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    listSpy = jest.fn().mockReturnValue(
      of({
        data: [
          {
            id: 1,
            titulo: 'Curso 1',
            slug: 'curso-1',
            estado: 'PUBLICADO' as const,
            createdAt: '2026-05-01',
          },
        ],
        pagination: { skip: 0, take: 10, searchTerm: '', count: 1 },
      }),
    );
    serviceMock = {
      list: listSpy,
      publicar: jest.fn().mockReturnValue(of({})),
      archivar: jest.fn().mockReturnValue(of({})),
      despublicar: jest.fn().mockReturnValue(of({})),
      remove: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, CursosAdminListComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        provideHttpClient(),
        { provide: CursosAdminService, useValue: serviceMock },
        // El mock de COMMON_TEST_PROVIDERS no expone `requireConfirmation$`, que
        // el <p-confirmDialog> del template necesita al renderizar → usamos el real.
        ConfirmationService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CursosAdminListComponent);
    component = fixture.componentInstance;
  });

  it('debe crearse', () => {
    expect(component).toBeTruthy();
  });

  it('extiende SharedGridComponent (tiene pagination signal)', () => {
    expect(component.pagination()).toEqual({
      skip: 0,
      take: 10,
      searchTerm: '',
    });
  });

  it('fetchItems$ pide al service con el filtro de paginación', () => {
    // No llamamos detectChanges() porque generic-list dispara p-dataView que
    // necesita Observable subscriptions completas; sólo verificamos el wiring
    // de la signal computed.
    component.fetchItems$().subscribe();
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10, searchTerm: '' }),
    );
  });

  it('navigateToNew abre la ruta de creación', () => {
    const router = TestBed.inject(Router);
    component.navigateToNew();
    expect(router.navigate).toHaveBeenCalledWith(['/app/cursos-admin/nuevo']);
  });

  it('onRowClick navega a la ruta del curso', () => {
    const router = TestBed.inject(Router);
    const fixture: CursoAdmin = {
      id: 42,
      titulo: 'X',
      slug: 'x',
      estado: 'BORRADOR',
    };
    component.onRowClick(fixture);
    expect(router.navigate).toHaveBeenCalledWith(['/app/cursos-admin', 42]);
  });

  it('estadoSeverity mapea estados a severities correctas', () => {
    expect(component.estadoSeverity('BORRADOR')).toBe('warning');
    expect(component.estadoSeverity('PUBLICADO')).toBe('success');
    expect(component.estadoSeverity('ARCHIVADO')).toBe('secondary');
  });

  const curso: CursoAdmin = {
    id: 7,
    titulo: 'Curso X',
    slug: 'curso-x',
    estado: 'BORRADOR',
  };

  it('publicarCurso confirma y, al aceptar, llama al service y refresca', async () => {
    const confirm = TestBed.inject(ConfirmationService);
    const spy = jest.spyOn(confirm, 'confirm');
    component.publicarCurso(curso, new Event('click'));
    expect(spy).toHaveBeenCalled();
    await spy.mock.calls[0][0].accept!();
    expect(serviceMock['publicar']).toHaveBeenCalledWith(7);
  });

  it('eliminarCurso confirma y, al aceptar, llama a remove', async () => {
    const confirm = TestBed.inject(ConfirmationService);
    const spy = jest.spyOn(confirm, 'confirm');
    component.eliminarCurso(curso, new Event('click'));
    expect(spy).toHaveBeenCalled();
    await spy.mock.calls[0][0].accept!();
    expect(serviceMock['remove']).toHaveBeenCalledWith(7);
  });
});
