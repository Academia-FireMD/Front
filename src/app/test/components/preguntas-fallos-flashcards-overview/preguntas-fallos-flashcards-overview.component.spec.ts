import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { COMMON_TEST_PROVIDERS } from '../../../testing';
import { ReportesFalloService } from '../../../services/reporte-fallo.service';
import { PreguntasFallosFlashcardsOverviewComponent } from './preguntas-fallos-flashcards-overview.component';

describe('PreguntasFallosFlashcardsOverviewComponent', () => {
  let component: PreguntasFallosFlashcardsOverviewComponent;
  let fixture: ComponentFixture<PreguntasFallosFlashcardsOverviewComponent>;
  let mockReportesFalloService: {
    getReporteFallos$: jest.Mock;
    getReporteFallosFlashcards$: jest.Mock;
    deleteReporteFallo$: jest.Mock;
    exportarFallos$: jest.Mock;
  };

  beforeEach(async () => {
    mockReportesFalloService = {
      getReporteFallos$: jest.fn(() => of(null)),
      getReporteFallosFlashcards$: jest.fn(() =>
        of({
          data: [],
          pagination: { take: 10, skip: 0, searchTerm: '', count: 0 },
        }),
      ),
      deleteReporteFallo$: jest.fn(() => of(null)),
      exportarFallos$: jest.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [PreguntasFallosFlashcardsOverviewComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: ReportesFalloService, useValue: mockReportesFalloService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(
      PreguntasFallosFlashcardsOverviewComponent,
    );
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('abrirExportDialog', () => {
    it('should open the dialog', () => {
      component.mostrarExportDialog = false;

      component.abrirExportDialog();

      expect(component.mostrarExportDialog).toBe(true);
    });
  });

  describe('onExportar', () => {
    function setupUrlMocks() {
      (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest
        .fn()
        .mockReturnValue('blob:http://localhost/fake');
      (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
        jest.fn();
    }

    it('should call exportarFallos$ with type=flashcards and given filtros/formato, then trigger anchor download', async () => {
      const mockBlob = new Blob(['data'], { type: 'application/xlsx' });
      mockReportesFalloService.exportarFallos$.mockReturnValue(of(mockBlob));

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      setupUrlMocks();

      await component.onExportar({
        filtros: { temas: [3, 7] },
        formato: 'excel',
      });

      expect(mockReportesFalloService.exportarFallos$).toHaveBeenCalledWith(
        { temas: [3, 7] },
        'flashcards',
        'excel',
      );
      expect(mockLink.download).toMatch(
        /^fallos_flashcards_\d{4}-\d{2}-\d{2}\.xlsx$/,
      );
      expect(mockLink.click).toHaveBeenCalled();
      expect(
        (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL,
      ).toHaveBeenCalledWith('blob:http://localhost/fake');
    });

    it('should use .docx extension when formato=word', async () => {
      const mockBlob = new Blob(['data']);
      mockReportesFalloService.exportarFallos$.mockReturnValue(of(mockBlob));

      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
      } as unknown as HTMLAnchorElement;
      jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
      setupUrlMocks();

      await component.onExportar({ filtros: {}, formato: 'word' });

      expect(mockReportesFalloService.exportarFallos$).toHaveBeenCalledWith(
        {},
        'flashcards',
        'word',
      );
      expect(mockLink.download).toMatch(
        /^fallos_flashcards_\d{4}-\d{2}-\d{2}\.docx$/,
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
      await component.onExportar({ filtros: {}, formato: 'excel' });
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

      await component.onExportar({ filtros: {}, formato: 'excel' });

      expect(component.mostrarExportDialog).toBe(false);
    });
  });
});
