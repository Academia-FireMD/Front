/**
 * Tipado mínimo de la utilidad compartida TFMapas
 * (public/callejero-embed/mapas-config.js). El shell la carga con
 * <script src="/callejero-embed/mapas-config.js"> antes de arrancar Angular;
 * aquí solo se declara su forma para consumirla sin duplicar URLs ni lógica.
 */
declare interface TfMapaDefinicion {
  url: string;
  opts: L.TileLayerOptions;
}

type TfMapaFase = 'primario' | 'respaldo' | 'fallo';

declare interface TfMapasRecuperable {
  fase(): TfMapaFase;
  reintentar(): void;
  establecerActivo(activo: boolean): void;
  destruir(): void;
  avisoElemento: HTMLElement | null;
  errorElemento: HTMLElement | null;
}

declare interface TfMapasOpciones {
  respaldo?: TfMapaDefinicion | null;
  maxFallos?: number;
  contenedor?: HTMLElement;
  errorContenedor?: HTMLElement;
  textoError?: string;
  textoReintentar?: string;
  textoAviso?: string;
  activo?: boolean;
  alCambiarFase?: (fase: TfMapaFase, capa: L.TileLayer) => void;
}

declare interface TfMapas {
  config: { cartoKey: string };
  tieneCarto(): boolean;
  claveCarto(): string;
  proveedores(): Record<
    string,
    (extra?: L.TileLayerOptions) => TfMapaDefinicion | null
  >;
  crearRecuperable(
    L: typeof L,
    capa: L.TileLayer,
    opciones: TfMapasOpciones,
  ): TfMapasRecuperable | null;
}

interface Window {
  TFMapas?: TfMapas;
}
