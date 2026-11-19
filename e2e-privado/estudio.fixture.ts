import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, type Page, type Route } from '@playwright/test';
import alumnoFixture from '../e2e/fixtures/user-alumno.json';

type Perfil = 'cv' | 'cam';
type Rol = 'ALUMNO' | 'ADMIN' | 'SUPERADMIN';
type Json = Record<string, any>;
type Parte = { at: number; j: string };
const staging = process.env['ESTUDIO_QA_VARIANTE'] === 'staging';
const api = staging
  ? 'https://api-staging.tecnikafire.com'
  : 'http://localhost:3000';
const path = process.env['ESTUDIO_QA_SOURCES'];
if (!path)
  throw new Error(
    'Indica ESTUDIO_QA_SOURCES con la carpeta privada de las referencias completas.',
  );
const psico = readFileSync(
  join(path, 'psicotecnicos-tecnikafire.html'),
  'utf8',
);
const librillo = readFileSync(
  join(path, 'librillo-estatutos-R07.html'),
  'utf8',
);
const motor = require(join(path, 'servidor/psico-gen.js'));
const SEMANA = '2026-S47';
const DOC = 704;
const TEMA = 811;
const EDU = `/documentos/${DOC}/librillo`;
const curso = {
  id: 16,
  nombre: 'Normativa',
  temas: [
    {
      id: TEMA,
      numero: 4,
      descripcion: 'Estatutos de prueba',
      documentos: [
        {
          id: DOC,
          identificador: 'Original · Estatutos',
          isDownloadable: true,
          librillo: { edicion: 'R07', titulo: 'Estatutos del Consorcio' },
        },
        { id: DOC + 1, identificador: 'Modificación', isDownloadable: true },
        {
          id: DOC + 2,
          identificador: 'Resumen bloqueado',
          isLocked: true,
          isDownloadable: false,
        },
      ],
    },
  ],
};

interface Cuenta {
  state: Json | null;
  rev: number;
  updatedAt: number;
  alias: string | null;
  operaciones: Map<string, { body: string; reply: Json }>;
  partes: Map<string, Parte>;
  borrado: number;
  examenes: Partial<Record<Perfil, Json>>;
}

