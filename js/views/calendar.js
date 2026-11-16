// Собственный календарь: день, неделя, месяц. События + задачи с датой.

import { h, icon } from '../ui/dom.js';
import { refresh } from '../ui/refresh.js';
import { segmented } from '../ui/controls.js';
import { taskRow, eventRow, eventColor, completeWithFeedback } from '../ui/items.js';
import { openEventEditor } from '../ui/edit-event.js';
import { openTaskEditor } from '../ui/edit-task.js';
import { today, addDays, addMonths, weekStart, monthStart, parseYmd, fmtFull, fmtMonth, WD_SHORT, WEEK_ORDER, MONTHS_SHORT, toMin, fromMin, nowHM, weekday } from '../core/dates.js';
import { eventsOn, tasksOn, tasksDoneOn } from '../core/selectors.js';
import * as store from '../core/store.js';

const state = { mode: 'month', cursor: today(), scroll: null };
const HOUR = 52; // высота часа в сетке, px
const MODES = [{ v: 'day', label: 'День' }, { v: 'week', label: 'Неделя' }, { v: 'month', label: 'Месяц' }];

function shift(dir) {
  if (state.mode === 'day') state.cursor = addDays(state.cursor, dir);
  else if (state.mode === 'week') state.cursor = addDays(state.cursor, 7 * dir);
  else state.cursor = addMonths(monthStart(state.cursor), dir);
  refresh();
}

function periodTitle() {
  if (state.mode === 'day') return fmtFull(state.cursor);
  if (state.mode === 'month') return fmtMonth(state.cursor);
  const a = parseYmd(weekStart(state.cursor)), b = parseYmd(addDays(weekStart(state.cursor), 6));
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[a.getMonth()]}` : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]}`;
}

// Свайп влево/вправо листает период
function addSwipe(el) {
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2) shift(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// ---------- Месяц ----------
function monthView() {
  const first = monthStart(state.cursor);
  const start = weekStart(first);
  const month = parseYmd(first).getMonth();
  const t = today();
  const grid = h('div.month-grid', { role: 'grid' }, WEEK_ORDER.map((d) => h('div.month-wd', null, WD_SHORT[d])));
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (i >= 35 && parseYmd(d).getMonth() !== month) break; // шестая неделя не нужна
    const ev = eventsOn(d), ts = tasksOn(d);
    const marks = [...ev.map((o) => ({ c: eventColor(o.ev), title: (o.ev.start ? o.ev.start + ' ' : '') + o.ev.title, done: o.done })), ...ts.map((x) => ({ c: null, title: x.title }))];
    grid.append(h('button.month-cell' + (parseYmd(d).getMonth() !== month ? '.other' : '') + (d === t ? '.today' : '') + (d === state.cursor ? '.selected' : ''), {
      type: 'button', 'aria-label': fmtFull(d) + (marks.length ? `, дел: ${marks.length}` : ''), onclick: () => { state.cursor = d; refresh(); }, ondblclick: () => openEventEditor({ date: d }),
    },
      h('span.month-num', null, parseYmd(d).getDate()),
      h('span.month-dots', null, marks.slice(0, 4).map((m) => h('i' + (m.c ? '' : '.task'), { style: m.c ? { background: m.c } : null }))),
      h('span.month-titles', null, marks.slice(0, 3).map((m) => h('span' + (m.c ? '' : '.task') + (m.done ? '.done' : ''), { style: m.c ? { '--c': m.c } : null }, m.title)), marks.length > 3 && h('small', null, `+${marks.length - 3}`))));
  }
  addSwipe(grid);
  return [grid, dayAgenda(state.cursor)];
}

// Список дел выбранного дня (под месяцем)
function dayAgenda(d) {
  const ev = eventsOn(d), ts = tasksOn(d), done = tasksDoneOn(d);
  return h('section', null,
    h('div.section-head', null, h('h2', null, fmtFull(d)), h('span.grow'),
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => openTaskEditor({ date: d }) }, icon('plus', 16), 'Задача'),
      h('button.btn.btn-primary.small', { type: 'button', onclick: () => openEventEditor({ date: d }) }, icon('plus', 16), 'Событие')),
    h('div.card.list', null,
      !ev.length && !ts.length && !done.length && h('div.list-empty', null, 'В этот день пока ничего нет.'),
      ev.map((o) => eventRow(o)), ts.map((x) => taskRow(x, { showDate: false })), done.map((x) => taskRow(x, { showDate: false }))));
}

// ---------- День / неделя: сетка по часам ----------
// Раскладка пересекающихся событий по колонкам
function layout(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster = [], clusterEnd = -1;
  const flush = () => { const n = Math.max(...cluster.map((x) => x.col)) + 1; cluster.forEach((x) => { x.cols = n; }); cluster = []; };
  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    const used = new Set(cluster.filter((x) => x.e > it.s).map((x) => x.col));
    let col = 0; while (used.has(col)) col++;
    it.col = col; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return sorted;
}

