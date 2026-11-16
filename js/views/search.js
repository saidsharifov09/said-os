// Поиск по всему приложению.

import { h, icon, fill } from '../ui/dom.js';
import { empty } from '../ui/items.js';
import { search } from '../core/search.js';
import * as store from '../core/store.js';
import { openTaskEditor } from '../ui/edit-task.js';
import { openEventEditor } from '../ui/edit-event.js';
import { openNoteEditor } from '../ui/edit-note.js';
import { openGoalEditor, openHabitEditor, openLogEditor } from '../ui/edit-misc.js';

const state = { q: '' };
const ICON = { tasks: 'checkCircle', events: 'calendar', inbox: 'inbox', notes: 'note', goals: 'target', habits: 'flame', log: 'history' };

function open(item) {
  const fn = { tasks: openTaskEditor, notes: openNoteEditor, goals: openGoalEditor, habits: openHabitEditor, log: openLogEditor }[item.store];
  if (item.store === 'events') openEventEditor(item.id, store.get('events', item.id)?.date);
  else if (item.store === 'inbox') location.hash = '#/inbox';
  else fn?.(item.id);
}

function results(box) {
  const q = state.q.trim();
  if (!q) { fill(box, empty('🔎', 'Ищи где угодно', 'Задачи, события, заметки, входящие, цели, привычки и история — всё в одном месте.')); return; }
  const groups = search(q);
  if (!groups.length) { fill(box, empty('🤷', 'Ничего не нашлось', 'Попробуй другое слово или его часть.')); return; }
  fill(box, ...groups.map((g) => h('section', null,
    h('div.section-head', null, h('h2', null, g.label), h('span.count', null, g.total)),
    h('div.card.list', null, g.items.map((it) => h('button.result-row' + (it.done ? '.done' : ''), { type: 'button', onclick: () => open(it) },
      icon(it.later ? 'bookmark' : ICON[g.key], 20), h('span.event-main', null, h('span.task-title', null, it.title), h('span.task-meta', null, it.sub))))))));
}

export function render(el) {
  const box = h('div');
  const input = h('input.input.search-input', { type: 'search', placeholder: 'Что найти?', value: state.q, 'aria-label': 'Поиск', enterKeyHint: 'search', autocomplete: 'off', dataset: { keep: 'search' },
    oninput: (e) => { state.q = e.target.value; results(box); } });
  el.append(h('div.search-box', null, icon('search', 20), input), box);
  results(box);
  // На ноутбуке сразу ставим курсор в поле
  if (!matchMedia('(pointer: coarse)').matches) requestAnimationFrame(() => { if (document.activeElement === document.body) input.focus(); });
}
