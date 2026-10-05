#!/usr/bin/env node
/**
 * Inyecta la clave pública de mapas CARTO en la copia GENERADA del stub.
 *
 * Lee CALLEJERO_CARTO_API_KEY del entorno y sustituye el valor de la PROPIEDAD
 * `cartoKey` del objeto CONFIG únicamente en
 * dist/front/browser/callejero-embed/mapas-config.js. Nunca toca el archivo
 * fuente (public/…) ni imprime la clave en los logs.
 *
 * Si la variable no está definida se conserva el stub vacío: los consumidores
 * saltan CARTO y usan los respaldos (build y mapa siguen funcionando).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RUTA_DESTINO = resolve(
  process.cwd(),
  'dist/front/browser/callejero-embed/mapas-config.js',
);

/**
 * Ancla la sustitución a la propiedad `cartoKey` DENTRO del objeto CONFIG, no a
 * un literal suelto que pudiera aparecer antes en un comentario. `[^}]*?` no
 * cruza el cierre del objeto, de modo que solo puede casar con la propiedad.
 */
const RE_CARTOKEY_CONFIG =
  /(var\s+CONFIG\s*=\s*\{[^}]*?\bcartoKey\s*:\s*)''/;

const clave = (process.env.CALLEJERO_CARTO_API_KEY || '').trim();

if (!existsSync(RUTA_DESTINO)) {
  console.error(
    `[mapas-config] No existe ${RUTA_DESTINO}. Ejecuta este script tras "ng build".`,
  );
  process.exit(1);
}

const contenido = readFileSync(RUTA_DESTINO, 'utf8');

// Debe existir exactamente la propiedad cartoKey de CONFIG; si no, se aborta
// sin modificar nada (evita reemplazos ambiguos o parciales).
const coincidencias = contenido.match(
  new RegExp(RE_CARTOKEY_CONFIG.source, 'g'),
);
if (!coincidencias || coincidencias.length !== 1) {
  console.error(
    `[mapas-config] Se esperaba exactamente una propiedad cartoKey en CONFIG y se encontraron ${
      coincidencias ? coincidencias.length : 0
    }; se aborta sin modificar nada.`,
  );
  process.exit(1);
}

if (!clave) {
  console.log(
    '[mapas-config] CALLEJERO_CARTO_API_KEY no definida: se conserva el stub sin clave (se usarán respaldos).',
  );
  process.exit(0);
}

const actualizado = contenido.replace(
  RE_CARTOKEY_CONFIG,
  (_coincidencia, prefijo) => `${prefijo}${JSON.stringify(clave)}`,
);
writeFileSync(RUTA_DESTINO, actualizado, 'utf8');
console.log(
  '[mapas-config] Clave CARTO aplicada a la copia generada (dist/front/browser/callejero-embed/mapas-config.js).',
);
