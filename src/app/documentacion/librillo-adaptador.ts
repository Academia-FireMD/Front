import { sustituir } from '../estudio/estudio-documento.util';
import anclasJs from './librillo-anclas.frame';
import borradoJs from './librillo-borrado.frame';

export function adaptarLibrillo(html: string): string {
  if (!html.includes('<!--TF_LIBRILLO_CONFIG:'))
    throw new Error('Falta el marcador del Librillo');
  const inicio = html.indexOf(
    'const QS = new URLSearchParams(location.search);',
  );
  const fin = html.indexOf('// ui: secciones abiertas', inicio);
  if (inicio < 0 || fin < 0)
    throw new Error('No se encuentra la interfaz del Librillo');
  let app = html.slice(fin);
  const prefijo = html.slice(0, inicio);
  app = app.replaceAll('localStorage.', 'borrador.');
  app = sustituir(
    app,
    'Object.assign(d, r);',
    `
      Object.assign(d, r);
      d.hoja = Math.max(0, anclas.indice(r.hoja));
      d.marks = anclas.desempaquetar('marks', r.marks);
      d.own = anclas.desempaquetar('own', r.own);
  `,
  );
  app = sustituir(
    app,
    'borrador.setItem(KEY, JSON.stringify(S))',
    'borrador.setItem(KEY, serializarEstadoLibrillo())',
  );
  app = sustituir(
    app,
    'clearTimeout(saveT); saveT = setTimeout(saveNow, 120); syncTouch();',
    'saveNow(); syncTouch();',
  );
  app = sustituir(
    app,
    "const nkey = hi => KEY + ':n' + hi;",
    "const nkey = hi => 'n' + anclas.hoja(hi);",
  );
  app = sustituir(
    app,
    "const ikey = hi => KEY + ':i' + hi;",
    "const ikey = hi => 'i' + anclas.hoja(hi);",
  );
  app = sustituir(
    app,
    "const skey = () => KEY + ':sync';",
    "const skey = () => 'sync';",
  );
  app = sustituir(
    app,
    "clearTimeout(noteT); noteT = setTimeout(flushNote, 300); syncDirty('notas' + hi);",
    "flushNote(); syncDirty('notas' + anclas.hoja(hi));",
  );
  app = sustituir(
    app,
    "clearTimeout(inkT); inkT = setTimeout(flushInk, 300); syncDirty('tinta' + hi);",
    "flushInk(); syncDirty('tinta' + anclas.hoja(hi));",
  );
  app = sustituir(
    app,
    "if (n === 'subr') return {marks: S.marks, own: S.own};",
    "if (n === 'subr') return {marks: anclas.empaquetar('marks', S.marks), own: anclas.empaquetar('own', S.own)};",
  );
  app = sustituir(
    app,
    "if (n === 'pos') return {hoja: S.hoja};",
    "if (n === 'pos') return {hoja: anclas.hoja(S.hoja), edicion: puente.edition};",
  );
  app = sustituir(
    app,
    'const m = HP.exec(n); if (!m || !DOC.hojas[+m[2]]) return null;',
    'const m = HP.exec(n); const hi = m ? anclas.indice(m[2]) : -1; if (hi < 0) return null;',
  );
  app = sustituir(
    app,
    'inkOf(+m[2]).s; return s.length ? {s: s.map(strip)}',
    'inkOf(hi).s; return s.length ? {s: s.map(strip), edicion: puente.edition}',
  );
  app = sustituir(
    app,
    'noteOf(+m[2]); return x.s.length || x.t.length || x.h !== NH0 ? {h: x.h, s: x.s, t: x.t}',
    'noteOf(hi); return x.s.length || x.t.length || x.h !== NH0 ? {h: x.h, s: x.s, t: x.t, edicion: puente.edition}',
  );
  app = sustituir(
    app,
    'S.marks = obj(d.marks); S.own = obj(d.own);',
    "S.marks = anclas.desempaquetar('marks', d.marks); S.own = anclas.desempaquetar('own', d.own);",
  );
  app = sustituir(
    app,
    'const hi = +m[2]; if (!DOC.hojas[hi])',
    'const hi = anclas.indice(m[2]); if (hi < 0)',
  );
  app = sustituir(
    app,
    `const M = SY.meta, idx = obj(await SY.ad.indice());
  const want = Object.keys(idx).filter(n => PARTOK.test(n) && idx[n] !== M.at[n]);`,
    `const M = SY.meta, respuesta = await SY.ad.indice();
  if (M !== SY.meta) return;
  const borrado = respuesta.borrado ?? 0;
  if (borrado !== marcaBorrado.borrado) {
    await aceptarBorradoRemoto(borrado);
    return;
  }
  const idx = obj(respuesta.partes);
  const want = Object.keys(idx).filter(n => parteDeEstaEdicion(n) && idx[n] !== M.at[n]);`,
  );
  app = sustituir(
    app,
    'const got = want.length ? obj(await SY.ad.leer(want)) : {};',
    'const got = want.length ? obj(await SY.ad.leer(want)) : {};\n  if (M !== SY.meta) return;',
  );
  app = sustituir(
    app,
    "if (n === 'pos') { if (SY.first && isO(rd) && rd.hoja !== S.hoja && DOC.hojas[rd.hoja]) SY.otra = rd.hoja; setBase(n, rd, R.j, R.at); continue; }",
    `
    if (n === 'pos') {
      const hi = anclas.indice(rd.hoja);
      if (SY.first && !partDirty(n) && hi >= 0 && hi !== S.hoja) { S.hoja = hi; ch.main = true; }
      setBase(n, rd, R.j, R.at); continue;
    }
  `,
  );
  app = sustituir(
    app,
    "['at', 'bj', 'hb'].forEach",
    "['at', 'bj', 'hb', 'big'].forEach",
  );
  app = sustituir(
    app,
    'const syncPending = ',
    'const enviable = n => parteDeEstaEdicion(n) && partDirty(n) && SY.meta.big[n] !== hsh(partGet(n));\nconst syncPending = ',
  );
  app = sustituir(
    app,
    'if (PARTOK.test(n)) add(n); else undirty(n);',
    'if (enviable(n)) add(n);',
  );
  app = sustituir(
    app,
    'MAINP.forEach(n => { if (partDirty(n)) add(n); });',
    'MAINP.forEach(n => { if (enviable(n)) add(n); });',
  );
  app = sustituir(
    app,
    'SY.meta.dirty.length > 0 || MAINP.some(partDirty)',
    'marcaBorrado.pendiente || guardarMarca || SY.meta.dirty.some(enviable) || MAINP.some(enviable)',
  );
  app = sustituir(
    app,
    'const d = partGet(n), j = d == null ? null : J(d);',
    `const d = partGet(n), j = d == null ? null : J(d);
    if (j && j.length > 1024 * 1024) { M.big[n] = hsh(d); return; }`,
  );
  app = sustituir(
    app,
    'const res = obj(await SY.ad.guardar(out));\n  let conflict = false; SY.big = false;',
    'const res = obj(await SY.ad.guardar(out));\n  if (M !== SY.meta) return;\n  let conflict = false;',
  );
  app = sustituir(
    app,
    'if (r.ok) {\n      if (out[n].j',
    'if (r.ok) {\n      delete M.big[n];\n      if (out[n].j',
  );
  app = sustituir(
    app,
    'SY.big = true; undirty(n);',
    'M.big[n] = hsh(sent[n]);',
  );
  app = sustituir(
    app,
    'saveMeta(); SY.busy = false;',
    'SY.big = Object.keys(SY.meta.big).some(n => parteDeEstaEdicion(n) && partDirty(n));\n  saveMeta(); SY.busy = false;',
  );
  app = sustituir(
    app,
    'Object.keys(M.at).forEach(n => {',
    'Object.keys(M.at).filter(parteDeEstaEdicion).forEach(n => {',
  );
  app = sustituir(
    app,
    'partMerge(n, baseOf(n), sent[n], rd)',
    'partMerge(n, baseOf(n), partGet(n), rd)',
  );
  app = sustituir(
    app,
    'flushNote(); flushInk(); if (pull) await syncPull(ch); await syncPush(ch);',
    'await syncLibrillo(pull, ch);',
  );
  app = sustituir(
    app,
    '${U.cReset ? `<span class="note">Se borran respuestas',
    '${marcaBorrado.pendiente ? \'<span role="status">Borrado pendiente de sincronizar.</span>\' : U.cReset ? `<span class="note">Se borran respuestas',
  );
  app = sustituir(
    app,
    'bar.className = bar.className.replace',
    `puente.status(({local:'ready',ok:SY.big?'limited':'saved',pend:'pending',sync:'saving',off:'offline',auth:'error'})[st]);
  bar.className = bar.className.replace`,
  );

  const conexiones = app.indexOf('const who = a =>');
  const visibilidad = app.indexOf(
    "document.addEventListener('visibilitychange', () => { if (!SY.ad)",
    conexiones,
  );
  if (conexiones < 0 || visibilidad < 0)
    throw new Error('Falta el adaptador del Librillo');
  app =
    app.slice(0, conexiones) +
    `
function parteDeEstaEdicion(n) {
  const m = HP.exec(n);
  return PARTOK.test(n) && (!m || anclas.indice(m[2]) >= 0);
}
function syncStart() {
  loadMeta();
  SY.ad = CFG;
  puente.configure({retry:()=>syncRun(true),flush:()=>{flushNote(); flushInk(); saveNow(); saveMeta(); void syncRun(false)}});
  syncRun(true);
}
` +
    app.slice(visibilidad);

  app = adaptarBorrado(app);

  return (
    prefijo +
    `
const puente=window.TF_ESTUDIO;
const KEY='estado';
${anclasJs}
const anclas=anclasLibrillo(DOC);
const borrador={
  getItem:key=>puente.read(key),
  setItem:(key,value)=>{void puente.write(key,value).catch(()=>{})},
  removeItem:key=>{void puente.write(key,null).catch(()=>{})}
};
const CFG={
  indice:()=>puente.request({op:'indice'}),
  leer:async nombres=>(await puente.request({op:'leer',payload:nombres})).partes,
  guardar:async partes=>(await puente.request({op:'guardar',payload:partes,borrado:marcaBorrado.borrado})).partes
};
${borradoJs}
` +
    app
  );
}

