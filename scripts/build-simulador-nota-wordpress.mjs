#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'public/simulador-nota/index.html');
const DEFAULT_OUTPUT = resolve(ROOT, 'dist/simulador-nota-wordpress.html');
const OPPOSITION_IMAGE_PATHS = {
  '../oposiciones/alicante.png': 'ALICANTE',
  '../oposiciones/valencia.png': 'VALENCIA',
  '../oposiciones/madrid.png': 'MADRID',
};

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Construye el bloque WordPress utilizando el body del HTML canónico. */
export function buildWordPressBlock(source, options = {}) {
  if (typeof source !== 'string') {
    throw new TypeError('La fuente canónica debe ser texto HTML.');
  }

  const bodyOpen = /<body(?:\s[^>]*)?>/i.exec(source);
  const bodyCloseIndex = source.toLowerCase().lastIndexOf('</body>');
  if (!bodyOpen || bodyCloseIndex < bodyOpen.index + bodyOpen[0].length) {
    throw new Error('La fuente canónica no contiene un body HTML completo.');
  }
  const body = source.slice(
    bodyOpen.index + bodyOpen[0].length,
    bodyCloseIndex,
  );

  const hostMatches = [...body.matchAll(/<div\s+data-tkf-simulador="pagina"\s*><\/div>/g)];
  if (hostMatches.length !== 1) {
    throw new Error('La fuente canónica debe tener exactamente un host de simulador.');
  }

  const marker = hostMatches[0][0];
  let block = body.replace(marker, '<div data-tkf-simulador="bloque"></div>');
  const configOpen = block.indexOf('<script>', hostMatches[0].index);
  const configClose = block.indexOf('</script>', configOpen);
  if (configOpen < 0 || configClose < 0) {
    throw new Error('La fuente canónica no contiene el script de configuración.');
  }

  const configuration = {
    modo: 'publico',
    correo: {
      endpoint: typeof options.endpoint === 'string' ? options.endpoint : '',
      obligatorio: false,
      politicaUrl:
        typeof options.privacyUrl === 'string' ? options.privacyUrl : '',
      academia: 'TÉCNIKA FIRE',
    },
    manifestUrl:
      typeof options.manifestUrl === 'string' && options.manifestUrl
        ? options.manifestUrl
        : 'https://app.tecnikafire.com/simulador-nota/manifest.json',
  };
  const generatedConfig = `<script>window.TKF_SIMULADOR_CONFIG = ${safeJson(configuration)};</script>`;
  block =
    block.slice(0, configOpen) +
    generatedConfig +
    block.slice(configClose + '</script>'.length);

  for (const [path, name] of Object.entries(OPPOSITION_IMAGE_PATHS)) {
    if (!block.includes(path)) continue;
    const image = options.oppositionImages?.[name];
    if (!Buffer.isBuffer(image)) {
      throw new Error(`Falta la imagen PNG canónica de ${name} para el bloque WordPress.`);
    }
    block = block.replaceAll(path, `data:image/png;base64,${image.toString('base64')}`);
  }

  return block.trim() + '\n';
}

function parseArgs(args) {
  const options = {
    output: DEFAULT_OUTPUT,
    endpoint: process.env.SIMULADOR_NOTA_CORREO_ENDPOINT || '',
    privacyUrl: process.env.SIMULADOR_NOTA_POLITICA_URL || '',
    manifestUrl:
      process.env.SIMULADOR_NOTA_MANIFEST_URL ||
      'https://app.tecnikafire.com/simulador-nota/manifest.json',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--output') {
      options.output = args[++index];
      if (!options.output) throw new Error('Falta el valor de --output.');
    } else if (arg === '--endpoint') {
      options.endpoint = args[++index];
      if (options.endpoint === undefined)
        throw new Error('Falta el valor de --endpoint.');
    } else if (arg === '--privacy-url') {
      options.privacyUrl = args[++index];
      if (options.privacyUrl === undefined)
        throw new Error('Falta el valor de --privacy-url.');
    } else if (arg === '--manifest-url') {
      options.manifestUrl = args[++index];
      if (options.manifestUrl === undefined)
        throw new Error('Falta el valor de --manifest-url.');
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Uso: node scripts/build-simulador-nota-wordpress.mjs [--endpoint URL] [--privacy-url URL] [--manifest-url URL] [--output RUTA|-]\n' +
        'Configuración alternativa: SIMULADOR_NOTA_CORREO_ENDPOINT, SIMULADOR_NOTA_POLITICA_URL y SIMULADOR_NOTA_MANIFEST_URL.\n' +
        'Salida predeterminada: dist/simulador-nota-wordpress.html (generada, no versionada).\n',
    );
    return;
  }

  const source = await readFile(SOURCE, 'utf8');
  const oppositionImages = {
    ALICANTE: await readFile(resolve(ROOT, 'public/oposiciones/alicante.png')),
    VALENCIA: await readFile(resolve(ROOT, 'public/oposiciones/valencia.png')),
    MADRID: await readFile(resolve(ROOT, 'public/oposiciones/madrid.png')),
  };
  const result = buildWordPressBlock(source, { ...options, oppositionImages });
  if (options.output === '-') {
    process.stdout.write(result);
    return;
  }

  const output = resolve(options.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, result, 'utf8');
  process.stdout.write(`Bloque WordPress generado: ${output}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
