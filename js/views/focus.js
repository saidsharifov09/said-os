// «Фокус»: помощь при ступоре. Показывает ОДНО дело и таймер — без списков и выбора.

import { h, icon, burst } from '../ui/dom.js';
import { refresh } from '../ui/refresh.js';
import { toast } from '../ui/sheet.js';
import { empty } from '../ui/items.js';
import { openTaskEditor } from '../ui/edit-task.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { today } from '../core/dates.js';
import { tasksOn, overdueTasks, focusTasks } from '../core/selectors.js';

// Состояние таймера живёт, пока открыто приложение
const state = { taskId: null, skipped: [], endAt: null, minutes: 25, timer: null };

// Кандидаты: сначала главные дела дня, потом просроченные и сегодняшние по приоритету
function candidates() {
  const t = today();
  const seen = new Set();
  return [...focusTasks(t).filter((x) => x.status !== 'done'), ...[...overdueTasks(), ...tasksOn(t)].sort((a, b) => (b.priority || 0) - (a.priority || 0))]
    .filter((x) => !seen.has(x.id) && seen.add(x.id));
}

const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function tick() {
  const el = document.getElementById('focus-timer');
  if (!state.endAt) return;
  const left = state.endAt - Date.now();
  if (el) el.textContent = fmt(left);
  if (left <= 0) {
    clearInterval(state.timer); state.endAt = null; state.timer = null;
    toast('⏰ Время вышло. Сделай паузу — ты молодец!', { timeout: 10000 });
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 740; g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.9);
    } catch { /* без звука */ }
    refresh();
  }
}
function start(min) {
  state.minutes = min; state.endAt = Date.now() + min * 60000;
  clearInterval(state.timer); state.timer = setInterval(tick, 500);
  refresh();
}
function stop() { clearInterval(state.timer); state.timer = null; state.endAt = null; refresh(); }

export const transientParams = true;

export function render(el, params) {
  if (params[0] && store.get('tasks', params[0])) state.taskId = params[0];
  const list = candidates();
  let task = state.taskId && store.get('tasks', state.taskId);
  if (!task || task.status === 'done' || task.deletedAt) {
    const pool = list.filter((x) => !state.skipped.includes(x.id));
    if (!pool.length) state.skipped = [];
    task = (pool.length ? pool : list)[0] || null;
    state.taskId = task?.id || null;
  }
  if (!task) { el.append(empty('🧘', 'Сейчас нечего делать', 'На сегодня задач нет. Добавь одну — или просто отдохни.', h('a.btn.btn-primary', { href: '#/tasks' }, 'К задачам'))); return; }

  const next = (task.subtasks || []).find((s) => !s.done);
  const running = !!state.endAt;
  el.append(h('div.card.focus-view', null,
    h('div.next-label', null, running ? 'Сейчас только это' : 'Начни с этого'),
    h('button.focus-task', { type: 'button', onclick: () => openTaskEditor(task.id) }, task.title),
    next && h('div.muted', null, 'Первый шаг: ', h('b', null, next.title)),
    h('div.focus-timer', { id: 'focus-timer', 'aria-live': 'off' }, running ? fmt(state.endAt - Date.now()) : `${state.minutes}:00`),
    running
      ? h('div.row.gap.wrap', { style: { justifyContent: 'center' } },
        h('button.btn.btn-soft', { type: 'button', onclick: stop }, 'Остановить'),
        h('button.btn.btn-primary', { type: 'button', onclick: (e) => { burst(e.currentTarget); stop(); actions.toggleTask(task.id); toast('Готово! Отличная работа.'); } }, icon('check', 18), 'Сделано'))
      : h('div.stack', { style: { alignItems: 'center' } },
        h('div.row.gap.wrap', { style: { justifyContent: 'center' } },
          h('button.btn.btn-soft', { type: 'button', onclick: () => start(5) }, 'Всего 5 минут'),
          h('button.btn.btn-soft', { type: 'button', onclick: () => start(15) }, '15 минут'),
          h('button.btn.btn-primary', { type: 'button', onclick: () => start(25) }, icon('play', 18), '25 минут')),
        h('div.row.gap.wrap', { style: { justifyContent: 'center' } },
          list.length > 1 && h('button.btn.btn-soft.small', { type: 'button', onclick: () => { state.skipped.push(task.id); state.taskId = null; refresh(); } }, icon('dice', 16), 'Другое дело'),
          h('button.btn.btn-soft.small', { type: 'button', onclick: (e) => { burst(e.currentTarget); actions.toggleTask(task.id); toast('Готово!'); } }, icon('check', 16), 'Уже сделано'))),
    h('p.muted.small', null, running ? 'Таймер работает, пока приложение открыто. Телефон можно положить экраном вниз.' : 'Не нужно делать всё. Нужно только начать — хотя бы на 5 минут.')));
}