function adaptarBorrado(app: string): string {
  const inicio = app.indexOf('  resetYes: () => {');
  const fin = app.indexOf('  simSet:', inicio);
  const inicioSync = app.indexOf('function syncReset()');
  const finSync = app.indexOf('/* Estado visible */', inicioSync);
  if ([inicio, fin, inicioSync, finSync].some((posicion) => posicion < 0))
    throw new Error('Falta la acción de borrado del Librillo');

  // Mantener el vaciado del visor editorial, compartido con el borrado remoto.
  let limpiar = app
    .slice(inicio, fin)
    .trim()
    .replace(/^resetYes: \(\) => \{/, 'function limpiarProgreso(marca) {')
    .replace(/},$/, '}');
  limpiar = sustituir(
    limpiar,
    'try { borrador.removeItem(nkey(i)); borrador.removeItem(ikey(i)); } catch (e) {} ',
    '',
  );
  limpiar = sustituir(
    limpiar,
    'syncMy(); syncMyc(); save(); closeOv(); applyHlMode(); renderAll(); syncReset();',
    `pen = ipen = null;
    anclas.desempaquetar('marks', {});
    anclas.desempaquetar('own', {});
    cambiarMarca(marca, serializarEstadoLibrillo());
    loadMeta();
    Object.assign(SY, {first: true, lastPull: 0, need: null, otra: null, big: false});
    syncMy(); syncMyc(); closeOv(); applyHlMode(); renderAll();`,
  );
  return (
    app.slice(0, inicioSync) +
    limpiar +
    '\n\n' +
    app.slice(finSync, inicio) +
    '  resetYes: syncReset,\n' +
    app.slice(fin)
  );
}
