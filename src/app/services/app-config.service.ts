import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AppConfig,
  AppConfigErrorCode,
  EstadoModulos,
  ToggleModuloDto,
  UpdateAppConfigDto,
  UploadLogoResponse,
} from '../shared/models/app-config.model';
import { ModuloApp } from '../shared/models/modulo-app.enum';
import { Rol } from '../shared/models/user.model';
import { AuthService } from './auth.service';

const FALLBACK_CONFIG: AppConfig = {
  appName: 'TecnikaFire',
  logoUrl: null,
  primaryColor: '#FF6B35',
  secondaryColor: '#004E89',
  updatedAt: new Date(0).toISOString(),
};

const APP_CONFIG_ENDPOINT = '/api/app-config';
const MODULOS_ENDPOINT = '/api/app-config/modulos';
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 3000;

/** Construye un mapa todos-true / todos-false (helper interno fail-safe). */
function buildModulosMap(value: boolean): EstadoModulos {
  return Object.values(ModuloApp).reduce((acc, key) => {
    acc[key] = value;
    return acc;
  }, {} as EstadoModulos);
}

export type UpdateConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; code: AppConfigErrorCode | 'UNKNOWN'; message?: string };

/**
 * Servicio raíz del white-label MVP (D10 §4.1, §5.1).
 *
 * - `load()` se invoca desde APP_INITIALIZER y popula `appConfig` + `estadoModulos`.
 * - `updateConfig`, `toggleModulo`, `uploadLogo`, `deleteLogo` exigen SUPERADMIN
 *   (gateado en backend; frontend solo expone la API). En éxito, actualiza
 *   signals y re-aplica CSS vars / título.
 * - Fail-safe (§5.1): pre-login y SUPERADMIN → fallback todos-true. Autenticado
 *   no-SUPERADMIN → fallback todos-false + banner via `modulosFailedToLoad`.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private readonly injector = inject(Injector);
  private _authService?: AuthService;
  private _toast?: ToastrService;

  private readonly _appConfig = signal<AppConfig>(FALLBACK_CONFIG);
  private readonly _estadoModulos = signal<EstadoModulos>(
    buildModulosMap(true),
  );
  private readonly _isLoaded = signal<boolean>(false);
  private readonly _modulosFailedToLoad = signal<boolean>(false);

  readonly appConfig = this._appConfig.asReadonly();
  readonly estadoModulos = this._estadoModulos.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();
  readonly modulosFailedToLoad = this._modulosFailedToLoad.asReadonly();

  /** Convenience: signal con flag SUPERADMIN del usuario actual (snapshot). */
  readonly isSuperadmin = computed<boolean>(() => {
    // Recompute on every read; AuthService no es reactivo.
    const decoded = this.getAuthService().decodeToken?.();
    return decoded?.rol === 'SUPERADMIN';
  });

  private getAuthService(): AuthService {
    if (!this._authService) {
      this._authService = this.injector.get(AuthService);
    }
    return this._authService;
  }

  private getToast(): ToastrService {
    if (!this._toast) {
      this._toast = this.injector.get(ToastrService);
    }
    return this._toast;
  }

  /**
   * Boot. Llamado desde APP_INITIALIZER. NUNCA tira — siempre resuelve
   * con isLoaded=true (con valores reales o fallback) para no bloquear el bundle.
   */
  async load(): Promise<void> {
    const [configResult, modulosResult] = await Promise.all([
      this.tryFetchConfig(),
      this.tryFetchModulos(),
    ]);

    if (configResult) {
      this._appConfig.set(configResult);
    } else {
      this._appConfig.set(FALLBACK_CONFIG);
      console.warn('[AppConfigService] fallback config aplicada');
    }

    if (modulosResult) {
      this._estadoModulos.set(modulosResult);
      this._modulosFailedToLoad.set(false);
    } else {
      const failSafe = this.computeModulosFailSafe();
      this._estadoModulos.set(failSafe.map);
      this._modulosFailedToLoad.set(failSafe.banner);
      console.warn(
        `[AppConfigService] modulos fail-safe aplicado (banner=${failSafe.banner})`,
      );
    }

    this.applyCssVars();
    this._isLoaded.set(true);
  }

  private async tryFetchConfig(): Promise<AppConfig | null> {
    return this.fetchWithRetry<AppConfig>(() =>
      this.http.get<AppConfig>(`${environment.apiUrl}${APP_CONFIG_ENDPOINT}`),
    );
  }

  private async tryFetchModulos(): Promise<EstadoModulos | null> {
    return this.fetchWithRetry<EstadoModulos>(() =>
      this.http.get<EstadoModulos>(`${environment.apiUrl}${MODULOS_ENDPOINT}`),
    );
  }

  private async fetchWithRetry<T>(
    factory: () => import('rxjs').Observable<T>,
  ): Promise<T | null> {
    try {
      return await firstValueFrom(factory());
    } catch (err) {
      console.warn('[AppConfigService] primer intento falló, retry…', err);
      try {
        await firstValueFrom(timer(RETRY_DELAY_MS));
        return await firstValueFrom(factory());
      } catch (retryErr) {
        console.warn('[AppConfigService] retry también falló', retryErr);
        return null;
      }
    }
  }

  /**
   * Fail-safe módulos (§5.1): pre-login y SUPERADMIN → todos true, autenticado
   * no-SUPERADMIN → todos false + banner.
   */
  private computeModulosFailSafe(): { map: EstadoModulos; banner: boolean } {
    const decoded = this.getAuthService().decodeToken?.();
    if (!decoded) {
      return { map: buildModulosMap(true), banner: false };
    }
    if (decoded.rol === 'SUPERADMIN') {
      return { map: buildModulosMap(true), banner: false };
    }
    return { map: buildModulosMap(false), banner: true };
  }

  /**
   * PUT /api/app-config con optimistic concurrency. En 409 STALE_CONFIG
   * recarga y devuelve un error code para que el caller avise.
   */
  async updateConfig(
    dto: Partial<Omit<AppConfig, 'updatedAt'>>,
    updatedAt: string,
  ): Promise<UpdateConfigResult> {
    const body: UpdateAppConfigDto = { ...dto, updatedAt };
    try {
      const updated = await firstValueFrom(
        this.http.put<AppConfig>(
          `${environment.apiUrl}${APP_CONFIG_ENDPOINT}`,
          body,
        ),
      );
      this._appConfig.set(updated);
      this.applyCssVars();
      return { ok: true, config: updated };
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        await this.load();
        return {
          ok: false,
          code: 'STALE_CONFIG',
          message:
            'Otro admin modificó la config mientras editabas. Recargando…',
        };
      }
      const message = this.extractErrorMessage(err);
      return { ok: false, code: 'UNKNOWN', message };
    }
  }

  /**
   * PUT /api/app-config/modulos/:modulo body {habilitado}. Actualiza signal
   * en éxito; no rollbackea en error porque el caller mostrará toast.
   */
  async toggleModulo(modulo: ModuloApp, habilitado: boolean): Promise<boolean> {
    const body: ToggleModuloDto = { habilitado };
    try {
      await firstValueFrom(
        this.http.put<void>(
          `${environment.apiUrl}${MODULOS_ENDPOINT}/${modulo}`,
          body,
        ),
      );
      this._estadoModulos.update((current) => ({
        ...current,
        [modulo]: habilitado,
      }));
      return true;
    } catch (err) {
      console.error('[AppConfigService] toggleModulo falló', err);
      return false;
    }
  }

  /**
   * POST /api/app-config/logo con FormData('logo', file). Devuelve la URL
   * pública y actualiza signal con la nueva URL + updatedAt.
   */
  async uploadLogo(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await firstValueFrom(
        this.http.post<UploadLogoResponse>(
          `${environment.apiUrl}${APP_CONFIG_ENDPOINT}/logo`,
          fd,
        ),
      );
      this._appConfig.update((c) => ({
        ...c,
        logoUrl: res.logoUrl,
        updatedAt: res.updatedAt,
      }));
      return res.logoUrl;
    } catch (err) {
      console.error('[AppConfigService] uploadLogo falló', err);
      return null;
    }
  }

  /** DELETE /api/app-config/logo. Idempotente. */
  async deleteLogo(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete<void>(
          `${environment.apiUrl}${APP_CONFIG_ENDPOINT}/logo`,
        ),
      );
      this._appConfig.update((c) => ({ ...c, logoUrl: null }));
      return true;
    } catch (err) {
      console.error('[AppConfigService] deleteLogo falló', err);
      return false;
    }
  }

  /**
   * Re-aplica CSS vars en `:root` y settea `document.title` con el appName
   * saneado. Llamado tras `load()` y tras cada `updateConfig()` exitoso.
   *
   * Bug WL-A — el código previo solo seteaba `--primary-color` y
   * `--secondary-color`, pero PrimeNG (Aura/Lara theme) consume sus propias
   * vars (`--p-primary-color`, `--primary-500`, etc) y la app combina vars
   * legacy (`--primary-100..900`) en botones, gradientes, etc. Sin
   * propagación, el branding solo afectaba algunos degradados de marketing
   * pero NO botones, chips ni inputs.
   *
   * Estrategia: del hex base derivamos 11 shades (50-950) con curva de
   * luminosidad simple, y los aplicamos a TODOS los aliases que el bundle
   * referencia. PrimeNG Aura usa `--p-primary-{shade}`; legacy CSS usa
   * `--primary-{shade}`; aplicamos ambos para coverage total.
   */
  applyCssVars(): void {
    if (typeof document === 'undefined') return;
    const cfg = this._appConfig();
    const root = document.documentElement;

    // Legacy aliases (mantener para CSS existente que use --primary-color).
    root.style.setProperty('--primary-color', cfg.primaryColor);
    root.style.setProperty('--secondary-color', cfg.secondaryColor);

    // PrimeNG + paleta full: 50..950 derivadas + alias single-color.
    const primaryPalette = generateShades(cfg.primaryColor);
    const secondaryPalette = generateShades(cfg.secondaryColor);
    for (const [shade, value] of Object.entries(primaryPalette)) {
      // PrimeNG Aura/Lara
      root.style.setProperty(`--p-primary-${shade}`, value);
      // legacy (PrimeFlex/PrimeNG v17 token style)
      root.style.setProperty(`--primary-${shade}`, value);
    }
    for (const [shade, value] of Object.entries(secondaryPalette)) {
      root.style.setProperty(`--p-secondary-${shade}`, value);
      root.style.setProperty(`--secondary-${shade}`, value);
    }

    // Single-color aliases. PrimeNG button "primary" + similar usan
    // `--p-primary-color` (texto del shade más oscuro) y
    // `--p-primary-contrast-color` (texto encima del bg primario).
    root.style.setProperty('--p-primary-color', cfg.primaryColor);
    root.style.setProperty(
      '--p-primary-contrast-color',
      readableText(cfg.primaryColor),
    );
    root.style.setProperty('--p-primary-hover-color', primaryPalette['600']);
    root.style.setProperty('--p-primary-active-color', primaryPalette['700']);

    // Defensa: si el `<style id="wl-prime-overrides">` quedó en el DOM
    // de una versión anterior (cache, deploy parcial), lo retiramos.
    // El refactor SCSS proper (theme-firemd + theme-base + styles.scss
    // → CSS vars) lo hace redundante.
    const legacyOverride = document.getElementById('wl-prime-overrides');
    if (legacyOverride) {
      legacyOverride.remove();
    }

    document.title = this.sanitizeAppName(cfg.appName);
  }

  /**
   * @deprecated Eliminado — placeholder mantenido por backward-compat con
   * imports antiguos. El refactor SCSS proper (theme-firemd + theme-base
   * + styles.scss usando `var(--primary-color)`) hace innecesario el
   * override de PrimeNG quirúrgico. Si se reintroduce algún component
   * con `\$primaryColor` SCSS hardcoded, migrarlo a CSS var en vez de
   * resucitar este método.
   *
   * (Historic context — Bug WL-A round 2:
   * el theme-firemd interpolaba `\$primaryColor` SCSS hardcoded en el
   * CSS compilado. La solución temporal era inyectar `<style
   * id="wl-prime-overrides">` con !important. El refactor proper a CSS
   * vars hizo este override obsoleto. Si reaparece algún rojo
   * hardcoded en el futuro, migrar ese archivo a CSS vars en vez de
   * resucitar este método.)
   */

  /**
   * Saneo de appName: trim, fallback "TecnikaFire" si empty/whitespace,
   * cap 60 chars, strip HTML básico (XSS defense para document.title).
   */
  sanitizeAppName(name: string | null | undefined): string {
    const fallback = 'TecnikaFire';
    if (!name) return fallback;
    const stripped = String(name)
      .replace(/<[^>]*>/g, '')
      .trim();
    if (!stripped) return fallback;
    return stripped.length > 60 ? stripped.slice(0, 60) : stripped;
  }

  /**
   * Convenience getter: lee del signal. Si el módulo no está en el map
   * (caso bug), fail-open → true (consistente con backend default).
   */
  isModuloHabilitado(modulo: ModuloApp): boolean {
    const map = this._estadoModulos();
    if (!(modulo in map)) return true;
    return map[modulo] === true;
  }

  /** Exposes role helper sin requerir signal call site (para guards). */
  getCurrentRol(): Rol | 'SUPERADMIN' | null {
    const decoded = this.getAuthService().decodeToken?.();
    return decoded?.rol ?? null;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (typeof body === 'string') return body;
      if (body && typeof body === 'object' && 'message' in body) {
        const msg = (body as { message: unknown }).message;
        return Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
      return `HTTP ${err.status}`;
    }
    return 'Error desconocido';
  }
}

