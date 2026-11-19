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
  motor = motor.replace(
    /<nav class="tabs" aria-label="Secciones">([\s\S]*?)<\/nav>/,
    (_nav, botones: string) => {
      const secciones = [
        ...botones.matchAll(/<button data-nav="([^"]+)">([^<]+)<\/button>/g),
      ];
      const secundarias = ['fallos', 'trucos', 'progreso'];
      const item = (ruta: string, titulo: string, soloEscritorio = false) =>
        `<li class="p-tabmenuitem${soloEscritorio ? ' psico-tab-secundaria' : ''}"><button type="button" class="p-menuitem-link" data-nav="${ruta}">${titulo}</button></li>`;
      const items = secciones
        .map(([, ruta, titulo]) =>
          item(
            ruta,
            ruta === 'reto'
              ? `<span class="psico-escritorio">${titulo}</span><span class="psico-movil">Reto</span>`
              : titulo,
            secundarias.includes(ruta),
          ),
        )
        .join('');
      const mas = secciones
        .filter(([, ruta]) => secundarias.includes(ruta))
        .map(([, ruta, titulo]) => item(ruta, titulo))
        .join('');
      return `<nav class="tabs p-tabmenu p-component" aria-label="Secciones"><ul class="p-tabmenu-nav">${items}
        <li class="p-tabmenuitem psico-mas"><details id="psico-mas"><summary class="p-menuitem-link">Más <span class="psico-chevron" aria-hidden="true"></span></summary><ul class="psico-mas-opciones">${mas}</ul></details></li>
      </ul></nav>${perfil}`;
    },
  );
  let interfaz = html.slice(inicio);
  interfaz = sustituir(
    interfaz,
    "function pill(){const b=$('#pfp');if(b){b.textContent=P().tag;b.setAttribute('aria-label','Oposición: '+P().n+'. Cambiar')}}",
    "function pill(){const b=$('#pfp');if(b){b.innerHTML=perfilImagen(PID(),P().tag);b.setAttribute('aria-label','Oposición: '+P().n+'. Cambiar')}}",
  );
  interfaz = sustituir(
    interfaz,
    '<span class="lbl">¿Qué oposición preparas?</span><div class="opos">',
    '<span class="lbl psico-escritorio">¿Qué oposición preparas?</span>\'+formatoCompacto()+\'<div class="opos" id="psico-formatos">',
  );
  interfaz = sustituir(
    interfaz,
    '+p.tag+\'</span><span class="ot"><b>\'',
    '+perfilImagen(k,p.tag)+\'</span><span class="ot"><b>\'',
  );

  interfaz = seccion(
    interfaz,
    `  return '<section class="hero"><span class="tag">Psicotécnicos`,
    `  '<h2 class="h">Las `,
    `
  return '<div class="inicio-resumen"><section class="hero inicio p-card p-component"><div class="p-card-body"><h1 class="p-card-title">Entrenamiento psicotécnico</h1>'+
  '<div class="inicio-acciones"><button class="btn red" data-act="warm">Calentamiento · 10 preguntas</button></div>'+
  '<div class="kpis">'+indicadorInicio(st,'Racha','día'+(st===1?'':'s')+' de racha')+
  indicadorInicio(td,'Hoy','preguntas hoy')+indicadorInicio(due,'Para repasar','fallos para repasar hoy')+
  '</div></div></section>'+opoSel()+'</div>'+
`,
  );
  interfaz = sustituir(
    interfaz,
    "document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===k))",
    'actualizarNavegacion(k)',
  );
  interfaz = sustituir(
    interfaz,
    "if(!busy())render(decodeURIComponent(location.hash.replace('#',''))||'inicio')",
    "const ruta=decodeURIComponent(location.hash.replace('#',''))||'inicio';if(!busy()&&(ruta!==here()||!VIEWS[CUR]))render(ruta)",
  );
  interfaz = seccion(
    interfaz,
    "const KEY='tf_psico_v1'",
    'const def=',
    `const $=s=>document.querySelector(s),LV=['','Básico','Medio','Avanzado'];
function perfilImagen(k,texto){const src=window.TF_PERFILES_IMAGENES[k];return src?'<img src="'+src+'" alt="" onerror="this.replaceWith(document.createTextNode(&quot;'+texto+'&quot;))">':texto}
function indicadorInicio(valor,corto,largo){
  return '<div><b>'+valor+'</b><span class="psico-movil">'+corto+'</span><span class="psico-escritorio">'+largo+'</span></div>';
}
let formatoAbierto=false;
function formatoCompacto(){
  return '<button type="button" class="psico-formato" id="formato-movil" data-act="formato" aria-label="Formato de examen: '+P().n+'. Cambiar" aria-controls="psico-formatos" aria-expanded="'+formatoAbierto+'">'+
    '<span class="mono2">'+perfilImagen(PID(),P().tag)+'</span><span>'+P().n+'</span><span class="psico-chevron" aria-hidden="true"></span></button>';
}
function mostrarFormatos(abierto,devolverFoco=false){
  formatoAbierto=abierto;
  const boton=$('#formato-movil');
  if(!boton)return;
  boton.setAttribute('aria-expanded',String(abierto));
  if(devolverFoco)boton.focus({preventScroll:true});
}
function cerrarMas(devolverFoco=false){
  const menu=$('#psico-mas');
  if(!menu.open)return;
  menu.open=false;
  if(devolverFoco)menu.querySelector('summary').focus({preventScroll:true});
}
function actualizarNavegacion(ruta){
  document.querySelectorAll('.tabs [data-nav]').forEach(b=>{
    const activa=b.dataset.nav===ruta;
    b.parentElement.classList.toggle('p-highlight',activa);
    if(activa)b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  $('.psico-mas').classList.toggle('p-highlight',!!$('#psico-mas [aria-current]'));
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#psico-mas'))cerrarMas();
  else if(e.target.closest('[data-nav]'))cerrarMas(true);
  if(formatoAbierto&&!e.target.closest('#oposel,[data-act="toPerfil"]'))mostrarFormatos(false);
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if($('#psico-mas').open)cerrarMas(true);
  else if(formatoAbierto)mostrarFormatos(false,true);
});`,
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
    '  perfil:d=>',
    '  warm:',
    `
  formato:()=>mostrarFormatos(!formatoAbierto),
  perfil:d=>{
    if(!PERFILES[d.p])return;
    const y=window.scrollY,devolverFoco=formatoAbierto;
    mostrarFormatos(false);
    if(d.p!==PID()){
      DB.perfil=d.p;DB.cfg.cat='';DB.cfg.sub='*';save();NET.fresh=0;
      render(here());window.scrollTo(0,y);
    }
    if(devolverFoco)mostrarFormatos(false,true);
  },
  toPerfil:()=>{
    if(busy())return;
    formatoAbierto=true;
    go('inicio');
    $('#oposel')?.scrollIntoView({block:'center'});
    $('#formato-movil')?.focus({preventScroll:true});
  },`,
  );
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
  return (motor + interfaz)
    .replace(
      /class="btn (line|ghost)(?=[\s"])/g,
      'class="btn p-button-outlined $1',
    )
    .replace(/class="btn(?=[\s"])/g, 'class="p-button p-component btn');
}
