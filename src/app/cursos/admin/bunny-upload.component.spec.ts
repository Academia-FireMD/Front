import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { of, throwError } from 'rxjs';
import * as tus from 'tus-js-client';
import { TusCredentials } from '../models/curso.model';
import { CursosAdminService } from '../services/cursos-admin.service';
import { BunnyUploadComponent, UploadedEvent } from './bunny-upload.component';

// `tus-js-client` hace una subida real (XHR/fetch) que no queremos ejecutar
// en jsdom. Mockeamos el constructor `Upload` capturando las `options` que
// le pasa el componente (incluido `onSuccess`/`onError`/`onProgress`) para
// poder disparar esos callbacks manualmente desde cada test.
jest.mock('tus-js-client', () => ({
  Upload: jest.fn(),
}));

/**
 * Miembros `protected`/`private` del componente que los tests necesitan
 * inspeccionar/espiar directamente. Mismo patrón de cast estrecho usado en
 * `curso-admin-edit.component.spec.ts` para `confirmation` — evita `any`
 * mientras da acceso a lo que TypeScript oculta desde fuera de la clase.
 */
type BunnyUploadInternals = {
  uploading: () => boolean;
  selectedFile: () => File | null;
  progress: () => number;
  done: () => boolean;
  leerDuracionVideo: (file: File) => Promise<number | null>;
};
const internals = (c: BunnyUploadComponent) =>
  c as unknown as BunnyUploadInternals;

type TusUploadOptions = {
  onError: (err: Error) => void;
  onProgress: (sent: number, total: number) => void;
  onSuccess: () => void;
};