export function servidorEstudio() {
  const cuentas = new Map<number, Cuenta>();
  const peticiones: { account: number; endpoint: string; body: Json }[] = [];
  const opciones = {
    offline: false,
    pause: false,
    loseNextSave: false,
    loseNextReset: false,
    dinamica: 'R07',
    modulos: true,
    tipoSuscripcion: 'BASIC',
    suscripcionVigente: true,
    piloto: 1 as number | number[],
  };
  const avisos: Json[] = [];
  const cuenta = (id: number) => {
    if (!cuentas.has(id))
      cuentas.set(id, {
        state: null,
        rev: 0,
        updatedAt: 0,
        alias: null,
        operaciones: new Map(),
        partes: new Map(),
        borrado: 0,
        examenes: {},
      });
    return cuentas.get(id)!;
  };

  function publico(at: Json) {
    const { items, questionData, ...info } = at;
    return {
      ...info,
      questions: questionData.map(({ ans, exp, s, trap, ...q }: Json) => q),
    };
  }

  async function apiRoute(route: Route, id: number, rol: Rol, jwt: string) {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname;
    const p: Perfil = url.searchParams.get('p') === 'cam' ? 'cam' : 'cv';
    const body = request.postDataJSON() ?? {};
    const tienePiloto = [opciones.piloto].flat().includes(id);
    const json = (value: unknown, status = 200) =>
      route.fulfill({ status, json: value });
    const alumno = {
      ...alumnoFixture,
      id,
      rol,
      nombre: `Cuenta ${id}`,
      suscripciones: [
        {
          ...alumnoFixture.suscripciones[0],
          tipo: opciones.tipoSuscripcion,
          status: 'PENDING_CANCEL',
          fechaFin: opciones.suscripcionVigente
            ? '2099-01-01T00:00:00.000Z'
            : '2000-01-01T00:00:00.000Z',
        },
      ],
    };
    if (endpoint === '/api/app-config')
      return json({
        appName: 'QA Academia',
        primaryColor: '#bb292a',
        secondaryColor: '#004e89',
        updatedAt: new Date(0).toISOString(),
        logoUrl: null,
      });
    if (endpoint === '/api/app-config/modulos')
      return json({
        DOCUMENTACION: true,
        TEST: true,
        FLASHCARDS: true,
        PSICOTECNICOS: opciones.modulos,
        LIBRILLOS: opciones.modulos,
      });
    if (['/user/profile', '/user/me', '/user/get-by-email'].includes(endpoint))
      return json(alumno);
    if (endpoint === '/api/config') return json({ verifactuEnabled: false });
    if (endpoint.startsWith('/ai-assistant/')) return json({}, 403);
    if (endpoint === '/documentos/tree') {
      peticiones.push({ account: id, endpoint, body });
      const temas = curso.temas.map((tema) => ({
        ...tema,
        documentos: tema.documentos.map((documento) => ({
          ...documento,
          librillo: tienePiloto ? documento.librillo : undefined,
        })),
      }));
      return json([{ ...curso, temas }]);
    }
    if (endpoint.startsWith('/documentos/') && !endpoint.startsWith(EDU))
      return json({}, 404);
    if (!endpoint.startsWith('/psico') && !endpoint.startsWith(EDU))
      return json([]);
    if (request.headers()['authorization'] !== `Bearer ${jwt}`)
      return json({}, 401);
    if (endpoint.startsWith('/psico/admin') && rol === 'ALUMNO')
      return json({}, 403);
    if (!opciones.modulos) return json({}, 403);
    if (endpoint.startsWith(EDU) && !tienePiloto) return json({}, 404);
    const state = cuenta(id);
    peticiones.push({ account: id, endpoint, body });
    if (endpoint === '/psico/app')
      return route.fulfill({
        body: psico,
        contentType: 'text/html; charset=utf-8',
        headers: { 'Cache-Control': 'private, no-store' },
      });
    if (endpoint === EDU)
      return json({
        documentoId: DOC,
        edicion: opciones.dinamica,
        titulo: 'Estatutos del Consorcio',
      });
    if (
      endpoint.startsWith(EDU) &&
      url.searchParams.get('edicion') !== opciones.dinamica
    )
      return json({ message: 'La edición del librillo ha cambiado' }, 409);
    if (endpoint === EDU + '/app') {
      const html =
        opciones.dinamica === 'R07'
          ? librillo
          : librillo.replace(
              'const DOC = {',
              `TXT[1].bloques[0][1] += ' [Edición de QA]';\nconst DOC = {`,
            );
      return route.fulfill({
        body: html,
        contentType: 'text/html; charset=utf-8',
      });
    }
    if (opciones.offline) return route.abort('internetdisconnected');
    if (endpoint === '/psico/me') {
      const reto = (p: Perfil) => ({
        week: SEMANA,
        status: state.examenes[p]?.status ?? 'none',
        mins: p === 'cam' ? 44 : 25,
        pen: p === 'cam' ? 1 / 3 : 0.33,
        result: state.examenes[p]?.result,
      });
      return json({
        id,
        state: state.state,
        rev: state.rev,
        updatedAt: state.updatedAt,
        alias: state.alias,
        perfilSugerido: id === 1 ? 'cam' : 'cv',
        retos: { cv: reto('cv'), cam: reto('cam') },
      });
    }
    if (endpoint === '/psico/state') {
      while (opciones.pause) await new Promise((ok) => setTimeout(ok, 25));
      if (opciones.offline) return route.abort('internetdisconnected');
      const known = state.operaciones.get(body.opId);
      if (known)
        return JSON.stringify(body) === known.body
          ? json(known.reply)
          : json({}, 409);
      if (state.rev !== body.rev)
        return json(
          { state: state.state, rev: state.rev, updatedAt: state.updatedAt },
          409,
        );
      state.state = body.state;
      state.updatedAt = Date.now();
      const reply = { rev: ++state.rev, updatedAt: state.updatedAt };
      state.operaciones.set(body.opId, { body: JSON.stringify(body), reply });
      if (opciones.loseNextSave) {
        opciones.loseNextSave = false;
        return route.abort('failed');
      }
      return json(reply);
    }
    if (endpoint === '/psico/alias') {
      state.alias = body.alias;
      return json({ alias: state.alias });
    }
    if (endpoint === '/psico/report') {
      avisos.push(body);
      return json({ ok: true });
    }
    if (endpoint === '/psico/week/start') {
      const examen = (state.examenes[p] ??= crearExamen(p));
      return json(examen.result ?? publico(examen));
    }
    if (
      endpoint === '/psico/week/answer' ||
      endpoint === '/psico/week/finish'
    ) {
      const examen = state.examenes[p];
      if (
        !examen ||
        body.attemptId !== examen.attemptId ||
        body.week !== SEMANA
      )
        return json({}, 409);
      if (examen.result) return json(examen.result);
      if (endpoint.endsWith('/answer')) {
        if (body.base !== examen.answerRevs[body.i])
          return json(
            {
              rev: examen.answerRevs[body.i],
              sel: examen.answers[body.i],
              leftSecs: examen.leftSecs,
            },
            409,
          );
        examen.answers[body.i] = body.sel;
        return json({
          status: 'open',
          rev: ++examen.answerRevs[body.i],
          leftSecs: examen.leftSecs,
        });
      }
      examen.status = 'done';
      const nota = motor.gradeReto(
        examen.items,
        examen.questionData.map((q: Json) => q.ans),
        examen.answers,
        { pid: p },
      );
      examen.result = {
        ...nota,
        status: 'done',
        week: SEMANA,
        attemptId: examen.attemptId,
        perfil: p,
        pen: examen.pen,
        secs: 12,
        review: examen.questionData.map((q: Json, i: number) => ({
          ...q,
          ok: examen.answers[i] === q.ans,
          sel: examen.answers[i] ?? -1,
        })),
      };
      return json(examen.result);
    }
    if (endpoint.endsWith('/ranking'))
      return json({ total: 0, top: [], me: null });
    if (endpoint.endsWith('/result'))
      return json(
        state.examenes[p]?.result ?? {},
        state.examenes[p]?.result ? 200 : 404,
      );
    if (endpoint === '/psico/admin/weeks')
      return json({ current: SEMANA, weeks: [{ week: SEMANA, n: { cv: 1 } }] });
    if (endpoint === `/psico/admin/week/${SEMANA}.csv`)
      return route.fulfill({
        contentType: 'text/csv',
        body: 'Alumno;Nota\nCuenta 1;9',
      });
    if (endpoint === `/psico/admin/week/${SEMANA}`)
      return json({
        enCurso: 1,
        cut: 40,
        modo: p === 'cv' ? 'apto' : 'nota',
        aptitudes: [],
        rows: [],
      });
    if (endpoint === '/psico/admin/alumnos')
      return json({
        aptitudes: [],
        rows: [
          {
            id: '1',
            name: 'Cuenta 1',
            alias: '',
            ultimo: null,
            dias: null,
            n7: 0,
            n: 1,
            pct: 100,
            fallos: 0,
            floja: null,
            reto: null,
            apt: [],
          },
        ],
        grupo: [],
        tipos: [],
      });
    if (endpoint === '/psico/admin/alumno/1')
      return json({ id: '1', progreso: cuenta(1).state });
    if (endpoint === '/psico/admin/alumno/1/borrar' && body.confirmar === '1') {
      cuentas.delete(1);
      return json({ ok: true });
    }
    if (endpoint === '/psico/admin/reports')
      return json({
        rows: [
          {
            ref: 'bq.3.171',
            tipo: 'Pregunta',
            nivel: 3,
            n: 1,
            motivos: { Otro: 1 },
            notas: ['Revisar'],
            alumnos: ['Cuenta 1'],
            ultimo: '2026-11-19T10:00:00Z',
          },
        ],
      });
    if (endpoint === '/psico/admin/reports/done') return json({ removed: 1 });
    if (endpoint === EDU + '/indice')
      return json({
        borrado: state.borrado,
        partes: Object.fromEntries(
          [...state.partes].map(([k, v]) => [k, v.at]),
        ),
      });
    if (endpoint === EDU + '/leer')
      return json({
        partes: Object.fromEntries(
          [...state.partes].filter(([k]) => body.nombres.includes(k)),
        ),
      });
    if (endpoint === EDU + '/guardar') {
      const borrado = body.borrado ?? 0;
      if (body.borrar === true) {
        if (borrado === state.borrado) {
          state.partes.clear();
          state.borrado++;
          if (opciones.loseNextReset) {
            opciones.loseNextReset = false;
            return route.abort('failed');
          }
        }
        return json({ partes: {}, borrado: state.borrado });
      }
      if (borrado !== state.borrado)
        return json(
          { error: 'librillo_reiniciado', borrado: state.borrado },
          409,
        );
      const partes = Object.fromEntries(
        Object.entries(body.partes).map(([nombre, incoming]) => {
          const { base, at, j } = incoming as Parte & { base: number };
          const existing = state.partes.get(nombre);
          if (base !== (existing?.at ?? 0))
            return [
              nombre,
              { ok: false, at: existing?.at ?? 0, j: existing?.j ?? null },
            ];
          if (j === null) state.partes.delete(nombre);
          else state.partes.set(nombre, { at, j });
          return [nombre, { ok: true, at }];
        }),
      );
      return json({ partes, borrado: state.borrado });
    }
    return json({}, 404);
  }

  async function preparar(
    context: BrowserContext,
    id = 1,
    rol: Rol = 'ALUMNO',
  ) {
    const jwt =
      'fake.' +
      Buffer.from(
        JSON.stringify({
          sub: id,
          rol,
          exp: 9_999_999_999,
          email: `cuenta-${id}@example.test`,
        }),
      ).toString('base64url') +
      '.qa';
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin === api) return apiRoute(route, id, rol, jwt);
      if (url.hostname === '127.0.0.1') return route.continue();
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    await page.addInitScript(
      ({ token, origin }) => {
        if (window === top && window.location.origin === origin)
          sessionStorage.setItem('authToken', token);
      },
      {
        token: jwt,
        origin: `http://127.0.0.1:${Number(process.env['ESTUDIO_QA_PORT'] ?? '43129')}`,
      },
    );
    return page;
  }

  return { cuenta, peticiones, opciones, preparar, DOC, TEMA, SEMANA, staging };
}

function crearExamen(p: Perfil) {
  const { rng, makeQ, retoPlan } = {
    rng: motor.RNG,
    makeQ: motor.makeQ,
    retoPlan: motor.retoPlan,
  };
  const items: Json[] = retoPlan(rng(22), (i: number) => i + 100, p);
  const questionData = items.map((it) => ({
    ...makeQ(it.g, it.l, it.s),
    f: it.f,
    r: it.r,
    s: it.s,
  }));
  return {
    items,
    questionData,
    week: SEMANA,
    attemptId: `qa-${p}-47`,
    status: 'open',
    pen: p === 'cam' ? 1 / 3 : 0.33,
    leftSecs: (p === 'cam' ? 44 : 25) * 60,
    answerRevs: items.map(() => 0),
    answers: items.map(() => null),
  };
}

export function contador(state: Json | null) {
  return Object.values(state?.st ?? {}).reduce(
    (total: number, item: any) => total + item.n,
    0,
  );
}

export function visor(page: Page) {
  return page.frameLocator('[data-testid="estudio-iframe"]');
}
