import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppConfig {
  verifactuEnabled: boolean;
}

/**
 * Configuración runtime del Frontend leída desde GET /api/config al bootstrap.
 *
 * Actualmente expone solo `verifactuEnabled` para que la UI oculte el botón
 * "Eliminar factura" cuando Verifactu esté activo.
 *
 * NO expone `billingEnabled`: con billing off, la UI sigue visible (alumnos
 * siguen viendo su histórico). Solo los endpoints de escritura devuelven 404.
 *
 * Fail-safe: si el backend no responde, se asume verifactuEnabled=false
 * (deja ver el botón eliminar — comportamiento más útil en desarrollo).
 * En producción, si el backend se cae, la UI igual funcionará con el último
 * valor conocido.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly _verifactuEnabled = signal<boolean>(false);
  readonly verifactuEnabled = this._verifactuEnabled.asReadonly();

  constructor(private readonly http: HttpClient) {}

  async load(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<AppConfig>(`${environment.apiUrl}/api/config`, {
          withCredentials: true,
        }),
      );
      this._verifactuEnabled.set(Boolean(config?.verifactuEnabled));
    } catch (err) {
      console.warn('[ConfigService] no se pudo cargar /api/config:', err);
      this._verifactuEnabled.set(false);
    }
  }
}

export function configInitFactory(config: ConfigService) {
  return () => config.load();
}
