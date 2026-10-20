import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const sourcePath = fileURLToPath(
  new URL('../public/simulador-nota/index.html', import.meta.url),
);
const html = readFileSync(sourcePath, 'utf8');
const templateMatch = html.match(/var TKF_PLANTILLA = ("(?:\\.|[^"\\])*");/);
assert.ok(templateMatch, 'la fuente canónica debe declarar su plantilla identificable');
const template = JSON.parse(templateMatch[1]);
const manifest = JSON.parse(
  readFileSync(new URL('../public/simulador-nota/manifest.json', import.meta.url), 'utf8'),
);

function assertSourceContains(pattern, message) {
  assert.equal(pattern.test(html), true, message);
}

function loadOriginalEngine(source) {
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1],
  );
  const engine = scripts.find((script) => script.includes('var TKFCore ='));
  assert.ok(engine, 'el HTML debe contener el motor de cálculo original');
  const appConfig = engine.indexOf('var TKF_CONFIG =');
  assert.notEqual(appConfig, -1, 'el motor debe conservar su inicio identificable');

  const context = { Buffer };
  runInNewContext(
    `${engine.slice(0, appConfig)}\nthis.parts={TKFCore,TKF_DATOS,TKFConv};\n})();`,
    context,
  );
  return context.parts;
}

