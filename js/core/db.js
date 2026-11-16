// Тонкая обёртка над IndexedDB. Больше нигде в приложении indexedDB напрямую не трогаем.

const DB_NAME = 'said-os';
const DB_VERSION = 1; // версия СТРУКТУРЫ базы (набор хранилищ). Версия данных — в schema.js

// Все хранилища с записями (у каждой записи есть id)
export const STORES = ['inbox', 'tasks', 'events', 'notes', 'sections', 'categories', 'goals', 'habits', 'log'];
const META = 'meta'; // настройки и служебные значения: { key, value }

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('База данных занята другой вкладкой'));
  });
  return dbPromise;
}

// Выполнить операцию в транзакции и дождаться её завершения
async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Транзакция прервана'));
    result = fn(t);
  });
}

const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export async function getAll(store) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).getAll());
}
export const put = (store, rec) => tx(store, 'readwrite', (t) => { t.objectStore(store).put(rec); });
export const del = (store, id) => tx(store, 'readwrite', (t) => { t.objectStore(store).delete(id); });
export const bulkPut = (store, recs) => tx(store, 'readwrite', (t) => { const s = t.objectStore(store); recs.forEach((r) => s.put(r)); });

export async function getAllMeta() {
  const rows = await getAll(META);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
export const putMeta = (key, value) => put(META, { key, value });

// Полная замена содержимого базы (используется при импорте копии)
export function replaceAll(data, meta) {
  return tx([...STORES, META], 'readwrite', (t) => {
    for (const s of STORES) {
      const os = t.objectStore(s);
      os.clear();
      (data[s] || []).forEach((r) => os.put(r));
    }
    const ms = t.objectStore(META);
    ms.clear();
    Object.entries(meta || {}).forEach(([key, value]) => ms.put({ key, value }));
  });
}
