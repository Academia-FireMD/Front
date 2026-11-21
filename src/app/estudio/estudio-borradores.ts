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

function draftKey(key: unknown): key is string {
  return (
    typeof key === 'string' &&
    /^(?:practice|pending|week:(?:cv|cam))$/.test(key)
  );
}

export function ambitoBorrador(
  usuarioId: number,
  impersonando: boolean,
): string {
  return `${usuarioId}:${Number(impersonando)}:psico:`;
}

export async function leerBorradores(
  ambito: string,
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
      if (draftKey(key) && typeof cursor.value === 'string')
        values[key] = cursor.value;
      cursor.continue();
    };
  });
}

export async function escribirBorrador(
  ambito: string,
  key: unknown,
  value: unknown,
): Promise<void> {
  if (
    !draftKey(key) ||
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