/** Factory para APP_INITIALIZER (multi). */
export function appConfigInitFactory(service: AppConfigService) {
  return () => service.load();
}

/**
 * Genera 11 shades (50..950) de un color hex base usando interpolación
 * lineal sobre HSL. Devuelve un object con claves string. NO depende de
 * librerías para no inflar bundle.
 *
 * shade 500 = color base.
 * shade <500: interpolar hacia blanco (L=98 para 50, L=88 para 200, etc).
 * shade >500: interpolar hacia negro (L=10 para 950, L=22 para 800, etc).
 *
 * Bug WL-A — necesario para que PrimeNG genere botones/chips coherentes
 * con el branding del tenant.
 */
function generateShades(hex: string): Record<string, string> {
  const { h, s, l: baseL } = hexToHsl(hex);
  // Curva de luminosidad típica (Tailwind / PrimeNG Aura aprox).
  const shades = {
    '50': 96,
    '100': 92,
    '200': 84,
    '300': 72,
    '400': 60,
    '500': baseL, // color base
    '600': Math.max(0, baseL - 10),
    '700': Math.max(0, baseL - 20),
    '800': Math.max(0, baseL - 30),
    '900': Math.max(0, baseL - 38),
    '950': Math.max(0, baseL - 44),
  };
  const out: Record<string, string> = {};
  for (const [k, l] of Object.entries(shades)) {
    out[k] = hslToHex(h, s, l);
  }
  return out;
}

/**
 * Devuelve `#000` o `#fff` según contraste con el color de fondo. Usado
 * para `--p-primary-contrast-color` (texto sobre botón primario).
 * Threshold YIQ (luma perceptual) en 128.
 */
function readableText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
