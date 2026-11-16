// Хранилище: все данные лежат в памяти (их немного), каждое изменение сразу пишется в IndexedDB.
// Экраны читают отсюда синхронно и перерисовываются по событию изменения.

import * as db from './db.js';
import { STORES } from './db.js';
import { SCHEMA_VERSION, migrate, DEFAULT_SECTIONS, DEFAULT_CATEGORIES } from './schema.js';

export { STORES };
export const TRASH_DAYS = 30;

const data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
let meta = {};
const listeners = new Set();
let errorHandler = (e) => console.error(e);
let emitQueued = false;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function emit() {
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => {
    emitQueued = false;
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  });
}
// Подписка на любые изменения данных. Возвращает функцию отписки.
export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function onError(fn) { errorHandler = fn; }
const persist = (p) => p.catch((e) => errorHandler(e));

export async function init() {
  meta = await db.getAllMeta();
  const loaded = {};
  for (const s of STORES) loaded[s] = await db.getAll(s);

  // Миграция данных, если приложение обновилось
  const from = meta.schemaVersion;
  if (from && from < SCHEMA_VERSION) {
    migrate({ data: loaded, meta }, from);
    meta.schemaVersion = SCHEMA_VERSION;
    await db.replaceAll(loaded, meta);
  }
  for (const s of STORES) { data[s].clear(); loaded[s].forEach((r) => data[s].set(r.id, r)); }

  // Первый запуск: создаём стартовые разделы и категории
  if (!meta.seeded) {
    const now = Date.now();
    for (const sec of DEFAULT_SECTIONS) if (!data.sections.has(sec.id)) putRaw('sections', { ...sec, createdAt: now, updatedAt: now });
    for (const c of DEFAULT_CATEGORIES) if (!data.categories.has(c.id)) putRaw('categories', { ...c, createdAt: now, updatedAt: now });
    setMeta('seeded', true);
    setMeta('schemaVersion', SCHEMA_VERSION);
  }
  purgeOldTrash();
}

function putRaw(store, rec) {
  data[store].set(rec.id, rec);
  persist(db.put(store, rec));
}

// ---------- Чтение ----------
export const all = (store) => [...data[store].values()].filter((r) => !r.deletedAt);
export const get = (store, id) => data[store].get(id) || null;
export const count = (store) => all(store).length;

// ---------- Запись ----------
export function add(store, fields) {
  const now = Date.now();
  const rec = { id: uid(), createdAt: now, updatedAt: now, ...fields };
  putRaw(store, rec);
  emit();
  return rec;
}
export function update(store, id, patch) {
  const old = data[store].get(id);
  if (!old) return null;
  const rec = { ...old, ...patch, updatedAt: Date.now() };
  putRaw(store, rec);
  emit();
  return rec;
}
// Удаление = перенос в корзину (хранится TRASH_DAYS дней)
export const remove = (store, id) => update(store, id, { deletedAt: Date.now() });
export const restore = (store, id) => update(store, id, { deletedAt: null });
// Удаление навсегда
export function purge(store, id) {
  data[store].delete(id);
  persist(db.del(store, id));
  emit();
}

// ---------- Корзина ----------
export function trashed() {
  const out = [];
  for (const s of STORES) for (const r of data[s].values()) if (r.deletedAt) out.push({ store: s, rec: r });
  return out.sort((a, b) => b.rec.deletedAt - a.rec.deletedAt);
}
function purgeOldTrash() {
  const limit = Date.now() - TRASH_DAYS * 864e5;
  for (const { store, rec } of trashed()) if (rec.deletedAt < limit) purge(store, rec.id);
}
export function emptyTrash() { trashed().forEach(({ store, rec }) => purge(store, rec.id)); }

// ---------- Настройки и служебные значения ----------
export const getMeta = (key, def = null) => (key in meta ? meta[key] : def);
export function setMeta(key, value) {
  meta[key] = value;
  persist(db.putMeta(key, value));
  emit();
}

// ---------- Для резервных копий ----------
export function snapshot() {
  return {
    data: Object.fromEntries(STORES.map((s) => [s, [...data[s].values()]])),
    meta: { ...meta },
  };
}
// Заменить всё содержимое (импорт «заменить»)
export async function replaceAll(newData, newMeta) {
  await db.replaceAll(newData, newMeta);
  meta = { ...newMeta };
  for (const s of STORES) { data[s].clear(); (newData[s] || []).forEach((r) => data[s].set(r.id, r)); }
  emit();
}
// Объединить с импортируемыми данными: по id, побеждает более свежая запись
export async function mergeAll(newData) {
  let added = 0, updated = 0;
  for (const s of STORES) {
    const changed = [];
    for (const r of newData[s] || []) {
      const old = data[s].get(r.id);
      if (!old) { added++; changed.push(r); }
      else if ((r.updatedAt || 0) > (old.updatedAt || 0)) { updated++; changed.push(r); }
    }
    changed.forEach((r) => data[s].set(r.id, r));
    if (changed.length) await db.bulkPut(s, changed);
  }
  emit();
  return { added, updated };
}
