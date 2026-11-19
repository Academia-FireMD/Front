// Se inyecta en los documentos aislados. Las reglas del material para imprimir
// y los colores de los ejercicios y las anotaciones siguen en sus hojas de estilo.
export const PSICO_PRESENTACION = `
  :root {
    --bg: var(--campus-fondo);
    --card: var(--campus-superficie);
    --ink: var(--campus-texto);
    --mut: var(--campus-secundario);
    --line: var(--campus-borde);
    --red: var(--campus-accion);
  }
  body { font-size: 15px; }
  header.top { background: var(--card); border-bottom: 1px solid var(--line); }
  header.top .in { justify-content: flex-start; gap: .4rem; padding-block: .25rem; }
  nav.tabs { display: block; flex: 1; min-width: 0; margin: 0; }
  nav.tabs .p-tabmenu-nav {
    display: flex; flex-wrap: wrap; list-style: none;
    margin: 0; padding: 0; border: 0;
  }
  nav.tabs .p-menuitem-link {
    min-height: 44px; padding: .55rem .75rem;
    font-family: var(--bd); font-size: .875rem;
    letter-spacing: 0; text-transform: none;
  }
  .pfp, .mono2 {
    background: var(--campus-suave); color: var(--ink); border: 1px solid var(--line);
    border-radius: 6px; transform: none; letter-spacing: 0;
    font: 700 .875rem var(--bd);
  }
  .pfp { position: static; min-height: 44px; padding: .35rem .65rem; }
  .pfp:hover { background: var(--campus-suave); border-color: var(--campus-acento); }
  main { padding-bottom: 2rem; }
  h1, h2, h3, h4 { text-transform: none; line-height: 1.25; }
  .h { font-size: 1.25rem; }
  h3 { font-size: 1.1rem; }
  .lbl, .h small { color: var(--campus-acento); letter-spacing: 0; text-transform: none; }
  .hero, .hero.sm {
    background: var(--card); color: var(--ink); border: 1px solid var(--line);
    padding: 1rem; margin-inline: 0; border-radius: 8px;
  }
  .hero.inicio { padding: 0; }
  .hero.inicio .p-card-body { padding: 1rem; }
  .hero h1, .hero.sm h1 { font-size: clamp(1.28rem, 4vw, 1.7rem); font-weight: 650; }
  .hero h1 em, .hero p { color: var(--mut); }
  .hero .tag { background: transparent; color: var(--mut); transform: none; padding: 0; margin-bottom: .4rem; font: 600 .875rem var(--bd); letter-spacing: 0; text-transform: none; }
  .kpis { gap: .5rem; margin: .9rem 0 0; }
  .kpis div, .kpis.light div {
    background: var(--card); border: 1px solid var(--line); border-radius: 8px;
    padding: .6rem .7rem; min-width: 0;
  }
  .kpis b { font: 650 1.25rem/1.2 var(--bd); }
  .kpis span, .kpis.light span { font-size: .8rem; color: var(--mut); }
  .inicio .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .btn.p-button {
    font-family: var(--bd); font-size: .9rem;
    text-transform: none; letter-spacing: 0; min-height: 44px;
  }
  .btn.p-button:is(.line, .ghost) {
    background: transparent; color: var(--primary-color); border-color: var(--primary-color);
  }
  .btn.p-button:is(.line, .ghost):not(:disabled):hover {
    background: color-mix(in srgb, var(--primary-color) 8%, var(--card));
  }
  .card, .cat, .opoT, .tile { border-radius: 8px; background: var(--card); }
  .cat { overflow: hidden; }
  .cic, .cats.xt .cic { background: var(--campus-suave); color: var(--ink); border: 0; --acc: var(--campus-acento); }
  .cic, .cats.n3 .cic { height: clamp(3rem, 14vw, 5rem); }
  .cic svg, .cats.n3 .cic svg { width: clamp(2rem, 10vw, 3.25rem); height: auto; }
  .cat b, .cats.n3 .cat b { font: 650 .9rem/1.25 var(--bd); text-transform: none; }
  .opoT { min-height: 64px; gap: .6rem; }
  .opoT b { font: 650 .96rem/1.25 var(--bd); text-transform: none; }
  .opoT.on, .tile.on { border-color: var(--campus-acento); background: var(--campus-suave); }
  .mono2 img, .pfp img { width: 100%; height: 100%; object-fit: contain; }
  .pfp img { width: 2rem; height: 2rem; }
  .opoT.on .mono2 { color: var(--ink); }
  .mono2 { width: 2.8rem; height: 2.4rem; margin: 0; }
  .lnk { color: var(--campus-acento); }

  /* El arte del ejercicio usa el contraste del papel, también en modo oscuro. */
  .qcard, .rev, .paper, .tgrid {
    --ink: #1b1a1c; --mut: #605e64; --line: #d9dde2; --card: #fff;
    color: var(--ink); background: var(--card); border-radius: 8px;
  }
  .qcard .btn, .rev .btn { --campus-suave: #f4f6f8; }
  .qcard .lnk, .rev .lnk { color: var(--campus-accion); }
  @media (max-width: 760px) {
    header.top { position: static; }
    nav.tabs .p-menuitem-link { padding-inline: .5rem; }
    .hero.inicio .p-card-body { padding: .75rem; }
  }
`;

