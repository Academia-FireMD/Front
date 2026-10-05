# Callejero — configuración y respaldo de capas cartográficas

Documento breve de operación para las capas base del callejero (Valencia, Alicante
y el callejero nativo Angular). No contiene secretos.

## Piezas

- `public/callejero-embed/mapas-config.js` — **stub versionado** (sin clave). Utilidad
  compartida `TFMapas`: construye las URLs de los proveedores, añade el sufijo
  `?key=` de CARTO y aporta la recuperación ante fallos por capa.
- `scripts/escribir-mapa-key.mjs` — inyecta la clave **solo** en la copia generada.
- `package.json` — `build` y `build:staging` ejecutan `ng build` y después el script.
- `src/index.html` — carga `/callejero-embed/mapas-config.js` antes de Angular.
- `src/app/callejero/tf-mapas.d.ts` — tipado mínimo de `window.TFMapas`.

## Variable de entorno

`CALLEJERO_CARTO_API_KEY` — clave pública de mapas de CARTO (distinta de cualquier
credencial administrativa). **Nunca se escribe en el código fuente ni en los logs.**

En `pnpm build` / `pnpm build:staging`, tras `ng build`, el script ancla la
sustitución a la propiedad `cartoKey` del objeto `CONFIG` y la aplica **únicamente**
a `dist/front/browser/callejero-embed/mapas-config.js`. Exige una única coincidencia;
si no la encuentra, aborta sin modificar nada.

- **Sin la variable**: el build no falla; el stub queda vacío y los consumidores
  saltan CARTO usando los respaldos.
- **`ng serve` local**: los HTML y el shell cargan el stub de `public/`, por lo que
  funciona igualmente con respaldos (cómodo para desarrollo).
- **E2E**: Playwright intercepta `/callejero-embed/mapas-config.js` y sirve una copia
  con una clave ficticia; no se hacen peticiones CARTO reales.

## Restricción de dominios de la clave

Una clave CARTO limitada por dominios exige cabecera `Referer`; por eso
`public/_headers` usa `Referrer-Policy: strict-origin-when-cross-origin` y amplía
solo los hosts cartográficos necesarios (CARTO raíz + subdominios, IGN/IDEE).

En la consola de CARTO hay que registrar **separadamente** los dominios de
producción (`app.tecnikafire.com`) y staging (`app-staging.tecnikafire.com`);
`localhost` no se incluye en esas restricciones (el desarrollo local no usa CARTO).

## Cuota

El plan gratuito actual de CARTO cubre **1M teselas/mes acumuladas por cuenta**; no
hay plan de pago contratado. La recuperación se activa ante **errores de carga
verificables** (tres `tileerror` consecutivos), no por agotar la cuota: si un límite
se agotara devolviendo una imagen válida, no habría transición automática.

## Capas base y respaldos

| Capa | Primario | Respaldo |
|---|---|---|
| Valencia · calles | Google `lyrs=m` (sin key) | CARTO Voyager si hay key; en su ausencia, IGN `IGNBaseTodo` |
| Valencia · satélite | Google `lyrs=y` (sin key) | Esri `World_Imagery` |
| Valencia · mudo | CARTO `voyager_nolabels` con key; si no hay key, PNOA directo | PNOA (`OI.OrthoimageCoverage`); si el primario ya es PNOA, no hay respaldo |
| Alicante · mudo claro (selector y examen) | CARTO `light_nolabels` con key; si no hay key, PNOA directo | PNOA; si el primario ya es PNOA, no hay respaldo |

**Esri `World_Light_Gray_Base` NO es completamente mudo**: sus teselas incrustan
topónimos (`Port de València`, `Valencian Community`…). Por eso no se usa como
primario ni como respaldo del modo sin nombres; el fondo mudo recurre a CARTO
`*_nolabels` o a PNOA (fotografía del IGN, sin rótulos cartográficos). El "Fondo
claro (Esri)" normal de Alicante se conserva como capa de estudio, nunca elegida
automáticamente durante el examen.

## Recuperación ante fallos

`TFMapas.crearRecuperable(L, capa, opciones)` conserva la instancia de la capa
Leaflet y cambia su URL/opciones, de modo que `baseActual`, la selección y el modo
examen no cambian.

- 3 `tileerror` **consecutivos** (reseteados por cada `tileload` correcto) disparan
  **una sola** transición al respaldo.
- Si el respaldo también falla: aviso "No se puede cargar el mapa" con botón
  **Reintentar** (explícito; restablece el primario y el contador). Sin bucles ni
  reintentos automáticos.
- **Normalización de opciones**: al cambiar de proveedor se conserva el rango de
  **vista** de la capa original (`minZoom`/`maxZoom`) y se fijan los límites
  **nativos** del respaldo (`maxNativeZoom`/`minNativeZoom`), inferidos de su
  `maxZoom`/`minZoom` si no los declara. Así, con la vista en 21, Google puede caer a
  CARTO (nativo 20) o PNOA (19) y seguir mostrando mapa, y Esri Topo (vista 19) a
  OpenTopoMap (nativo 17) sin quedarse en blanco. `Reintentar` restablece
  **exactamente** las opciones y la URL originales.

## Enlaces

- CARTO basemaps: https://carto.com/basemaps
- Documentación CARTO: https://docs.carto.com/
- IGN PNOA (WMTS): https://www.ign.es/web/ign/portal/ide-area-nodo-pnoa-ma
- IGN Base (WMTS): https://www.ign.es/web/ign/portal/ide-area-nodo-ide-base
- IDEE relieve (WMTS): https://www.idee.es/

## Entrega

El HTML de Alicante se sirve como activo estático y sigue siendo autónomo: no recibe
JWT ni credenciales de la academia. Las vistas Google de calles/satélite de Valencia
se conservan: calles usa CARTO Voyager con clave o IGN Base sin clave como respaldo;
satélite usa Esri `World_Imagery`.
