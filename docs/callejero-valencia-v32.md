# Callejero de València v32

## Alcance y compatibilidad

- Se conserva el asset `/callejero-embed/valencia_27.html`; el iframe añade `?v=32` para invalidar caché.
- El protocolo `tf-callejero-auth-request` / `tf-callejero-auth`, sus validaciones de `source` y `origin`, y el único reintento de peticiones propias tras `401` permanecen sin cambios.
- El HTML se actualiza desde el upstream v32 recibido el 22-10-2026 (SHA-256: `9fe25147b45321727ffd5d5f137d82caca0d8900cc47e471533318e3876e6b61`). Conserva el dataset bilingüe de 3.162 viales, generado el 21-10-2026.
- Centre Històric/Centro Histórico se excluye antes de crear POIs y capas, y también de estaciones, preguntas e historial. Permanecen los cinco parques operativos.

## Dataset y autorización

El JSON v32 permanece dentro del HTML y se convierte a objetos solo después de resolver y autorizar València mediante `GET /callejero/ciudades`. `cargarViales()` vuelve a validar ese acceso antes de devolver su caché en memoria. El catálogo no se copia a `localStorage`/`sessionStorage`, no se ingesta ni requiere persistencia nueva en backend. Se aceptan los 15 viales cuyo bounding box tiene un eje degenerado; por eso la validación permite extremos iguales.

La búsqueda local conserva nombres valencianos, formas castellanas y alias; el geocodificador se usa como respaldo mediante la API de la academia.

## API y recorridos

Las consultas de geocodificación, dirección inversa y recorrido usan únicamente endpoints existentes, con JWT y reintento `401` comunes:

- `GET /callejero/ciudades`
- `GET /callejero/geocode/buscar?ciudadId=&q=&limit=`
- `GET /callejero/geocode/reverse?ciudadId=&lat=&lng=`
- `GET /callejero/recorrido-libre?ciudadId=&q=`

El destino se envía con su nombre canónico. Antes de dibujar, se valida la estructura completa de la respuesta (destino, coordenadas, geometría, calles, tiempos, parque y estación); las calles se muestran escapadas en la lista y el itinerario. Un error o una respuesta incompleta muestra una acción de reintento y no inventa una línea recta.

## Historial local

Al leer `tf_hist_v1`, se conserva únicamente el formato conocido de contadores, claves y preguntas; se copian campos explícitamente permitidos y se descartan referencias de mapa, propiedades inesperadas, claves inválidas y registros del parque no operativo. Los valores dinámicos de zona y POI se muestran como texto en feedback y resúmenes; los tooltips de mapa escapan los nombres antes de pasarlos a Leaflet. El historial saneado se vuelve a guardar si `localStorage` lo permite. JSON corrupto, acceso bloqueado y cuota agotada no impiden abrir el callejero ni el examen.

## Cartografía

- **Calles:** tesela estándar `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, atribución visible y `Referrer-Policy: strict-origin-when-cross-origin`; respaldo `IGNBaseTodo`.
- **Mudo:** CARTO sin etiquetas cuando hay clave; PNOA como respaldo y como proveedor disponible sin clave.
- **Satélite:** Esri World Imagery con PNOA de respaldo.
- `public/_headers` limita la conexión a los orígenes de API de staging/producción y conserva intacto el bloque CSP de Alicante.

## QA local

Playwright intercepta tiles, autenticación y `/callejero/*`; no requiere backend real. Para evitar colisiones, usar un puerto libre mediante `E2E_PORT` y un worker. La suite protege el conteo/alias del dataset, autorización en carga y caché en memoria, reintento `401`, exclusión del parque histórico, saneamiento y persistencia del historial, recorridos completos sin línea ficticia y selección de proveedor cartográfico.
