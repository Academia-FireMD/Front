import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import Hls from 'hls.js';
import { ToastrService } from 'ngx-toastr';
import { BunnyPlayerComponent } from './bunny-player.component';

jest.mock('hls.js', () => {
  class MockHls {
    static instances: MockHls[] = [];
    static isSupported = jest.fn().mockReturnValue(true);
    static Events = { ERROR: 'hlsError' };
    loadSource = jest.fn();
    attachMedia = jest.fn();
    on = jest.fn();
    destroy = jest.fn();
    constructor() {
      MockHls.instances.push(this);
    }
  }
  return { __esModule: true, default: MockHls };
});

const HlsMock = Hls as unknown as {
  instances: {
    loadSource: jest.Mock;
    attachMedia: jest.Mock;
    on: jest.Mock;
    destroy: jest.Mock;
  }[];
  isSupported: jest.Mock;
};

const PLAYBACK_URL =
  'https://vz-test.b-cdn.net/abc-123/playlist.m3u8?token=xyz&expires=999';

describe('BunnyPlayerComponent', () => {
  let fixture: ComponentFixture<BunnyPlayerComponent>;
  let component: BunnyPlayerComponent;
  let toastr: { error: jest.Mock };
  let canPlayTypeMock: jest.Mock;

  const crearFixture = () => {
    fixture = TestBed.createComponent(BunnyPlayerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('playbackUrl', PLAYBACK_URL);
    fixture.detectChanges();
  };

  const videoEl = () =>
    fixture.nativeElement.querySelector('video') as HTMLVideoElement;

  beforeEach(async () => {
    HlsMock.instances.length = 0;
    HlsMock.isSupported.mockReturnValue(true);
    // Por defecto simulamos Chrome (sin HLS nativo).
    canPlayTypeMock = jest.fn().mockReturnValue('');
    Object.defineProperty(HTMLMediaElement.prototype, 'canPlayType', {
      value: canPlayTypeMock,
      configurable: true,
      writable: true,
    });

    toastr = { error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [BunnyPlayerComponent],
      providers: [
        provideHttpClient(),
        { provide: ToastrService, useValue: toastr },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('con MSE (Chrome/Edge/Safari moderno): reproduce con hls.js y la URL firmada', () => {
    crearFixture();
    expect(HlsMock.instances).toHaveLength(1);
    const hls = HlsMock.instances[0];
    expect(hls.loadSource).toHaveBeenCalledWith(PLAYBACK_URL);
    expect(hls.attachMedia).toHaveBeenCalledWith(videoEl());
    expect(videoEl().src).not.toContain('playlist.m3u8');
  });

  it('Chromium "mentiroso" (canPlayType=maybe pero con MSE): usa hls.js igualmente', () => {
    // QA 2026-07-22: hay Chromiums que dicen 'maybe' al m3u8 y luego fallan
    // con "no supported sources". MSE manda sobre canPlayType.
    canPlayTypeMock.mockReturnValue('maybe');
    crearFixture();
    expect(HlsMock.instances).toHaveLength(1);
    expect(videoEl().src).not.toContain('playlist.m3u8');
  });

  it('sin MSE (Safari antiguo / iPhone): src directo, sin hls.js', () => {
    HlsMock.isSupported.mockReturnValue(false);
    canPlayTypeMock.mockReturnValue('maybe');
    crearFixture();
    expect(HlsMock.instances).toHaveLength(0);
    expect(videoEl().src).toBe(PLAYBACK_URL);
  });

  it('emite el progreso real del reproductor (timeupdate)', () => {
    crearFixture();
    const emisiones: number[] = [];
    component.tiempoActual.subscribe((s) => emisiones.push(s));
    const video = videoEl();
    Object.defineProperty(video, 'currentTime', {
      value: 42,
      configurable: true,
    });
    video.dispatchEvent(new Event('timeupdate'));
    expect(emisiones).toEqual([42]);
  });

  it('emite terminado al acabar el vídeo', () => {
    crearFixture();
    const terminado = jest.fn();
    component.terminado.subscribe(terminado);
    videoEl().dispatchEvent(new Event('ended'));
    expect(terminado).toHaveBeenCalled();
  });

  it('un error fatal de hls.js avisa al usuario por toastr', () => {
    crearFixture();
    const hls = HlsMock.instances[0];
    const errorHandler = hls.on.mock.calls.find(
      ([evento]) => evento === 'hlsError',
    )?.[1];
    expect(errorHandler).toBeDefined();
    errorHandler(null, { fatal: true });
    expect(toastr.error).toHaveBeenCalled();
  });

  it('al destruir el componente destruye la instancia hls', () => {
    crearFixture();
    const hls = HlsMock.instances[0];
    fixture.destroy();
    expect(hls.destroy).toHaveBeenCalled();
  });
});
