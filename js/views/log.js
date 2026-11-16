// «История» (Life Log): хронологическая лента — где был, что делал, с кем встречался, что узнал, что решил.
// Геолокация НЕ используется: место вписывается вручную.

import { h, icon } from '../ui/dom.js';
import { refresh } from '../ui/refresh.js';
import { empty } from '../ui/items.js';
import { openLogEditor } from '../ui/edit-misc.js';
import { openTaskEditor } from '../ui/edit-task.js';
import { openEventEditor } from '../ui/edit-event.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { LOG_TYPES } from '../core/schema.js';
import { today, addDays, ymd, fmtFull, fmtRel } from '../core/dates.js';
import { eventsOn } from '../core/selectors.js';

const state = { q: '', type: '', auto: true, addType: 'did', days: 30 };
const typeOf = (v) => LOG_TYPES.find((t) => t.v === v) || LOG_TYPES[LOG_TYPES.length - 1];

function entry(l) {
  const t = typeOf(l.type);
  const linked = (l.taskId && store.get('tasks', l.taskId)) || (l.eventId && store.get('events', l.eventId));
  return h('button.card.log-item', { type: 'button', onclick: () => openLogEditor(l.id) },
    h('span.log-emoji', { title: t.label }, t.emoji),
    h('span.event-main', null,
      h('span.log-text', null, l.text),
      h('span.task-meta', null, [l.time && h('span.meta-time', null, l.time), h('span', null, t.label), l.people && h('span', null, '👥 ' + l.people), l.place && h('span', null, '📍 ' + l.place),
        linked && !linked.deletedAt && h('span', null, '🔗 ' + linked.title)].filter(Boolean))));
}
// Выполненные задачи и события показываются в ленте автоматически (пунктиром)
const autoItem = (emoji, time, text, label, onclick) => h('button.log-item.auto', { type: 'button', onclick },
  h('span.log-emoji', null, emoji), h('span.event-main', null, h('span.task-title', null, text), h('span.task-meta', null, time && h('span.meta-time', null, time), h('span', null, label))));

export function render(el) {
  // --- Быстрая запись ---
  const input = h('input.input.quick-add', { placeholder: '+ Что произошло?', enterKeyHint: 'done', 'aria-label': 'Новая запись в историю', dataset: { keep: 'log-add' }, onkeydown: (e) => {
    if (e.key === 'Enter' && input.value.trim()) { actions.addLog({ text: input.value, type: state.addType }); input.value = ''; }
  } });
  const typeSel = h('select.input.type-select', { 'aria-label': 'Тип записи', onchange: (e) => { state.addType = e.target.value; } },
    LOG_TYPES.map((t) => h('option', { value: t.v, selected: t.v === state.addType }, `${t.emoji} ${t.label}`)));
  el.append(h('div.row.gap.toolbar', null, typeSel, input,
    h('button.icon-btn.soft', { type: 'button', 'aria-label': 'Подробная запись', title: 'Подробная запись (с кем, где, когда)', onclick: () => openLogEditor({ type: state.addType }) }, icon('edit'))));

  // --- Поиск и фильтр ---
  const search = h('input.input.search-input', { type: 'search', placeholder: 'Поиск по истории', value: state.q, 'aria-label': 'Поиск по истории', dataset: { keep: 'log-search' }, oninput: (e) => { state.q = e.target.value; refresh(); } });
  el.append(h('div.search-box', null, icon('search', 20), search));
  el.append(h('div.chips.scroll', null,
    h('button.chip' + (!state.type ? '.active' : ''), { type: 'button', onclick: () => { state.type = ''; refresh(); } }, 'Всё'),
    LOG_TYPES.map((t) => h('button.chip' + (state.type === t.v ? '.active' : ''), { type: 'button', onclick: () => { state.type = state.type === t.v ? '' : t.v; refresh(); } }, t.emoji, ' ', t.label)),
    h('button.chip' + (state.auto ? '.active' : ''), { type: 'button', title: 'Показывать в ленте выполненные задачи и события календаря', onclick: () => { state.auto = !state.auto; refresh(); } }, icon('checkCircle', 14), 'Задачи и события')));

  // --- Лента ---
  const q = state.q.trim().toLowerCase();
  const match = (...f) => !q || f.join(' ').toLowerCase().includes(q);
  const byDay = new Map();
  const push = (date, sort, node) => { if (!byDay.has(date)) byDay.set(date, []); byDay.get(date).push({ sort, node }); };

  for (const l of store.all('log')) {
    if (state.type && l.type !== state.type) continue;
    if (!match(l.text, l.people, l.place)) continue;
    push(l.date, l.time || '99:99', entry(l));
  }
  const from = addDays(today(), -state.days);
  if (state.auto && !state.type) {
    for (const t of store.all('tasks')) {
      if (t.status !== 'done' || !t.doneAt || !match(t.title)) continue;
      const d = new Date(t.doneAt), date = ymd(d);
      if (date < from) continue;
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      push(date, time, autoItem('☑️', time, t.title, 'задача выполнена', () => openTaskEditor(t.id)));
    }
    for (let i = 0; i <= state.days; i++) {
      const date = addDays(today(), -i);
      for (const o of eventsOn(date)) {
        if (!match(o.ev.title, o.ev.location)) continue;
        if (date === today() && !o.done) continue; // сегодняшние события попадают в историю после отметки
        push(date, o.ev.start || '00:00', autoItem('🗓️', o.ev.start, o.ev.title, o.done ? 'событие · выполнено' : 'событие', () => openEventEditor(o.ev.id, date)));
      }
    }
  }

  const days = [...byDay.keys()].sort().reverse();
  if (!days.length) {
    el.append(empty('📖', q || state.type ? 'Ничего не нашлось' : 'История пока пуста', q || state.type ? '' : 'Записывай коротко: где был, с кем виделся, что узнал, что решил. Через месяц скажешь себе спасибо.'));
    return;
  }
  for (const d of days) {
    const items = byDay.get(d).sort((a, b) => b.sort.localeCompare(a.sort));
    const rel = fmtRel(d);
    el.append(h('h3.group-title', null, ['Сегодня', 'Вчера'].includes(rel) ? `${rel} · ${fmtFull(d)}` : fmtFull(d) + (d.slice(0, 4) !== today().slice(0, 4) ? ' ' + d.slice(0, 4) : '')),
      h('div.log-day', null, items.map((x) => x.node)));
  }
  if (state.auto) el.append(h('button.btn.btn-soft.small', { type: 'button', style: { alignSelf: 'center' }, onclick: () => { state.days += 60; refresh(); } }, `Показать задачи и события старше ${state.days} дней`));
}