describe('fuente canónica del simulador de nota', () => {
  it('muestra la imagen de oposición correcta en cada opción y en la cabecera', () => {
    const choices = [...template.matchAll(
      /<button type="button" class="choice" data-amb="([^"]+)" data-tipo="([^"]*)" aria-pressed="false">([\s\S]*?)<\/button>/g,
    )];

    assert.equal(choices.length, 3);
    assert.deepEqual(
      choices.map(([, ambito, tipo]) => [ambito, tipo]),
      [['cv', 'consorcio'], ['cv', 'ayuntamiento'], ['madrid', '']],
    );
    const expectedImages = [
      ['../oposiciones/alicante.png', '../oposiciones/cpbv.png'],
      ['../oposiciones/valencia.png'],
      ['../oposiciones/madrid.png'],
    ];
    for (const [index, images] of expectedImages.entries()) {
      const actual = [...choices[index][3].matchAll(
        /<img class="opposition-image" src="([^"]+)" alt="" aria-hidden="true">/g,
      )].map(([, src]) => src);
      assert.deepEqual(actual, images);
    }
    assert.match(
      template,
      /<img class="hdr__amb-opposition" data-el="amb-img" src="\.\.\/oposiciones\/alicante\.png" alt="" aria-hidden="true">/,
    );
    assert.match(
      template,
      /<img class="hdr__amb-opposition" data-el="amb-img-cpbv" src="\.\.\/oposiciones\/cpbv\.png" alt="" aria-hidden="true" hidden>/,
    );
    assert.match(
      html,
      /\$\('amb-img-cpbv'\)\.hidden = S\.ambito !== 'cv' \|\| S\.tipo !== 'consorcio'/,
    );
    assert.match(
      html,
      /\$\('amb-img'\)\.src = S\.ambito === 'madrid' \? '\.\.\/oposiciones\/madrid\.png' : S\.tipo === 'ayuntamiento' \? '\.\.\/oposiciones\/valencia\.png' : '\.\.\/oposiciones\/alicante\.png'/,
    );
  });

  it('mantiene paridad de puntuación CV/Madrid y posición histórica original', () => {
    const { TKFCore: core, TKFConv: convFactory, TKF_DATOS: data } =
      loadOriginalEngine(html);
    const valenciana = core.estadoEjemplo();
    core.aplicarAmbito(valenciana, 'cv', 'consorcio');
    const cvResult = core.calcular(valenciana);
    const conv = convFactory(core, data);
    const ranking = conv.evaluar(
      valenciana,
      cvResult,
      conv.porId('cpbv2023'),
      {},
    );

    const madrid = core.estadoEjemplo();
    core.aplicarAmbito(madrid, 'madrid');
    const madridResult = core.calcularMadrid(madrid);

    assert.deepEqual(
      {
        cvTotal: cvResult.total,
        cvOposicion: cvResult.oposicion,
        cvMeritos: cvResult.concurso,
        cvRanking: {
          n: ranking.cmp.n,
          corte: ranking.cmp.corte,
          posicion: ranking.cmp.posicion,
        },
        madridTotal: madridResult.total,
        madridFisicas: madridResult.bloques.fisicas,
        madridTest: madridResult.bloques.test,
      },
      {
        cvTotal: 25.5967,
        cvOposicion: 21.0667,
        cvMeritos: 4.53,
        cvRanking: { n: 533, corte: 21.07, posicion: 251 },
        madridTotal: 36.3638,
        madridFisicas: 23.586,
        madridTest: 12.7778,
      },
    );
  });

  it('los códigos compartibles no exportan la valoración médico/psicotécnica', () => {
    const { TKFCore: core } = loadOriginalEngine(html);
    const state = core.estadoVacio();
    state.psico = 'no';
    state.medico = 'apto';

    const imported = core.decodificar(core.codificar(state));

    assert.equal(imported.psico, 'pend');
    assert.equal(imported.medico, 'pend');
  });

  it('no usa transporte opaco de correo ni contiene DNI/NIE', () => {
    assert.equal(/sendBeacon|no-cors/i.test(html), false);
    assert.equal(/\b(?:DNI|NIE)\b/i.test(html), false);
  });

  it('conserva auditoría compacta con fuentes oficiales, fechas y hashes', () => {
    assert.equal(manifest.audit.candidateNames, 615);
    assert.equal(manifest.audit.officialTestRows, 615);
    assert.equal(manifest.audit.physicalRows.natacion.matched, 448);
    assert.equal(manifest.audit.physicalRows.velocidad.matched, 434);
    assert.equal(manifest.audit.pressOmittedAfterNoApto, 29);
    assert.equal(manifest.publishedThrough, '2026-10-15');
    assert.equal(manifest.verifiedOn, '2026-10-19');
    assert.ok(manifest.sources.length >= 7);
    for (const source of manifest.sources) {
      assert.match(source.url, /^https:\/\/www\.valencia\.es\//);
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
    }
  });

  it('declara con transparencia datos nominales, provisionales, estimados y el límite 200', () => {
    assertSourceContains(/Es provisional hasta la publicación del supuesto práctico y el listado final/i, 'El ranking provisional debe indicar cuándo dejará de serlo.');
    assertSourceContains(/estimaciones no oficiales.*confirmación del OTS/i, 'La media estimada de las pruebas convalidadas debe declararse no oficial.');
    assertSourceContains(/Quiero recibir por correo información de Técnika Fire/, 'El consentimiento debe tener el texto aprobado.');
    assertSourceContains(/He leído la /, 'El consentimiento debe enlazar la política de privacidad.');
    assertSourceContains(/text: 'política de privacidad'/, 'El consentimiento debe incluir el enlace a la política.');
    assertSourceContains(/ y puedo retirar mi consentimiento en admin@tecnikafire\.com\./, 'El consentimiento debe indicar cómo retirarlo.');
    assertSourceContains(/if \(guardadas\.length >= 200\)/, 'Guardar debe detenerse al alcanzar el máximo.');
    assertSourceContains(/guardadas\.length >= 200\).*limite\+\+/, 'Importar debe conservar el máximo y avisar si alcanza el límite.');
  });

  it('solo guarda estado médico y psicotécnico en sesión en el modo privado', () => {
    assertSourceContains(/modoPrivado \? false : INICIO\.limpio !== false/, 'El modo privado no debe leer almacenamiento local.');
    assertSourceContains(/if \(modoPrivado\) return null/, 'El modo privado no debe restaurar estado legacy.');
    assertSourceContains(/quitarDatosDeSesion\(S\)/, 'Los datos médicos y psicotécnicos deben salir del estado persistido.');
    assertSourceContains(/S\.psico = 'pend'; S\.medico = 'pend'/, 'La salud debe volver a pendiente al restaurar.');
    assertSourceContains(/TKF_SIMULADOR_ENVIAR_CORREO/, 'La captación debe delegarse al adaptador Promise.');
    assertSourceContains(/mensaje\.type !== 'hydrate'/, 'El iframe debe aceptar el mensaje de hidratación del padre.');
    assertSourceContains(/enviarAlPadre\('ready'\)/, 'El iframe debe anunciar su disponibilidad al padre.');
  });

});
