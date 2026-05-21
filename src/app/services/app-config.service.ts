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
    return this.fetchWithRetry<AppConfig>(
      () => this.http.get<AppConfig>(`${environment.apiUrl}${APP_CONFIG_ENDPOINT}`),
    );
  }

  private async tryFetchModulos(): Promise<EstadoModulos | null> {
    return this.fetchWithRetry<EstadoModulos>(
      () =>
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
   */
  applyCssVars(): void {
    if (typeof document === 'undefined') return;
    const cfg = this._appConfig();
    const root = document.documentElement;
    root.style.setProperty('--primary-color', cfg.primaryColor);
    root.style.setProperty('--secondary-color', cfg.secondaryColor);
    document.title = this.sanitizeAppName(cfg.appName);
  }

  /**
   * Saneo de appName: trim, fallback "TecnikaFire" si empty/whitespace,
   * cap 60 chars, strip HTML básico (XSS defense para document.title).
   */
  sanitizeAppName(name: string | null | undefined): string {
    const fallback = 'TecnikaFire';
    if (!name) return fallback;
    const stripped = String(name).replace(/<[^>]*>/g, '').trim();
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