describe('BunnyUploadComponent', () => {
  let fixture: ComponentFixture<BunnyUploadComponent>;
  let component: BunnyUploadComponent;
  let serviceMock: { requestVideoUploadUrl: jest.Mock };
  let toastMock: { error: jest.Mock; success: jest.Mock; warning: jest.Mock };
  let lastUploadOptions: TusUploadOptions | undefined;
  let lastUploadStart: jest.Mock;

  const credentials: TusCredentials = {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    VideoId: 'video-guid-1',
    LibraryId: 'lib-1',
    AuthorizationSignature: 'sig',
    AuthorizationExpire: 123456,
  };

  const buildFile = (name = 'clase.mp4'): File =>
    new File(['contenido-fake'], name, { type: 'video/mp4' });

  /** Construye un `Event` de `<input type="file">` sin necesitar el DOM real. */
  const buildChangeEvent = (file: File | null): Event => {
    const input = document.createElement('input');
    input.type = 'file';
    if (file) {
      Object.defineProperty(input, 'files', { value: [file] });
    }
    return { target: input } as unknown as Event;
  };

  beforeEach(async () => {
    serviceMock = {
      requestVideoUploadUrl: jest.fn().mockReturnValue(of(credentials)),
    };
    toastMock = { error: jest.fn(), success: jest.fn(), warning: jest.fn() };
    lastUploadOptions = undefined;
    lastUploadStart = jest.fn();

    (tus.Upload as unknown as jest.Mock)
      .mockReset()
      .mockImplementation((_file: File, options: TusUploadOptions) => {
        lastUploadOptions = options;
        return { start: lastUploadStart };
      });

    await TestBed.configureTestingModule({
      imports: [BunnyUploadComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CursosAdminService, useValue: serviceMock },
        { provide: ToastrService, useValue: toastMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BunnyUploadComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('seleccionar un archivo dispara la subida automáticamente, sin segundo clic', async () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(null);

    await component.onFileSelected(buildChangeEvent(buildFile()));

    expect(serviceMock.requestVideoUploadUrl).toHaveBeenCalledWith('clase.mp4');
    expect(tus.Upload).toHaveBeenCalled();
    expect(lastUploadStart).toHaveBeenCalled();
  });

  it('marca uploading=true de inmediato al seleccionar (antes de resolver credenciales)', () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(null);
    // No await: comprobamos el estado síncrono nada más disparar el evento.
    void component.onFileSelected(buildChangeEvent(buildFile()));
    expect(internals(component).uploading()).toBe(true);
  });

  it('si requestVideoUploadUrl falla, muestra el toast de error y uploading vuelve a false', async () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(null);
    serviceMock.requestVideoUploadUrl.mockReturnValue(
      throwError(() => new Error('network fail')),
    );

    await component.onFileSelected(buildChangeEvent(buildFile()));

    expect(toastMock.error).toHaveBeenCalled();
    expect(internals(component).uploading()).toBe(false);
  });

  it('el UploadedEvent incluye duracionSegundos cuando el navegador puede leer la duración', async () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(183);

    let received: UploadedEvent | null = null;
    component.uploaded.subscribe((e) => (received = e));

    await component.onFileSelected(buildChangeEvent(buildFile()));
    lastUploadOptions!.onSuccess();

    expect(received).not.toBeNull();
    expect(received!.guid).toBe('video-guid-1');
    expect(received!.duracionSegundos).toBe(183);
    expect(internals(component).done()).toBe(true);
    expect(internals(component).uploading()).toBe(false);
  });

  it('si la duración no se puede leer (timeout), la subida continúa y duracionSegundos queda undefined', async () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(null);

    let received: UploadedEvent | null = null;
    component.uploaded.subscribe((e) => (received = e));

    await component.onFileSelected(buildChangeEvent(buildFile()));
    lastUploadOptions!.onSuccess();

    expect(serviceMock.requestVideoUploadUrl).toHaveBeenCalled();
    expect(received).not.toBeNull();
    expect(received!.duracionSegundos).toBeUndefined();
  });

  it('onProgress actualiza el signal progress()', async () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(null);
    await component.onFileSelected(buildChangeEvent(buildFile()));
    lastUploadOptions!.onProgress(50, 200);
    expect(internals(component).progress()).toBe(25);
  });

  it('onError del tus.Upload muestra toast y desmarca uploading', async () => {
    jest
      .spyOn(internals(component), 'leerDuracionVideo')
      .mockResolvedValue(null);
    await component.onFileSelected(buildChangeEvent(buildFile()));
    lastUploadOptions!.onError(new Error('boom'));
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
    );
    expect(internals(component).uploading()).toBe(false);
  });

  it('sin fichero seleccionado (cancelar el picker) no hace nada', async () => {
    await component.onFileSelected(buildChangeEvent(null));
    expect(serviceMock.requestVideoUploadUrl).not.toHaveBeenCalled();
    expect(internals(component).uploading()).toBe(false);
  });

  describe('leerDuracionVideo (implementación real, sin espiar)', () => {
    let createElementSpy: jest.SpyInstance;
    let createdVideo: HTMLVideoElement | undefined;

    beforeEach(() => {
      (URL as unknown as { createObjectURL: jest.Mock }).createObjectURL = jest
        .fn()
        .mockReturnValue('blob:fake');
      (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL =
        jest.fn();

      createdVideo = undefined;
      const originalCreateElement = document.createElement.bind(document);
      createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockImplementation((tagName: string) => {
          const el = originalCreateElement(tagName);
          if (tagName === 'video') {
            createdVideo = el as HTMLVideoElement;
          }
          return el;
        });
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it('resuelve la duración redondeada cuando el navegador dispara loadedmetadata', async () => {
      const promise = internals(component).leerDuracionVideo(buildFile());

      expect(createdVideo).toBeDefined();
      Object.defineProperty(createdVideo, 'duration', {
        value: 125.6,
        configurable: true,
      });
      createdVideo!.dispatchEvent(new Event('loadedmetadata'));

      await expect(promise).resolves.toBe(126);
      expect(
        (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL,
      ).toHaveBeenCalledWith('blob:fake');
    });

    it('resuelve null si loadedmetadata nunca llega (timeout defensivo ~5s) sin bloquear', async () => {
      jest.useFakeTimers();
      const promise = internals(component).leerDuracionVideo(buildFile());

      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // deja correr el microtask del resolve()

      await expect(promise).resolves.toBeNull();
      jest.useRealTimers();
    });

    it('resuelve null ante evento error del elemento <video>', async () => {
      const promise = internals(component).leerDuracionVideo(buildFile());
      expect(createdVideo).toBeDefined();
      createdVideo!.dispatchEvent(new Event('error'));
      await expect(promise).resolves.toBeNull();
    });
  });
});
