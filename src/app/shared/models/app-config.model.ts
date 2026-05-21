import { ModuloApp } from './modulo-app.enum';

/**
 * Config white-label leída desde GET /api/app-config (§4.1, §5.1).
 *
 * `updatedAt` se usa para optimistic concurrency en PUT (§5.6 D8): el cliente
 * lo manda en el body; backend devuelve 409 `STALE_CONFIG` si no coincide.
 *
 * NOTA D16: si OpenAPI codegen cubre estos endpoints tras merge backend,
 * preferir el type generado. Mientras tanto, este modelo handcrafted es la
 * fuente de verdad en el frontend.
 */
export interface AppConfig {
  appName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  updatedAt: string;
}

/**
 * Mapa rol → habilitado para los 9 módulos. Devuelto por GET
 * /api/app-config/modulos. Indexable por `ModuloApp`.
 */
export type EstadoModulos = Record<ModuloApp, boolean>;

/**
 * Códigos de error del backend para PUT /api/app-config. Sólo se contempla
 * `STALE_CONFIG` por ahora (§5.6 D8 optimistic concurrency).
 */
export type AppConfigErrorCode = 'STALE_CONFIG';

export interface UpdateAppConfigDto {
  appName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  updatedAt: string;
}

export interface ToggleModuloDto {
  habilitado: boolean;
}

export interface UploadLogoResponse {
  logoUrl: string;
  updatedAt: string;
}
