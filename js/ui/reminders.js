// Напоминания ВНУТРИ приложения: работают, только пока SAID OS открыт (сервера нет — см. docs/NOTIFICATIONS.md).
// Каждые 20 секунд проверяем, не пора ли напомнить о задаче или событии, и показываем баннер.

import { h, icon } from './dom.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { today, addDays, toDate } from '../core/dates.js';
import { eventsOn } from '../core/selectors.js';
import { openTaskEditor } from './edit-task.js';
import { openEventEditor } from './edit-event.js';

const LATE_LIMIT = 3 * 3600e3; // о пропущенном больше 3 часов назад уже не напоминаем (оно видно в «Просрочено»)
let audioCtx = null;
const shown = new Map(); // key → элемент баннера

// Что сейчас должно напоминать: [{ key, kind, id, date, title, at }]
export function dueReminders(now = Date.now()) {
  const fired = store.getMeta('fired', {});
  const snooze = store.getMeta('snooze', {});
  const out = [];
  const consider = (key, at, item) => {
    const start = snooze[key] ?? at - item.remind * 60000;
    if (now >= start && now - at < LATE_LIMIT && !fired[key]) out.push({ key, at, ...item });
  };
  for (const t of store.all('tasks')) {
    if (t.status === 'done' || !t.date || !t.time || t.remind == null) continue;
    consider(`t|${t.id}|${t.date}|${t.time}`, toDate(t.date, t.time).getTime(), { kind: 'task', id: t.id, date: t.date, title: t.title, remind: t.remind, time: t.time });
  }
  for (const d of [addDays(today(), -1), today(), addDays(today(), 1)]) {
    for (const o of eventsOn(d)) {
      const e = o.ev;
      if (o.done || !e.start || e.remind == null) continue;
      consider(`e|${e.id}|${d}|${e.start}`, toDate(d, e.start).getTime(), { kind: 'event', id: e.id, date: d, title: e.title, remind: e.remind, time: e.start });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

function markFired(key) {
  const fired = { ...store.getMeta('fired', {}) };
  const limit = Date.now() - 3 * 864e5;
  Object.keys(fired).forEach((k) => { if (fired[k] < limit) delete fired[k]; });
  fired[key] = Date.now();
  store.setMeta('fired', fired);
}
function snoozeFor(key, minutes) {
  const fired = { ...store.getMeta('fired', {}) };
  delete fired[key];
  const snooze = { ...store.getMeta('snooze', {}) };
  const limit = Date.now() - 864e5;
  Object.keys(snooze).forEach((k) => { if (snooze[k] < limit) delete snooze[k]; });
  snooze[key] = Date.now() + minutes * 60000;
  store.setMeta('snooze', snooze);
  store.setMeta('fired', fired);
}

// Мягкий двухтональный сигнал (WebAudio, без файлов)
function chime() {
  if (!store.getMeta('sound', true)) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    [[660, 0], [880, 0.18]].forEach(([freq, delay]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      const t = audioCtx.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.55);
    });
  } catch { /* звук не критичен */ }
}

function showBanner(r) {
  if (shown.has(r.key)) return;
  const box = document.getElementById('banners');
  const hide = () => { el.classList.add('closing'); setTimeout(() => el.remove(), 200); shown.delete(r.key); };
  const late = Date.now() - r.at > 5 * 60000;
  const el = h('div.banner', { role: 'alert' },
    h('div.banner-icon', null, icon('bell')),
    h('button.banner-main', { type: 'button', onclick: () => { r.kind === 'task' ? openTaskEditor(r.id) : openEventEditor(r.id, r.date); } },
      h('b', null, r.title),
      h('span', null, (late ? 'Пропущено · ' : '') + (r.kind === 'task' ? 'Задача' : 'Событие') + ' в ' + r.time)),
    h('div.banner-actions', null,
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { snoozeFor(r.key, 10); hide(); } }, '10 мин'),
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { snoozeFor(r.key, 60); hide(); } }, '1 час'),
      h('button.btn.btn-primary.small', { type: 'button', onclick: () => {
        if (r.kind === 'task') actions.toggleTask(r.id); else actions.toggleEventDone(r.id, r.date);
        hide();
      } }, icon('check', 16), 'Выполнено'),
      h('button.icon-btn.small', { type: 'button', 'aria-label': 'Закрыть напоминание', onclick: hide }, '✕')));
  box.append(el);
  shown.set(r.key, el);
}

function tick() {
  const due = dueReminders();
  if (!due.length) return;
  due.forEach((r) => { showBanner(r); markFired(r.key); });
  chime();
  // Если окно свёрнуто, но приложение ещё открыто (ноутбук) — системное уведомление, когда разрешено
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted' && store.getMeta('sysNotify', false)) {
    due.forEach((r) => {
      navigator.serviceWorker?.ready.then((reg) => reg.showNotification(r.title, { body: (r.kind === 'task' ? 'Задача' : 'Событие') + ' в ' + r.time, tag: r.key, icon: 'icons/icon-192.png' })).catch(() => {});
    });
  }
}

export function startReminders() {
  // iOS разрешает звук только после первого касания экрана
  const unlock = () => { try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* нет звука */ } };
  document.addEventListener('pointerdown', unlock, { once: true });
  setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setTimeout(tick, 1500);
}
export { tick as checkRemindersNow };
