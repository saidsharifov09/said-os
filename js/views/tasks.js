// «Задачи»: разделы по срокам, фильтры, сортировка, быстрое добавление, перенос.

import { h, icon } from '../ui/dom.js';
import { toast } from '../ui/sheet.js';
import { refresh } from '../ui/refresh.js';
import { taskRow, empty } from '../ui/items.js';
import { openTaskEditor } from '../ui/edit-task.js';
import * as actions from '../core/actions.js';
import { today, addDays, fmtRel, fmtFull, ymd } from '../core/dates.js';
import { TASK_BUCKETS, tasksIn, bucketCounts, sortTasks, SORTS, categories } from '../core/selectors.js';
import { PRIORITIES } from '../core/schema.js';
import { parseRu } from '../core/parse-date.js';

// Состояние экрана (живёт, пока открыто приложение)
const state = { bucket: 'today', cat: '', prio: '', sort: 'time', filtersOpen: false };

const EMPTY = {
  today: ['☀️', 'На сегодня задач нет', 'Добавь одну маленькую — с неё проще начать.'],
  tomorrow: ['🌤️', 'На завтра пусто', ''],
  week: ['🗓️', 'На этой неделе больше ничего', ''],
  future: ['🔭', 'В будущем пока пусто', ''],
  nodate: ['🧺', 'Нет задач без даты', 'Сюда попадают дела «когда-нибудь».'],
  overdue: ['✨', 'Ничего не просрочено', 'Так держать.'],
  done: ['🏁', 'Пока нет выполненных', ''],
};

function defaultDate(bucket) {
  const t = today();
  return { today: t, tomorrow: addDays(t, 1), week: addDays(t, 2), future: addDays(t, 7), nodate: null, overdue: t, done: t }[bucket];
}

export const transientParams = true;

export function render(el, params) {
  if (params[0] && TASK_BUCKETS.some((b) => b.v === params[0])) { state.bucket = params[0]; }
  const counts = bucketCounts();
  const rerender = refresh;

  // --- Разделы ---
  el.append(h('div.bucket-tabs', { role: 'tablist' }, TASK_BUCKETS.map((b) => h('button.bucket' + (b.v === state.bucket ? '.active' : '') + (b.v === 'overdue' && counts.overdue ? '.warn' : ''), {
    type: 'button', role: 'tab', 'aria-selected': String(b.v === state.bucket), onclick: () => { state.bucket = b.v; rerender(); },
  }, b.label, b.v !== 'done' && counts[b.v] ? h('span.count', null, counts[b.v]) : null))));

  // --- Быстрое добавление + фильтры ---
  const filtersActive = state.cat || state.prio !== '' || state.sort !== 'time';
  const quick = h('input.input.quick-add', { placeholder: '+ Новая задача (можно «завтра в 15:00»)', enterKeyHint: 'done', 'aria-label': 'Новая задача', dataset: { keep: 'tasks-add' }, onkeydown: (e) => {
    if (e.key !== 'Enter' || !quick.value.trim()) return;
    const hint = parseRu(quick.value);
    const task = actions.addTask({ title: hint ? hint.clean : quick.value, date: hint ? hint.date : defaultDate(state.bucket), time: hint?.time || null, category: state.cat || null });
    quick.value = '';
    if (hint) toast('Добавлено: ' + fmtRel(task.date).toLowerCase() + (task.time ? ', ' + task.time : ''), { action: { label: 'Изменить', onclick: () => openTaskEditor(task.id) } });
  } });
  el.append(h('div.row.gap.toolbar', null, quick,
    h('button.icon-btn.soft' + (filtersActive ? '.active' : ''), { type: 'button', 'aria-label': 'Фильтры и сортировка', 'aria-expanded': String(state.filtersOpen), onclick: () => { state.filtersOpen = !state.filtersOpen; rerender(); } }, icon('filter'))));

  if (state.filtersOpen) {
    const sel = (label, value, options, onchange) => h('label.field.grow', null, h('span.field-label', null, label),
      h('select.input', { onchange: (e) => { onchange(e.target.value); rerender(); } }, options.map(([v, l]) => h('option', { value: v, selected: String(value) === String(v) }, l))));
    el.append(h('div.card.filters', null,
      sel('Категория', state.cat, [['', 'Все'], ...categories().map((c) => [c.id, c.name])], (v) => { state.cat = v; }),
      sel('Приоритет', state.prio, [['', 'Любой'], ...PRIORITIES.map((p) => [p.v, p.label])], (v) => { state.prio = v; }),
      sel('Сортировка', state.sort, SORTS.map((s) => [s.v, s.label]), (v) => { state.sort = v; }),
      filtersActive && h('button.btn.btn-soft.small', { type: 'button', onclick: () => { Object.assign(state, { cat: '', prio: '', sort: 'time' }); rerender(); } }, 'Сбросить')));
  }

  // --- Список ---
  let list = tasksIn(state.bucket);
  if (state.cat) list = list.filter((t) => t.category === state.cat);
  if (state.prio !== '') list = list.filter((t) => (t.priority || 0) === Number(state.prio));
  if (state.bucket !== 'done') list = sortTasks(list, state.sort);

  if (!list.length) {
    const [emoji, title, text] = filtersActive && tasksIn(state.bucket).length ? ['🔎', 'Под фильтр ничего не подошло', ''] : EMPTY[state.bucket];
    el.append(empty(emoji, title, text));
    return;
  }

  if (state.bucket === 'overdue') {
    el.append(h('div.row.gap.wrap', null,
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { actions.moveTasks(list.map((t) => t.id), today()); toast('Перенесено на сегодня'); } }, 'Всё на сегодня'),
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { actions.moveTasks(list.map((t) => t.id), addDays(today(), 1)); toast('Перенесено на завтра'); } }, 'Всё на завтра')));
  }

  // В разделах с разными датами группируем по дням (только при сортировке по времени)
  const grouped = ['week', 'future', 'overdue', 'done'].includes(state.bucket) && (state.sort === 'time' || state.bucket === 'done');
  if (!grouped) { el.append(h('div.card.list', null, list.map((t) => taskRow(t, { showDate: false })))); return; }
  const groups = new Map();
  for (const t of list.slice(0, 300)) {
    const key = state.bucket === 'done' ? ymd(new Date(t.doneAt || t.updatedAt)) : t.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  for (const [date, items] of groups) {
    el.append(h('h3.group-title', null, fmtRel(date) === fmtRel(date).toLowerCase() ? fmtFull(date) : `${fmtRel(date)} · ${fmtFull(date)}`),
      h('div.card.list', null, items.map((t) => taskRow(t, { showDate: false }))));
  }
}
