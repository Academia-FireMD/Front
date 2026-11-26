import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule, Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  provideRouter,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { Paginator } from 'primeng/paginator';
import { environment } from '../../../environments/environment';
import { AppConfigService } from '../../services/app-config.service';
import { TemaService } from '../../services/tema.service';
import { GenericListComponent } from '../../shared/generic-list/generic-list.component';
import {
  PaginatedResult,
  PaginationFilter,
} from '../../shared/models/pagination.model';
import { Documento } from '../../shared/models/documentacion.model';
import { PrimengModule } from '../../shared/primeng.module';
import { DocumentosService } from '../services/documentacion.service';
import { of, Subject, throwError } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../testing';

import { DocumentationOverviewComponent } from './documentation-overview.component';

describe('DocumentationOverviewComponent', () => {
  let component: DocumentationOverviewComponent;
  let fixture: ComponentFixture<DocumentationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DocumentationOverviewComponent],
      providers: [...COMMON_TEST_PROVIDERS],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentationOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('el identificador ya NO es obligatorio en el formulario de subida (se autogenera)', () => {
    const control = component.uploadingFileFormGroup.controls['identificador'];
    control.setValue('');
    control.updateValueAndValidity();
    expect(control.valid).toBe(true);
  });

  it('envía un único tema en el alta y permite eliminarlo al editar', async () => {
    const upload = jest.fn().mockReturnValue(of({}));
    const update = jest.fn().mockReturnValue(of({}));
    (component as any).service = {
      uploadDocumento$: upload,
      updateDocumento$: update,
    };
    jest.spyOn(component as any, 'refresh').mockImplementation(() => {});
    component.uploadedFiles = [new File(['pdf'], 'tema.pdf')];
    component.uploadingFileFormGroup.patchValue({
      temaId: 9,
      isLocked: true,
      requireWatermark: true,
    });
    await component.subirDocumento();
    const data = upload.mock.calls[0][0] as FormData;
    expect(data.get('temaId')).toBe('9');
    expect(data.has('identificador')).toBe(false);
    expect(data.get('isLocked')).toBe('true');
    expect(data.get('requireWatermark')).toBe('true');
    component.abrirEditarDocumento({
      id: 19,
      identificador: 'Tema',
      temaId: 9,
    } as Documento);
    expect(component.editarDocumentoForm.controls.temaId.value).toBe(9);
    component.editarDocumentoForm.controls.temaId.setValue(null);
    await component.guardarCambiosDocumento();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 19, temaId: null }),
    );
  });

  it('propone el nombre sin tema y permite corregir un identificador repetido conservando el archivo', async () => {
    const subida = jest
      .fn()
      .mockReturnValueOnce(
        throwError(() => new Error('El identificador ya está en uso.')),
      )
      .mockReturnValueOnce(of({ id: 19 } as Documento));
    component.service = {
      uploadDocumento$: subida,
    } as unknown as DocumentosService;
    jest.spyOn(component as any, 'refresh').mockImplementation(() => {});
    const archivo = new File(['pdf'], 'Plano del término.pdf');
    component.seleccionarArchivos([archivo]);
    component.uploadingFileFormGroup.controls.isLocked.setValue(true);
    await component.subirDocumento();
    expect(component.errorSubida).toContain('ya está en uso');
    expect(component.uploadedFiles).toEqual([archivo]);
    expect(subida.mock.calls[0][0].get('identificador')).toBe(
      'Plano del término',
    );
    component.uploadingFileFormGroup.controls.identificador.setValue(
      'Plano revisado',
    );
    await component.subirDocumento();
    const datos = subida.mock.calls[1][0];
    expect(datos.get('identificador')).toBe('Plano revisado');
    expect(datos.has('temaId')).toBe(false);
    expect(datos.get('isLocked')).toBe('true');
  });

  it('publicarDocumento llama al servicio, marca isPublicado y refresca', async () => {
    const doc: any = { id: 42, identificador: 'DM5.001', isPublicado: false };
    // El DocumentosService de COMMON_TEST_PROVIDERS es un Proxy que devuelve un
    // jest.fn nuevo por acceso, así que inyectamos un fake concreto espiable.
    const publicarSpy = jest
      .fn()
      .mockReturnValue(of({ id: 42, isPublicado: true }));
    (component as any).service = { publicarDocumento$: publicarSpy };
    const refreshSpy = jest
      .spyOn(component as any, 'refresh')
      .mockImplementation(() => {});
    jest
      .spyOn((component as any).toast, 'success')
      .mockImplementation(() => {});

    await component.publicarDocumento(doc);

    expect(publicarSpy).toHaveBeenCalledWith(42);
    expect(doc.isPublicado).toBe(true);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('confirmarPublicacion abre el diálogo de confirmación', () => {
    const doc: any = { id: 7, identificador: 'DM5.007', isPublicado: false };
    const confirmSpy = jest
      .spyOn(component.confirmationService, 'confirm')
      .mockImplementation(() => component.confirmationService);

    component.confirmarPublicacion(doc);

    expect(confirmSpy).toHaveBeenCalled();
    expect(confirmSpy.mock.calls[0][0].header).toBe('Confirmar publicación');
  });

  it('despublicarDocumento llama al servicio, aplica isPublicado del backend y refresca', async () => {
    const doc: any = { id: 42, identificador: 'DM5.001', isPublicado: true };
    const despublicarSpy = jest
      .fn()
      .mockReturnValue(of({ id: 42, isPublicado: false }));
    (component as any).service = { despublicarDocumento$: despublicarSpy };
    const refreshSpy = jest
      .spyOn(component as any, 'refresh')
      .mockImplementation(() => {});
    jest
      .spyOn((component as any).toast, 'success')
      .mockImplementation(() => {});

    await component.despublicarDocumento(doc);

    expect(despublicarSpy).toHaveBeenCalledWith(42);
    expect(doc.isPublicado).toBe(false);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('despublicarDocumento avisa (warning, no success) si el backend dice que sigue publicado por otra audiencia', async () => {
    const doc: any = { id: 55, identificador: 'DM5.055', isPublicado: true };
    // El backend lo quita del cubo público pero sigue cubierto por otra release activa.
    const despublicarSpy = jest
      .fn()
      .mockReturnValue(of({ id: 55, isPublicado: true }));
    (component as any).service = { despublicarDocumento$: despublicarSpy };
    jest.spyOn(component as any, 'refresh').mockImplementation(() => {});
    const successSpy = jest
      .spyOn((component as any).toast, 'success')
      .mockImplementation(() => {});
    const warningSpy = jest
      .spyOn((component as any).toast, 'warning')
      .mockImplementation(() => {});
    // toast es singleton compartido entre tests → asertar por DELTA, no por
    // total (mismo motivo que el confirmSpy usa calls[length-1]).
    const successBefore = successSpy.mock.calls.length;
    const warningBefore = warningSpy.mock.calls.length;

    await component.despublicarDocumento(doc);

    expect(doc.isPublicado).toBe(true);
    expect(warningSpy.mock.calls.length).toBe(warningBefore + 1);
    expect(successSpy.mock.calls.length).toBe(successBefore);
  });

  it('confirmarDespublicacion abre el diálogo de confirmación', () => {
    const doc: any = { id: 7, identificador: 'DM5.007', isPublicado: true };
    const confirmSpy = jest
      .spyOn(component.confirmationService, 'confirm')
      .mockImplementation(() => component.confirmationService);

    component.confirmarDespublicacion(doc);

    expect(confirmSpy).toHaveBeenCalled();
    // ConfirmationService es un singleton compartido entre tests, así que el spy
    // puede acumular llamadas previas; validamos la última (la de este test).
    const lastCall = confirmSpy.mock.calls[confirmSpy.mock.calls.length - 1];
    expect(lastCall[0].header).toBe('Confirmar despublicación');
  });
});

@Component({ standalone: true, template: '' })
class DestinoLibrilloFixture {}

describe('Documentación administrativa con paginación compartida', () => {
  const librillosMenu = environment.librillosMenu;

  beforeEach(() => {
    environment.librillosMenu = true;
  });

  afterEach(() => {
    environment.librillosMenu = librillosMenu;
  });

  it('restaura filtros y página real, y navega de forma independiente desde la fila', async () => {
    const inicial = new Subject<PaginatedResult<Documento>>();
    const documento = {
      id: 19,
      identificador: 'Tema 9',
      fileName: 'tema.pdf',
      temaId: 9,
      tema: { id: 9, numero: 9 },
      esPublico: true,
    } as Documento;
    const respuesta = (paginacion: PaginationFilter) => ({
      data: [documento, { ...documento, id: 20, fileName: 'programa.docx' }],
      pagination: { ...paginacion, count: 39 },
    });
    const listar = jest
      .fn((paginacion: PaginationFilter) => of(respuesta(paginacion)))
      .mockReturnValueOnce(inicial);
    await TestBed.configureTestingModule({
      declarations: [DocumentationOverviewComponent],
      imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        GenericListComponent,
        NoopAnimationsModule,
        PrimengModule,
        RouterLink,
      ],
      providers: [
        ...COMMON_TEST_PROVIDERS.filter(
          (provider) =>
            !(
              'provide' in provider &&
              [
                ActivatedRoute,
                Router,
                Location,
                PrimeNGConfig,
                ConfirmationService,
              ].includes(provider.provide)
            ),
        ),
        provideRouter([
          {
            path: 'app/documentacion',
            component: DocumentationOverviewComponent,
            data: { expectedRole: 'ADMIN' },
          },
          {
            path: 'app/documentacion/librillo/editor/:documentoId',
            component: DestinoLibrilloFixture,
          },
        ]),
        provideLocationMocks(),
        ConfirmationService,
        {
          provide: DocumentosService,
          useValue: { getDocumentosPublicos$: listar },
        },
        {
          provide: AppConfigService,
          useValue: { isModuloHabilitado: () => true },
        },
        { provide: TemaService, useValue: { getAllTemas$: () => of([]) } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const harness = await RouterTestingHarness.create(
      '/app/documentacion?searchTerm=tema&skip=20&take=10&createdAt=1700000000000,1700100000000&temaId=9,12&isLocked=false&requireWatermark=true&pagina=5&referencia=8',
    );
    const vista = harness.routeDebugElement!;
    const overview = vista.componentInstance as DocumentationOverviewComponent;
    const lista = vista.query(By.directive(GenericListComponent))
      .componentInstance as GenericListComponent<Documento>;
    const esperada = {
      skip: 20,
      take: 10,
      searchTerm: 'tema',
      where: {
        createdAt: {
          gte: new Date(1700000000000),
          lte: new Date(1700100000000),
        },
        temaId: { in: [9, 12] },
        requireWatermark: true,
      },
    };
    expect(listar.mock.calls).toEqual([[esperada]]);
    expect(lista.pagination).toBe(overview.pagination);
    expect(lista.getFilterControl('isLocked').value).toBe(false);
    expect(lista.getFilterControl('requireWatermark').value).toBe(true);
    expect(lista.getFilterControl('temaId').value).toEqual([9, 12]);
    expect(vista.query(By.directive(Paginator))).toBeNull();

    inicial.next(respuesta(esperada));
    inicial.complete();
    harness.detectChanges();
    const pagina = vista.query(By.directive(Paginator));
    expect(pagina.componentInstance.first).toBe(20);
    expect(pagina.componentInstance.totalRecords).toBe(39);
    pagina.nativeElement.querySelector('button.p-paginator-next').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(listar.mock.calls).toEqual([
      [esperada],
      [{ ...esperada, skip: 30 }],
    ]);

    const router = TestBed.inject(Router);
    const enlaces = vista.nativeElement.querySelectorAll('a.enlace-librillo');
    expect(enlaces).toHaveLength(1);
    const enlace = enlaces[0] as HTMLAnchorElement;
    const destino = router.parseUrl(enlace.getAttribute('href')!);
    expect(destino.queryParams).toEqual({
      skip: '30',
      take: '10',
      searchTerm: 'tema',
      createdAt: '1700000000000,1700100000000',
      temaId: '9,12',
      isLocked: 'false',
      requireWatermark: 'true',
    });

    overview.abrirEditarDocumento(documento);
    harness.detectChanges();
    const enlaceModal = vista.nativeElement.querySelector(
      'p-dialog a[href*="/librillo/editor/"]',
    );
    expect(enlaceModal?.getAttribute('href')).toBe(enlace.getAttribute('href'));
    overview.mostrarEditarDocumento = false;
    harness.detectChanges();

    lista.clearFilters();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(listar.mock.calls).toEqual([
      [esperada],
      [{ ...esperada, skip: 30 }],
      [{ skip: 0, take: 10, searchTerm: 'tema', where: undefined }],
    ]);

    const descarga = jest
      .spyOn(overview, 'descargarDocumento')
      .mockResolvedValue(undefined);
    const editar = jest
      .spyOn(overview, 'abrirEditarDocumento')
      .mockImplementation(() => {});
    const enlaceActivo = vista.nativeElement.querySelector(
      'a.enlace-librillo',
    ) as HTMLAnchorElement;
    enlaceActivo.click();
    await harness.fixture.whenStable();
    expect(router.url).toMatch(/^\/app\/documentacion\/librillo\/editor\/19\?/);
    expect(descarga).not.toHaveBeenCalled();
    expect(editar).not.toHaveBeenCalled();
  });
});
