import progresoJs from './psico-progreso.frame';
import retoJs from './psico-reto.frame';

import { sustituir } from '../estudio/estudio-documento.util';

function seccion(
  html: string,
  desde: string,
  hasta: string,
  contenido: string,
): string {
  const inicio = html.indexOf(desde);
  const fin = html.indexOf(hasta, inicio + desde.length);
  if (inicio < 0 || fin < 0)
    throw new Error(
      'La sección del visor no coincide con la versión integrada',
    );
  return html.slice(0, inicio) + contenido + '\n' + html.slice(fin);
}

export function adaptarPsico(html: string): string {
  // Las secciones docentes y el motor común se conservan. La integración reemplaza la conexión de la app autónoma.
  const marcador = '<!--TF_CONFIG_AQUI-->';
  if (!html.includes(marcador))
    throw new Error('Falta el marcador de Psicotécnicos');
  const inicio = html.indexOf("const KEY='tf_psico_v1'");
  if (inicio < 0) throw new Error('No se encuentra la interfaz v5');
  let motor = seccion(
    html.slice(0, inicio),
    '<nav class="bottom"',
    '<!-- CONEXIÓN CON LA PLATAFORMA',
    '',
  ).replace(/(<header class="top"><div class="in">)<img\b[^>]*>/, '$1');
  const perfil =
    '<button class="pfp" id="pfp" data-act="toPerfil" title="Cambiar de oposición"></button>';
  motor = sustituir(motor, perfil, '');
  motor = sustituir(
    motor,
    '</nav></div></header>',
    `</nav>${perfil}</div></header>`,
  );
  let interfaz = html.slice(inicio);
  interfaz = seccion(
    interfaz,
    `  return '<section class="hero"><span class="tag">Psicotécnicos`,
    `  '<h2 class="h">Las `,
    `
  return '<section class="hero inicio"><h1>Entrenamiento psicotécnico</h1>'+
  '<div class="row inicio-acciones"><button class="btn red" data-act="warm">Calentamiento · 10 preguntas</button><button class="btn line" data-nav="practicar">Practicar</button><button class="btn line" data-nav="reto">Reto semanal</button></div>'+
  '<div class="kpis"><div><b>'+st+'</b><span>día'+(st===1?'':'s')+' de racha</span></div><div><b>'+td+'</b><span>preguntas hoy</span></div><div><b>'+due+'</b><span>fallos para repasar hoy</span></div></div></section>'+opoSel()+
`,
  );
  interfaz = sustituir(
    interfaz,
    "document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===k))",
    "document.querySelectorAll('.tabs [data-nav]').forEach(b=>{const activa=b.dataset.nav===k;b.classList.toggle('on',activa);if(activa)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})",
  );
  interfaz = seccion(
    interfaz,
    "const KEY='tf_psico_v1'",
    'const def=',
    "const $=s=>document.querySelector(s),LV=['','Básico','Medio','Avanzado'];",
  );
  interfaz = seccion(
    interfaz,
    'let DB=',
    'const save=',
    `
let DB=def();
const CFG={api:true}, NET={on:false,user:null,rank:{},msg:'Conectando con tu cuenta…',at:0,pend:false};`,
  );
  interfaz = sustituir(
    interfaz,
    'lsave();if(NET.on){NET.pend=true;clearTimeout(pushT);pushT=setTimeout(push,2500)}',
    'progreso.changed()',
  );
  interfaz = seccion(
    interfaz,
    'async function api(',
    'function merge3(',
    `
const J=x=>progreso.ordered(x),isSt=x=>!!(x&&typeof x==='object'&&x.st&&typeof x.st==='object');`,
  );
  interfaz = seccion(
    interfaz,
    '/* La copia de la cuenta',
    '/* ---------- Pictogramas',
    `
const puente=window.TF_ESTUDIO;
${progresoJs}
const progreso=sincronizarProgresoPsico(puente,{
  net:NET,crear:def,get:()=>DB,set:db=>{DB=db},merge:merge3,
  repaint:()=>{if(!busy()&&VIEWS[CUR]&&!document.activeElement?.matches('input,textarea'))render(here())}
});
const api=progreso.api,push=progreso.push;
const refreshMe=()=>progreso.refresh();
function loadRank(k){const perfil=PID(),key=wkKey(k,perfil);api('/week/'+k+'/ranking'+qp(perfil)).then(r=>{
  NET.rank[key]=r;if(CUR==='reto'&&PID()===perfil)$('#app').innerHTML=vReto()
}).catch(()=>{if(CUR==='reto'&&PID()===perfil&&$('#rankstatus'))$('#rankstatus').textContent='Ranking no disponible. Vuelve a la sección para reintentar.';delete NET.rank[key]})}
`,
  );
  interfaz = sustituir(interfaz, "dispositivo. '+syncTxt()", "dispositivo.'");
  interfaz = seccion(
    interfaz,
    '  week:(d,el)=>',
    '  weekReview:',
    `
  week:(d,el)=>{if(el){el.disabled=true;el.textContent='Preparando…'}reto.start()},
  retryOfficial:()=>reto.retry(),
  removeAlias:()=>api('/alias','PUT',{alias:null}).then(()=>{NET.user.alias=null;NET.rank={};$('#app').innerHTML=vReto()}).catch(()=>{$('#aliasmsg').textContent='No se pudo retirar el alias.'}),`,
  );
  interfaz = sustituir(
    interfaz,
    '<input id="alias" maxlength=',
    '<input id="alias" aria-label="Alias para el ranking" maxlength=',
  );
  interfaz = sustituir(
    interfaz,
    `+'</button><span id="aliasmsg" class="note"></span>`,
    `+'</button>'+(al?'<button class="btn line sm" data-act="removeAlias">Retirar alias</button>':'')+'<span id="aliasmsg" class="note" role="status"></span>`,
  );
  interfaz = sustituir(
    interfaz,
    '<p class="note">Cargando ranking…',
    '<p id="rankstatus" class="note">Cargando ranking…',
  );
  interfaz = sustituir(
    interfaz,
    'DB=def();DB.perfil=pf;',
    'DB=def();DB._reset=puente.operationId();DB.perfil=pf;',
  );
  interfaz = sustituir(interfaz, 'location.hash=v', "location.replace('#'+v)");
  interfaz = seccion(
    interfaz,
    'function startRemote()',
    'function endSession(',
    `
${retoJs}
const reto=conectarRetoPsico(puente,{
  perfil:PID,get:()=>S,
  start:(data,pid)=>{
    const res=data.answers.map(sel=>sel!==null&&sel>=0?{sel}:undefined);
    const i=Math.max(0,data.questions.findIndex((_,index)=>!res[index]));
    startSession({title:'Reto semanal · oficial',remote:true,pid,rq:data.questions,
      items:data.questions.map(({g,l,f,r})=>({g,l,f,r})),i,res,mode:'exam',time:'global',pen:data.pen,cv:true,
      week:data.week,attemptId:data.attemptId,gLeft:data.leftSecs*1000});
  },
  outcome:(data,show)=>showServerResult(data,show),
  startingFailed:()=>{if(CUR==='reto'){
    const m=$('#retomsg');if(m)m.textContent='Necesitas conexión con la academia para iniciar el reto.';
    const boton=$('[data-act=week]');if(boton){boton.disabled=false;boton.textContent='Reintentar'}
  }},
  sendingFinish:()=>{clearInterval(TICK);S.phase='send';$('#app').innerHTML='<div class="qcard"><p role="status">Enviando y corrigiendo el reto…</p></div>'},
  connectionLost:finishing=>{
    if(finishing)$('#app').innerHTML='<div class="qcard"><p role="status">El envío está pendiente. El tiempo oficial sigue corriendo.</p><button class="btn red" data-act="retryOfficial">Reintentar</button> <button class="btn line" data-act="toReto">Volver al reto</button></div>';
    else if($('#netmsg'))$('#netmsg').textContent='Hay respuestas pendientes de enviar. El tiempo oficial sigue corriendo.';
  },
  clearNotice:()=>{if($('#netmsg'))$('#netmsg').textContent=''}
});
const sendAns=reto.answer,finishRemote=reto.finish,netMsg=()=>{};
function showServerResult(R,show=true){
  const pid=R.perfil||'cv',k=R.week,key=wkKey(k,pid),resultado=wsum(R);
  if(J(DB.week[key])!==J(resultado)){DB.week[key]=resultado;save();push()}
  if(NET.user&&NET.user.retos&&NET.user.retos[pid]?.week===k){NET.user.retos[pid]={...NET.user.retos[pid],status:'done',result:resultado}}
  delete NET.rank[key];
  if(show){clearInterval(TICK);if(S)S.live=false;renderResults(Object.assign({title:'Reto semanal · nota oficial',official:true},R))}
}`,
  );
  interfaz = sustituir(
    interfaz,
    "render(decodeURIComponent(location.hash.replace('#',''))||'inicio');syncInit();",
    `
puente.configure({retry:()=>{progreso.retry();reto.retry()},flush:()=>{progreso.flush();reto.flush()}});
render(decodeURIComponent(location.hash.replace('#',''))||'inicio');
progreso.refresh(true).then(reto.retry);
`,
  );
  return motor + interfaz;
}
