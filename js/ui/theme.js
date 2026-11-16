// Тема оформления: светлая (по умолчанию), тёмная или «как в системе».
// Выбор дублируется в localStorage, чтобы index.html применил тему до загрузки приложения (без мигания).

import * as store from '../core/store.js';

const KEY = 'said-os-theme';
const media = matchMedia('(prefers-color-scheme: dark)');

export const getTheme = () => store.getMeta('theme', 'light');

export function applyTheme(mode = getTheme()) {
  const dark = mode === 'dark' || (mode === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E141B' : '#EEF2F7');
  try { localStorage.setItem(KEY, mode); } catch { /* localStorage недоступен — не страшно */ }
}
export function setTheme(mode) {
  store.setMeta('theme', mode);
  applyTheme(mode);
}
media.addEventListener?.('change', () => { if (getTheme() === 'system') applyTheme(); });