function timeGrid(days) {
  const t = today();
  const single = days.length === 1;
  const head = h('div.tg-head', null, h('span.tg-gutter'), days.map((d) => h('button.tg-day' + (d === t ? '.today' : ''), { type: 'button', onclick: () => { state.cursor = d; state.mode = 'day'; refresh(); } },
    h('small', null, WD_SHORT[weekday(d)]), h('b', null, parseYmd(d).getDate()))));

  // Строка «весь день»: события без времени и задачи без времени
  const allday = h('div.tg-allday', null, h('span.tg-gutter', null, single ? 'весь день' : ''), days.map((d) => {
    const ev = eventsOn(d).filter((o) => !o.ev.start), ts = tasksOn(d).filter((x) => !x.time);
    return h('div.tg-allday-col', null,
      ev.map((o) => h('button.tg-chip' + (o.done ? '.done' : ''), { type: 'button', style: { '--c': eventColor(o.ev) }, onclick: () => openEventEditor(o.ev.id, d) }, o.ev.title)),
      single ? ts.map((x) => taskRow(x, { showDate: false })) : (ts.length ? h('button.tg-chip.task', { type: 'button', onclick: () => { state.cursor = d; state.mode = 'day'; refresh(); } }, `☐ ${ts.length}`) : null));
  }));

  const hours = h('div.tg-hours', null, Array.from({ length: 24 }, (_, i) => h('span', { style: { top: i * HOUR + 'px' } }, i ? `${String(i).padStart(2, '0')}:00` : '')));
  const cols = days.map((d) => {
    const items = [];
    for (const o of eventsOn(d)) if (o.ev.start) { const s = toMin(o.ev.start); items.push({ s, e: Math.min(s + Math.max(o.ev.duration || 30, 20), 1440), occ: o }); }
    for (const x of tasksOn(d)) if (x.time) { const s = toMin(x.time); items.push({ s, e: Math.min(s + 30, 1440), task: x }); }
    const col = h('div.tg-col' + (d === t ? '.today' : ''), { onclick: (e) => {
      if (e.target !== col) return;
      const min = Math.floor(((e.offsetY / HOUR) * 60) / 30) * 30;
      openEventEditor({ date: d, start: fromMin(min), duration: 60 });
    } });
    for (const it of layout(items)) {
      const style = { top: (it.s / 60) * HOUR + 'px', height: Math.max(((it.e - it.s) / 60) * HOUR - 2, 22) + 'px', left: `calc(${(it.col / it.cols) * 100}% + 2px)`, width: `calc(${100 / it.cols}% - 4px)` };
      if (it.occ) {
        const ev = it.occ.ev;
        col.append(h('button.tg-event' + (it.occ.done ? '.done' : ''), { type: 'button', style: { ...style, '--c': eventColor(ev) }, onclick: () => openEventEditor(ev.id, d) },
          h('b', null, ev.title), h('small', null, `${ev.start}–${fromMin(toMin(ev.start) + (ev.duration || 0))}`)));
      } else {
        const task = it.task;
        const check = h(`span.check.small.p${task.priority || 0}`, { role: 'button', 'aria-label': 'Отметить выполненной', onclick: (e) => { e.stopPropagation(); completeWithFeedback(task, block, check); } });
        const block = h('button.tg-event.task', { type: 'button', style, onclick: () => openTaskEditor(task.id) }, check, h('b', null, task.title));
        col.append(block);
      }
    }
    if (d === t) col.append(h('div.tg-now', { style: { top: (toMin(nowHM()) / 60) * HOUR + 'px' } }));
    return col;
  });

  const scroll = h('div.tg-scroll', { onscroll: (e) => { state.scroll = e.target.scrollTop; } }, h('div.tg-body', { style: { height: 24 * HOUR + 'px' } }, hours, cols));
  // После вставки в страницу — прокрутить к текущему времени (или туда, где был пользователь)
  requestAnimationFrame(() => { scroll.scrollTop = state.scroll ?? Math.max(0, (toMin(nowHM()) / 60 - 2) * HOUR); });
  const grid = h('div.tg.card' + (single ? '.single' : ''), { style: { '--days': days.length } }, head, allday, scroll);
  addSwipe(grid);
  return grid;
}

export const transientParams = true;

export function render(el, params) {
  if (params[0] && MODES.some((m) => m.v === params[0])) {
    state.mode = params[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(params[1] || '')) state.cursor = params[1];
  }
  el.append(h('div.cal-bar', null,
    h('div.row.cal-nav', null,
      h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Назад', onclick: () => shift(-1) }, icon('chevronLeft')),
      h('h2.cal-title', null, periodTitle()),
      h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Вперёд', onclick: () => shift(1) }, icon('chevronRight')),
      h('span.grow'),
      state.cursor !== today() && h('button.btn.btn-soft.small', { type: 'button', onclick: () => { state.cursor = today(); state.scroll = null; refresh(); } }, 'Сегодня'),
      h('button.btn.btn-primary.small.cal-add', { type: 'button', onclick: () => openEventEditor({ date: state.cursor }) }, icon('plus', 16), 'Событие')),
    segmented(MODES, state.mode, (v) => { state.mode = v; state.scroll = null; refresh(); })));

  if (state.mode === 'month') el.append(...monthView());
  else if (state.mode === 'week') { const s = weekStart(state.cursor); el.append(timeGrid(Array.from({ length: 7 }, (_, i) => addDays(s, i)))); }
  else el.append(timeGrid([state.cursor]));
  if (!store.count('events') && state.mode !== 'month') el.append(h('p.muted.small.center', null, 'Нажми на пустое место в сетке, чтобы создать событие на это время.'));
}
