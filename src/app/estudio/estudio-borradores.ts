import { RecursoEstudio } from './estudio-api.service';

const STORAGE_DB = 'tf-estudio';
const TABLE = 'borradores';
const REINICIO = 'reinicio';
let opening: Promise<IDBDatabase> | undefined;

export class BorradorReiniciado extends Error {}

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
      if (
        (draftKey(recurso, key) ||
          (recurso.tipo === 'librillo' && key === REINICIO)) &&
        typeof cursor.value === 'string'
      )
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
  reinicio?: unknown,
): Promise<void> {
  const marca = esMarcaAnterior(reinicio) ? reinicio : undefined;
  if (
    !draftKey(recurso, key) ||
    (value !== null &&
      (typeof value !== 'string' || value.length > 2 * 1024 * 1024)) ||
    (recurso.tipo === 'librillo' && marca === undefined)
  ) {
    throw new Error('Borrador inválido');
  }
  await modificarBorradores(
    ambito,
    recurso.tipo === 'librillo' ? marca : undefined,
    (store) => {
      if (value === null) store.delete(ambito + key);
      else store.put(value, ambito + key);
    },
  );
}

function esMarcaAnterior(marca: unknown): marca is string | null {
  return marca === null || (typeof marca === 'string' && marca.length <= 64);
}

export async function reiniciarBorradoresLibrillo(
  ambito: string,
  anterior: unknown,
  borrado: unknown,
  pendiente: unknown,
  estado: unknown,
): Promise<void> {
  if (
    !esMarcaAnterior(anterior) ||
    typeof borrado !== 'number' ||
    !Number.isSafeInteger(borrado) ||
    borrado < 0 ||
    typeof pendiente !== 'boolean' ||
    (estado !== undefined &&
      (typeof estado !== 'string' || estado.length > 2 * 1024 * 1024))
  )
    throw new Error('Reinicio de borrador inválido');
  const marca = JSON.stringify({ borrado, pendiente });
  await modificarBorradores(
    ambito,
    anterior,
    (store) => {
      if (typeof estado === 'string') {
        store.delete(IDBKeyRange.bound(ambito, `${ambito}\uffff`));
        store.put(estado, ambito + 'estado');
      }
      store.put(marca, ambito + REINICIO);
    },
    marca,
  );
}

async function modificarBorradores(
  ambito: string,
  marca: string | null | undefined,
  modificar: (store: IDBObjectStore) => void,
  marcaNueva?: string,
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLE, 'readwrite');
    let error: Error | undefined;
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(error ?? tx.error);
    const store = tx.objectStore(TABLE);
    if (marca === undefined) {
      modificar(store);
      return;
    }
    const request = store.get(ambito + REINICIO);
    request.onsuccess = () => {
      const actual = request.result ?? null;
      if (actual === marca) modificar(store);
      else if (actual !== marcaNueva) {
        error = new BorradorReiniciado();
        tx.abort();
      }
    };
  });
}
