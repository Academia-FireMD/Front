import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { PreguntasFallosOverviewComponent } from './preguntas-fallos-overview.component';

describe('PreguntasFallosOverviewComponent', () => {
  let component: PreguntasFallosOverviewComponent;
  let fixture: ComponentFixture<PreguntasFallosOverviewComponent>;
  let mockReportesFalloService: {
    getReporteFallos$: jest.Mock;
    getReporteFallosFlashcards$: jest.Mock;
    deleteReporteFallo$: jest.Mock;
    exportarFallos$: jest.Mock;
  };

  beforeEach(async () => {
    mockReportesFalloService = {
      getReporteFallos$: jest.fn(() =>
        of({
          data: [],
          pagination: { take: 10, skip: 0, searchTerm: '', count: 0 },
        }),
      ),
      getReporteFallosFlashcards$: jest.fn(() => of(null)),
      deleteReporteFallo$: jest.fn(() => of(null)),
      exportarFallos$: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [PreguntasFallosOverviewComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: ReportesFalloService, useValue: mockReportesFalloService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(PreguntasFallosOverviewComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('abrirExportDialog', () => {
    it('should reset formato to excel and open the dialog', () => {
      component.formatoExport = 'word';
      component.mostrarExportDialog = false;

      component.abrirExportDialog();

      expect(component.formatoExport).toBe('excel');
      expect(component.mostrarExportDialog).toBe(true);
    });
  });

  describe('exportarFallos', () => {
    function setupUrlMocks() {
      (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest
        .fn()
        .mockReturnValue('blob:http://localhost/fake');
      (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
        jest.fn();
    }

    it('should call exportarFallos$ with type=test and current where filters, then trigger anchor download', async () => {
      const mockBlob = new Blob(['data'], { type: 'application/xlsx' });
      mockReportesFalloService.exportarFallos$.mockReturnValue(of(mockBlob));

      component.pagination.set({
        skip: 0,
        take: 10,
        searchTerm: '',
        where: { pregunta: { relevancia: ['VALENCIA_AYUNTAMIENTO'] } },
      });
      component.formatoExport = 'excel';

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      setupUrlMocks();

      await component.exportarFallos();

      expect(mockReportesFalloService.exportarFallos$).toHaveBeenCalledWith(
        { pregunta: { relevancia: ['VALENCIA_AYUNTAMIENTO'] } },
        'test',
        'excel',
      );
      expect(mockLink.download).toMatch(
        /^fallos_test_\d{4}-\d{2}-\d{2}\.xlsx$/,
      );
      expect(mockLink.click).toHaveBeenCalled();
      expect(
        (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL,
      ).toHaveBeenCalledWith('blob:http://localhost/fake');
    });

    it('should use .docx extension when formato=word', async () => {
      const mockBlob = new Blob(['data']);
      mockReportesFalloService.exportarFallos$.mockReturnValue(of(mockBlob));

      component.pagination.set({ skip: 0, take: 10, searchTerm: '' });
      component.formatoExport = 'word';

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      setupUrlMocks();

      await component.exportarFallos();

      expect(mockReportesFalloService.exportarFallos$).toHaveBeenCalledWith(
        undefined,
        'test',
        'word',
      );
      expect(mockLink.download).toMatch(
        /^fallos_test_\d{4}-\d{2}-\d{2}\.docx$/,
      );
    });

    it('should reset exportando to false after completion', async () => {
      const mockBlob = new Blob(['data']);
      mockReportesFalloService.exportarFallos$.mockReturnValue(of(mockBlob));

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      setupUrlMocks();

      expect(component.exportando).toBe(false);
      await component.exportarFallos();
      expect(component.exportando).toBe(false);
    });

    it('should close the dialog after successful export', async () => {
      const mockBlob = new Blob(['data']);
      mockReportesFalloService.exportarFallos$.mockReturnValue(of(mockBlob));

      component.mostrarExportDialog = true;
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      setupUrlMocks();

      await component.exportarFallos();

      expect(component.mostrarExportDialog).toBe(false);
    });
  });
});
