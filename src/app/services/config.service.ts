import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppConfig {
  verifactuEnabled: boolean;
  hardDeleteFacturasEnabled: boolean;
}

/**
 * Configuración runtime del Frontend leída desde GET /api/config al bootstrap.
 *
 * Expone las capacidades fiscales que modifican la UI. El backend mantiene la
 * decisión final y bloquea igualmente cualquier hard delete en producción.
 *
 * NO expone `billingEnabled`: con billing off, la UI sigue visible (alumnos
 * siguen viendo su histórico). Solo los endpoints de escritura devuelven 404.
 *
 * Fail-safe: si el backend no responde, el borrado permanece oculto.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly _verifactuEnabled = signal<boolean>(false);
  readonly verifactuEnabled = this._verifactuEnabled.asReadonly();
  private readonly _hardDeleteFacturasEnabled = signal<boolean>(false);
  readonly hardDeleteFacturasEnabled =
    this._hardDeleteFacturasEnabled.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async load(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<AppConfig>(`${environment.apiUrl}/api/config`, {
          withCredentials: true,
        }),
      );
      this._verifactuEnabled.set(Boolean(config?.verifactuEnabled));
      this._hardDeleteFacturasEnabled.set(
        config?.hardDeleteFacturasEnabled === true,
      );
    } catch (err) {
      console.warn('[ConfigService] no se pudo cargar /api/config:', err);
      this._verifactuEnabled.set(false);
      this._hardDeleteFacturasEnabled.set(false);
    }
  }
}

export function configInitFactory(config: ConfigService) {
  return () => config.load();
}
