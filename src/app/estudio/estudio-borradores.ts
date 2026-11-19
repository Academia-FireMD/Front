import { RecursoEstudio } from './estudio-api.service';

const STORAGE_DB = 'tf-estudio';
const TABLE = 'borradores';
let opening: Promise<IDBDatabase> | undefined;

function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }).catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

function draftKey(recurso: RecursoEstudio, key: unknown): key is string {
  if (typeof key !== 'string' || key.length > 200) return false;
  return recurso.tipo === 'psico'
    ? /^(?:practice|pending|week:(?:cv|cam))$/.test(key)
    : /^(?:estado|sync|[ni]\d{1,20})$/.test(key);
}

export function ambitoBorrador(
  usuarioId: number,
  impersonando: boolean,
  recurso: RecursoEstudio,
): string {
  const id =
    recurso.tipo === 'psico' ? 'psico' : `librillo:${recurso.documentoId}`;
  return `${usuarioId}:${Number(impersonando)}:${id}:`;
}

export async function leerBorradores(
  ambito: string,
  recurso: RecursoEstudio,
): Promise<Record<string, string>> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const values: Record<string, string> = Object.create(null);
    const range = IDBKeyRange.bound(ambito, `${ambito}\uffff`);
    const request = db.transaction(TABLE).objectStore(TABLE).openCursor(range);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(values);
        return;
      }
      const key = String(cursor.key).slice(ambito.length);
      if (draftKey(recurso, key) && typeof cursor.value === 'string')
        values[key] = cursor.value;
      cursor.continue();
    };
  });
}

export async function escribirBorrador(
  ambito: string,
  recurso: RecursoEstudio,
  key: unknown,
  value: unknown,
): Promise<void> {
  if (
    !draftKey(recurso, key) ||
    (value !== null &&
      (typeof value !== 'string' || value.length > 2 * 1024 * 1024))
  ) {
    throw new Error('Borrador inválido');
  }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    const store = tx.objectStore(TABLE);
    if (value === null) store.delete(ambito + key);
    else store.put(value, ambito + key);
  });
}
