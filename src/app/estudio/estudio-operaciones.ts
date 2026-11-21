import { OperacionEstudio, PerfilPsico } from './estudio-api.service';

export const SEMANA_PSICO = /^\d{4}-S(?:0[1-9]|[1-4][0-9]|5[0-3])$/;
export const REFERENCIA_PSICO = /^[a-z0-9_]{1,24}\.[1-3]\.\d{1,10}$/i;
const ID = /^[\w-]{1,100}$/;

export function registro(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function entero(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

function texto(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function jsonSeguro(value: unknown, maxBytes: number): unknown {
  try {
    const serialized = JSON.stringify(value, (key, item) =>
      ['__proto__', 'constructor', 'prototype', 'hasOwnProperty'].includes(key)
        ? undefined
        : item,
    );
    if (
      serialized.length <= maxBytes &&
      new TextEncoder().encode(serialized).length <= maxBytes
    ) {
      return JSON.parse(serialized);
    }
  } catch {
    // Solo se transmiten valores JSON acotados.
  }
  return null;
}

export function operacionEstudio(args: unknown): OperacionEstudio | null {
  if (!registro(args)) return null;
  const { path, method } = args;
  if (typeof path !== 'string' || path.length > 65) return null;
  if (path === '/me' && method === 'GET') return { method, path };
  const body = registro(args['body']) ? args['body'] : {};
  if (path === '/state' && method === 'PUT') {
    const { state, rev, updatedAt, opId } = body;
    if (
      !registro(state) ||
      !entero(rev) ||
      !entero(updatedAt) ||
      !texto(opId, ID)
    )
      return null;
    const seguro = jsonSeguro(state, 600_000);
    return seguro
      ? { method, path, body: { state: seguro, rev, updatedAt, opId } }
      : null;
  }
  if (path === '/alias' && method === 'PUT') {
    const { alias } = body;
    return alias === null || (typeof alias === 'string' && alias.length <= 16)
      ? { method, path, body: { alias } }
      : null;
  }
  if (path === '/report' && method === 'POST') {
    const { g, l, s, reason, note, pid } = body;
    if (
      !texto(g, /^[a-z0-9_]{1,24}$/i) ||
      !entero(l, 3) ||
      l < 1 ||
      !entero(s, 4294967295) ||
      s < 1 ||
      !entero(reason, 4) ||
      typeof note !== 'string' ||
      note.length > 200 ||
      !esPerfil(pid)
    )
      return null;
    return { method, path, body: { g, l, s, reason, note, pid } };
  }
  const week =
    /^\/week\/(start|answer|finish|\d{4}-S\d{2}\/(?:result|ranking))(?:\?p=(cv|cam))?$/.exec(
      path,
    );
  if (!week) return null;
  const accion = week[1];
  const perfil: PerfilPsico = week[2] === 'cam' ? 'cam' : 'cv';
  const destino = `/week/${accion}`;
  if (method === 'GET' && SEMANA_PSICO.test(accion.split('/')[0]))
    return { method, path: destino, perfil };
  if (method !== 'POST') return null;
  if (accion === 'start') return { method, path: destino, perfil, body: {} };
  const { week: semana, attemptId, i, sel, base, opId } = body;
  if (!texto(semana, SEMANA_PSICO) || !texto(attemptId, ID)) return null;
  if (accion === 'finish')
    return { method, path: destino, perfil, body: { week: semana, attemptId } };
  if (
    accion === 'answer' &&
    entero(i, 44) &&
    (sel === -1 || entero(sel, 5)) &&
    (base === undefined || entero(base)) &&
    texto(opId, ID)
  ) {
    return {
      method,
      path: destino,
      perfil,
      body: { week: semana, attemptId, i, sel, base, opId },
    };
  }
  return null;
}

function esPerfil(value: unknown): value is PerfilPsico {
  return value === 'cv' || value === 'cam';
}
