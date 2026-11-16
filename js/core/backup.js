// Резервные копии: экспорт и импорт всех данных в JSON, по желанию — с шифрованием паролем.
// Шифрование: WebCrypto, AES-GCM 256, ключ из пароля через PBKDF2 (SHA-256, 250 000 итераций).

import * as store from './store.js';
import { SCHEMA_VERSION, migrate } from './schema.js';
import { ymd } from './dates.js';

const APP = 'said-os';
const ITER = 250000;
// Настройки, которые не переносим между устройствами (служебное состояние этого устройства)
const LOCAL_META = ['lastBackupAt', 'backupSnoozeUntil', 'fired', 'snooze'];

const b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Собрать текст файла копии. password пустой — без шифрования.
export async function exportBackup(password = '') {
  const snap = store.snapshot();
  const meta = { ...snap.meta };
  LOCAL_META.forEach((k) => delete meta[k]);
  const payload = { data: snap.data, meta };
  const head = { app: APP, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  let file;
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
    file = { ...head, encrypted: true, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: b64(salt) }, cipher: { name: 'AES-GCM', iv: b64(iv) }, payload: b64(enc) };
  } else {
    file = { ...head, encrypted: false, ...payload };
  }
  store.setMeta('lastBackupAt', Date.now());
  const name = `said-os-${ymd()}${password ? '-encrypted' : ''}.json`;
  return { name, text: JSON.stringify(file) };
}

// Прочитать файл копии. Возвращает { needPassword: true } если нужен пароль.
export async function readBackup(text, password = '') {
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('Это не файл копии SAID OS (не удалось прочитать JSON)'); }
  if (file?.app !== APP) throw new Error('Это не файл копии SAID OS');
  if (file.schema > SCHEMA_VERSION) throw new Error('Копия сделана в более новой версии приложения. Сначала обнови приложение.');
  let payload;
  if (file.encrypted) {
    if (!password) return { needPassword: true };
    try {
      const key = await deriveKey(password, unb64(file.kdf.salt));
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(file.cipher.iv) }, key, unb64(file.payload));
      payload = JSON.parse(new TextDecoder().decode(dec));
    } catch { throw new Error('Неверный пароль или файл повреждён'); }
  } else {
    payload = { data: file.data, meta: file.meta };
  }
  if (!payload?.data || typeof payload.data !== 'object') throw new Error('В файле нет данных');
  migrate(payload, file.schema);
  const counts = Object.fromEntries(store.STORES.map((s) => [s, (payload.data[s] || []).filter((r) => !r.deletedAt).length]));
  return { payload, exportedAt: file.exportedAt, counts };
}

// Применить копию: mode = 'merge' (объединить) или 'replace' (заменить всё)
export async function applyBackup(payload, mode) {
  if (mode === 'replace') {
    const keep = Object.fromEntries(LOCAL_META.map((k) => [k, store.getMeta(k)]).filter(([, v]) => v != null));
    await store.replaceAll(payload.data, { ...payload.meta, ...keep, seeded: true, schemaVersion: SCHEMA_VERSION });
    return { replaced: true };
  }
  return store.mergeAll(payload.data);
}

// ---------- Работа с файлами в браузере ----------
// Сохранить файл. На iPhone открывается стандартное окно «Поделиться» (Telegram, Файлы, Почта),
// на компьютере — обычное скачивание.
export async function saveFile(name, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare) {
    try {
      const file = new File([blob], name, { type: mime });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'shared'; }
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(name, blob);
  return 'downloaded';
}
export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
// Попросить пользователя выбрать файл и вернуть его текст
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.style.display = 'none';
    input.onchange = async () => {
      const f = input.files[0];
      input.remove();
      resolve(f ? { name: f.name, text: await f.text() } : null);
    };
    document.body.append(input);
    input.click();
  });
}

// Пора ли напомнить о копии (раз в неделю, если есть что сохранять)
export function backupDue() {
  const last = store.getMeta('lastBackupAt', 0);
  const snooze = store.getMeta('backupSnoozeUntil', 0);
  const hasData = store.count('tasks') + store.count('notes') + store.count('events') > 4;
  const first = store.getMeta('firstRunAt', Date.now());
  return hasData && Date.now() > snooze && Date.now() - Math.max(last, first) > 7 * 864e5;
}
