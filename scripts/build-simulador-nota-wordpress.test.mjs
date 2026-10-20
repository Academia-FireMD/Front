import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { buildWordPressBlock } from './build-simulador-nota-wordpress.mjs';

test('genera un bloque WP desde el body canónico y conserva el motor sin duplicarlo', () => {
  const engine = '<script>window.engine = "canonical";</script>';
  const source = `<!doctype html><html><head><title>source</title></head><body>
<div data-tkf-simulador="pagina"></div>
<script>window.TKF_SIMULADOR_CONFIG = {correo:{endpoint:"old"}};</script>
${engine}
</body></html>`;

  const block = buildWordPressBlock(source, {
    endpoint: 'https://example.test/lead?x=1&y=2',
    privacyUrl: 'https://example.test/politica',
    manifestUrl: 'https://example.test/manifest.json',
  });

  assert.match(block, /data-tkf-simulador="bloque"/);
  assert.doesNotMatch(block, /<!doctype html|<html|<head|<body/);
  assert.equal(block.split(engine).length - 1, 1);
  const configScript = block.match(/<script>([\s\S]*?)<\/script>/)[1];
  const window = {};
  runInNewContext(configScript, { window });
  assert.equal(window.TKF_SIMULADOR_CONFIG.modo, 'publico');
  assert.equal(window.TKF_SIMULADOR_CONFIG.manifestUrl, 'https://example.test/manifest.json');
  assert.equal(
    window.TKF_SIMULADOR_CONFIG.correo.endpoint,
    'https://example.test/lead?x=1&y=2',
  );
  assert.equal(
    window.TKF_SIMULADOR_CONFIG.correo.politicaUrl,
    'https://example.test/politica',
  );
  assert.doesNotMatch(block, /old/);
});

test('el generador conserva completa y parseable la fuente canónica real', () => {
  const sourcePath = fileURLToPath(
    new URL('../public/simulador-nota/index.html', import.meta.url),
  );
  const source = readFileSync(sourcePath, 'utf8');
  const oppositionImages = {
    ALICANTE: readFileSync(new URL('../public/oposiciones/alicante.png', import.meta.url)),
    VALENCIA: readFileSync(new URL('../public/oposiciones/valencia.png', import.meta.url)),
    MADRID: readFileSync(new URL('../public/oposiciones/madrid.png', import.meta.url)),
  };
  const block = buildWordPressBlock(source, { oppositionImages });
  const scripts = [...block.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];

  assert.equal(scripts.length, 2);
  assert.ok(block.includes(`data:image/png;base64,${oppositionImages.ALICANTE.toString('base64')}`));
  assert.ok(
    block.includes(`data:image/png;base64,${oppositionImages.VALENCIA.toString('base64')}`),
    'el bloque debe incrustar la imagen valenciana original',
  );
  assert.ok(
    block.includes(`data:image/png;base64,${oppositionImages.MADRID.toString('base64')}`),
    'el bloque debe incrustar la imagen madrileña original',
  );
  assert.doesNotMatch(block, /\.\.\/oposiciones\/(?:alicante|valencia|madrid)\.png/);
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script[1]));
  }
  const window = {};
  runInNewContext(scripts[0][1], { window });
  assert.equal(
    window.TKF_SIMULADOR_CONFIG.manifestUrl,
    'https://app.tecnikafire.com/simulador-nota/manifest.json',
  );
  assert.match(block, /TKFApp\.montarTodos/);
  assert.match(block, /var TKF_PLANTILLA =/);
  assert.match(block, /data-tkf-simulador="bloque"/);
  assert.ok(
    block.includes(
      'Quiero recibir por correo información de Técnika Fire sobre la preparación de oposiciones de bombero. He leído la política de privacidad y puedo retirar mi consentimiento en admin@tecnikafire.com.',
    ),
    'el bloque debe conservar el literal completo que reconoce el operador de WordPress',
  );
});

test('rechaza fuentes sin host y no genera un bloque parcial', () => {
  assert.throws(() => buildWordPressBlock('<html><body>sin host</body></html>', {}));
});
