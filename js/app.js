// Точка входа: запуск, каркас (боковая панель / нижняя навигация), переключение экранов.

import * as store from './core/store.js';
import { h, icon } from './ui/dom.js';
import { toast, sheetOpen } from './ui/sheet.js';
import { openCapture, captureOpen } from './ui/capture.js';
import { startReminders } from './ui/reminders.js';
import { applyTheme } from './ui/theme.js';
import { today } from './core/dates.js';
import { setRefresher } from './ui/refresh.js';

import * as todayView from './views/today.js';
import * as inboxView from './views/inbox.js';
import * as tasksView from './views/tasks.js';
import * as calendarView from './views/calendar.js';
import * as notesView from './views/notes.js';
import * as laterView from './views/later.js';
import * as goalsView from './views/goals.js';
import * as habitsView from './views/habits.js';
import * as logView from './views/log.js';
import * as searchView from './views/search.js';
import * as reviewView from './views/review.js';
import * as settingsView from './views/settings.js';
import * as trashView from './views/trash.js';
import * as moreView from './views/more.js';
import * as focusView from './views/focus.js';

// Экраны. tab — какая кнопка нижней навигации подсвечивается
const ROUTES = {
  today: { title: 'Мой день', icon: 'sun', view: todayView, tab: 'today' },
  inbox: { title: 'Входящие', icon: 'inbox', view: inboxView, tab: 'more' },
  tasks: { title: 'Задачи', icon: 'checkCircle', view: tasksView, tab: 'tasks' },
  calendar: { title: 'Календарь', icon: 'calendar', view: calendarView, tab: 'calendar' },
  notes: { title: 'Блокнот', icon: 'note', view: notesView, tab: 'more' },
  later: { title: 'Посмотреть позже', icon: 'bookmark', view: laterView, tab: 'more' },
  goals: { title: 'Цели', icon: 'target', view: goalsView, tab: 'more' },
  habits: { title: 'Привычки', icon: 'flame', view: habitsView, tab: 'more' },
  log: { title: 'История', icon: 'history', view: logView, tab: 'more' },
  review: { title: 'Обзор дня', icon: 'sunrise', view: reviewView, tab: 'more' },
  focus: { title: 'Фокус', icon: 'timer', view: focusView, tab: 'more' },
  search: { title: 'Поиск', icon: 'search', view: searchView, tab: 'more' },
  trash: { title: 'Корзина', icon: 'trash', view: trashView, tab: 'more' },
  settings: { title: 'Настройки', icon: 'settings', view: settingsView, tab: 'more' },
  more: { title: 'Ещё', icon: 'grid', view: moreView, tab: 'more' },
};
const SIDEBAR = ['today', 'inbox', 'tasks', 'calendar', null, 'notes', 'later', 'goals', 'habits', 'log', null, 'review', 'focus', 'search', 'trash', 'settings'];
const TABS = ['today', 'tasks', null, 'calendar', 'more'];

let route = { name: 'today', params: [] };
let viewEl, titleEl, lastDay = today();

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const name = ROUTES[parts[0]] ? parts[0] : 'today';
  return { name, params: parts.slice(1) };
}

// Перерисовать текущий экран. Сохраняем то, что пользователь печатает (элементы с data-keep).
function renderView(resetScroll = false) {
  const def = ROUTES[route.name];
  const active = document.activeElement;
  const keep = viewEl.contains(active) && active.dataset?.keep ? { key: active.dataset.keep, value: active.value, s: active.selectionStart, e: active.selectionEnd } : null;
  const values = {};
  viewEl.querySelectorAll('[data-keep]').forEach((el) => { values[el.dataset.keep] = el.value; });
  const next = document.createDocumentFragment();
  try { def.view.render(next, route.params); } catch (err) { console.error(err); next.append(h('div.empty', null, h('div.empty-title', null, 'Ошибка на экране'), h('div.empty-text', null, String(err.message || err)))); }
  viewEl.replaceChildren(next);
  // Параметры вида #/tasks/overdue нужны только один раз (чтобы открыть нужную вкладку) — потом убираем их из адреса
  if (def.view.transientParams && route.params.length) { history.replaceState(null, '', '#/' + route.name); route.params = []; }
  viewEl.dataset.view = route.name;
  viewEl.querySelectorAll('[data-keep]').forEach((el) => { if (values[el.dataset.keep] != null && el.value !== values[el.dataset.keep]) el.value = values[el.dataset.keep]; });
  if (keep) {
    const el = viewEl.querySelector(`[data-keep="${keep.key}"]`);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.e); } catch { /* не текстовое поле */ } }
  }
  if (resetScroll) window.scrollTo(0, 0);
}