export const LIBRILLO_PRESENTACION = `
  :root { --bg: var(--campus-fondo); --panel: var(--campus-suave); --card: var(--campus-superficie); --ink: var(--campus-texto); --ink2: var(--campus-secundario); --line: var(--campus-borde); --brand: var(--campus-accion); }
  .app > .bar, .app > .tabs {
    --bar: var(--card); --bar-ink: var(--ink); --bar-mute: var(--ink2); --bar-line: var(--line);
  }
  :root[data-theme="light"] { --brand: var(--campus-accion); }
  .app > .bar { gap: .55rem; padding: .45rem 1rem; border-bottom: 1px solid var(--line); }
  .app > .bar .logo, .app > .bar .doc, .app > .bar #sync { display: none; }
  .app > .bar .barbtn[data-act="prog"]::after { display: none; }
  .bar .step { flex: 1 1 auto; min-width: 0; }
  .bar .step select { min-width: 0; max-width: 100%; background: var(--card); color: var(--ink); }
  .bar .step button, .bar .step select, .bar > .barbtn { min-height: 44px; border-radius: 6px; }
  .bar .step button { width: 44px; flex-shrink: 0; }
  .bar > .barbtn {
    justify-content: center; font: 650 .9rem var(--f-body);
    letter-spacing: 0; text-transform: none;
  }
  .bar > .barbtn.hot { background: var(--campus-accion); border-color: var(--campus-accion); color: var(--primary-color-text); }
  .bar .kpi b { font-size: 1rem; }
  .bar .kpi span { letter-spacing: 0; }
  .btn, .barbtn, .bar .step button, .bar .step select { font-family: var(--f-body); letter-spacing: 0; text-transform: none; border-radius: 6px; }
  .btn { min-height: 44px; font-size: .9rem; }
  .tog[aria-pressed="true"] {
    background: color-mix(in srgb, var(--brand) 12%, var(--card));
    border-color: color-mix(in srgb, var(--brand) 45%, var(--card));
    color: var(--ink);
  }
  .side .shd {
    padding-block: .3rem .6rem;
    border-bottom: 1px solid var(--line);
    margin-bottom: .6rem;
  }
  .side .shd .eyebrow {
    color: var(--ink); font-size: .95rem; font-weight: 650;
  }
  .side .shd .eyebrow::before { display: none; }
  .p-accordion .p-accordion-header .ah {
    padding: .6rem .7rem; font-family: var(--f-body); font-size: .95rem;
    border-color: var(--line); background: var(--card); color: var(--ink);
  }
  .p-accordion .p-accordion-header.p-highlight > .ah {
    background: var(--panel); border-color: var(--line); box-shadow: none;
  }
  .shd .eyebrow, .ah .at, .dif { text-transform: none; letter-spacing: 0; }
  .fc .front { text-transform: none; letter-spacing: 0; font-size: 1.15rem; line-height: 1.3; }
  .tabs button { letter-spacing: 0; text-transform: none; }
  .tabs button[aria-selected="true"] { color: var(--ink); border-top-color: var(--brand); }
  @media (max-width: 560px) {
    .app > .bar { padding-inline: .65rem; }
    .bar .step { flex-basis: 100%; }
  }
`;