function updateChrome() {
  const def = ROUTES[route.name];
  titleEl.textContent = def.view.title?.(route.params) || def.title;
  document.title = `${def.title} — SAID OS`;
  const inboxCount = store.count('inbox');
  document.querySelectorAll('[data-route]').forEach((a) => {
    const on = a.dataset.route === route.name || (a.closest('#tabbar') && a.dataset.route === def.tab);
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-inbox-badge]').forEach((b) => { b.textContent = inboxCount || ''; b.hidden = !inboxCount; });
  document.getElementById('back-btn').hidden = !(def.tab === 'more' && route.name !== 'more') ;
}

function navigate() {
  const prev = route;
  route = parseHash();
  updateChrome();
  renderView(prev.name !== route.name || prev.params.join() !== route.params.join());
}

function buildShell() {
  const badge = () => h('span.badge', { dataset: { inboxBadge: '1' }, hidden: true });
  const navLink = (name, cls) => {
    const r = ROUTES[name];
    return h('a.' + cls, { href: '#/' + name, dataset: { route: name } }, icon(r.icon), h('span', null, r.title), name === 'inbox' ? badge() : null);
  };
  const sidebar = h('aside#sidebar', { 'aria-label': 'Разделы' },
    h('a.brand', { href: '#/today' }, h('img', { src: 'icons/icon.svg', alt: '', width: 30, height: 30 }), h('b', null, 'SAID OS')),
    h('button.btn.btn-primary.capture-btn', { type: 'button', onclick: () => openCapture() }, icon('plus', 20), h('span', null, 'Быстрая запись'), h('kbd', null, 'N')),
    h('nav', null, SIDEBAR.map((n) => (n ? navLink(n, 'side-link') : h('hr')))));

  titleEl = h('h1#title');
  const topbar = h('header#topbar', null,
    h('a#back-btn.icon-btn', { href: '#/more', 'aria-label': 'Назад в меню', hidden: true }, icon('chevronLeft')),
    titleEl, h('span.grow'),
    h('a.icon-btn.top-inbox', { href: '#/inbox', 'aria-label': 'Входящие' }, icon('inbox'), badge()),
    h('a.icon-btn', { href: '#/search', 'aria-label': 'Поиск' }, icon('search')));
  viewEl = h('div#view');

  const tabbar = h('nav#tabbar', { 'aria-label': 'Основная навигация' }, TABS.map((n) => {
    if (!n) return h('span.tab-gap');
    const r = ROUTES[n];
    return h('a.tab', { href: '#/' + n, dataset: { route: n } }, icon(r.icon, 24), h('span', null, r.title), n === 'more' ? badge() : null);
  }));
  const fab = h('button#fab', { type: 'button', 'aria-label': 'Быстрая запись', onclick: () => openCapture() }, icon('plus', 28));

  document.getElementById('app').replaceChildren(sidebar, h('div#main', null, topbar, viewEl), tabbar, fab);
}

function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCapture(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || sheetOpen() || captureOpen()) return;
    if (e.key === 'n' || e.key === 'т' || e.key === 'N' || e.key === 'Т') { e.preventDefault(); openCapture(); }
    else if (e.key === '/' || e.key === '.') { e.preventDefault(); location.hash = '#/search'; }
  });
}

async function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    // Когда новая версия скачана — предлагаем обновиться
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Доступна новая версия приложения', { action: { label: 'Обновить', onclick: () => location.reload() }, timeout: 15000 });
        }
      });
    });
  } catch (e) { console.warn('Service worker не зарегистрирован', e); }
}

async function boot() {
  store.onError((e) => { console.error(e); toast('Не удалось сохранить данные: ' + (e?.message || e), { timeout: 8000 }); });
  try {
    await store.init();
  } catch (e) {
    document.getElementById('app').replaceChildren(h('div.empty', null, h('div.empty-emoji', null, '⚠️'), h('div.empty-title', null, 'Не удалось открыть хранилище данных'),
      h('div.empty-text', null, 'Возможно, включён «Частный доступ» в Safari или закончилось место. ' + (e?.message || ''))));
    return;
  }
  if (!store.getMeta('firstRunAt')) store.setMeta('firstRunAt', Date.now());
  applyTheme();
  buildShell();
  route = parseHash();
  updateChrome();
  renderView();
  document.documentElement.classList.add('ready');

  setRefresher(() => renderView());
  window.addEventListener('hashchange', navigate);
  store.on(() => { updateChrome(); renderView(); });
  // Наступил новый день или вернулись в приложение — обновляем экран
  const refreshIfNewDay = () => { if (today() !== lastDay) { lastDay = today(); renderView(); } };
  setInterval(refreshIfNewDay, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshIfNewDay(); });

  setupShortcuts();
  startReminders();
  registerSW();
  // Просим браузер не удалять данные при нехватке места (где поддерживается)
  navigator.storage?.persist?.().catch(() => {});
  // Ярлыки с иконки приложения: ?capture=1 открывает быструю запись
  if (new URLSearchParams(location.search).has('capture')) openCapture();
}

boot();
