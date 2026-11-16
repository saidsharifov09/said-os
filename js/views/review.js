// Утренний обзор и вечерний отчёт. Короткие, на одном экране, без лишних шагов.

import { h, icon } from '../ui/dom.js';
import { toast } from '../ui/sheet.js';
import { refresh } from '../ui/refresh.js';
import { segmented } from '../ui/controls.js';
import { taskRow, eventRow, sectionHead, ring } from '../ui/items.js';
import * as store from '../core/store.js';
import * as actions from '../core/actions.js';
import { today, addDays, fmtFull, plural } from '../core/dates.js';
import { tasksOn, overdueTasks, eventsOn, tasksDoneOn, progress, focusTasks } from '../core/selectors.js';

const state = { kind: null };

function morning(el) {
  const t = today();
  const overdue = overdueTasks(), tasks = tasksOn(t), events = eventsOn(t), focus = focusTasks(t);
  const inbox = store.count('inbox');
  el.append(h('p.muted.lead', null, 'Минута, чтобы увидеть день целиком. Ничего не нужно держать в голове.'));

  if (overdue.length) el.append(h('section', null,
    sectionHead('Осталось с прошлых дней', overdue.length),
    h('div.row.gap.wrap', null,
      h('button.btn.btn-primary.small', { type: 'button', onclick: () => { actions.moveTasks(overdue.map((x) => x.id), t); toast('Перенесено на сегодня'); } }, 'Всё на сегодня'),
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { actions.moveTasks(overdue.map((x) => x.id), addDays(t, 1)); toast('Перенесено на завтра'); } }, 'Всё на завтра'),
      h('button.btn.btn-soft.small', { type: 'button', onclick: () => { actions.moveTasks(overdue.map((x) => x.id), null); toast('Даты сняты'); } }, 'Снять даты')),
    h('div.card.list', null, overdue.map((x) => taskRow(x)))));

  if (inbox) el.append(h('a.prompt', { href: '#/inbox' }, icon('inbox'), h('span.grow', null, h('b', null, `Во входящих: ${inbox}`), h('small', null, 'Разбери, чтобы ничего не потерялось')), icon('chevronRight', 18)));

  el.append(h('section', null, sectionHead('События сегодня', events.length || null),
    h('div.card.list', null, events.length ? events.map((o) => eventRow(o)) : h('div.list-empty', null, 'Событий нет — день свободен.'))));

  el.append(h('section', null, sectionHead('Задачи на сегодня', tasks.length || null),
    h('p.muted.small', null, `Отметь звёздочкой до трёх главных дел (выбрано ${focus.length} из 3). Остальное — по возможности.`),
    h('div.card.list', null, tasks.length ? tasks.map((x) => taskRow(x, { showDate: false, move: true, extra: h('button.icon-btn.small' + (x.focusDate === t ? '.star-on' : '.ghost'), {
      type: 'button', 'aria-label': 'Главное дело', 'aria-pressed': String(x.focusDate === t),
      onclick: () => { if (!actions.setFocus(x.id, x.focusDate !== t)) toast('Уже выбрано 3 главных дела'); },
    }, icon('star', 20)) })) : h('div.list-empty', null, 'Задач на сегодня нет. Добавь одну через «+».'))));

  el.append(h('button.btn.btn-primary.big', { type: 'button', onclick: () => { actions.markReview('morning'); toast('Хорошего дня!'); location.hash = '#/today'; } }, icon('sun'), 'Начать день'));
}

function evening(el) {
  const t = today();
  const done = tasksDoneOn(t), left = [...overdueTasks(), ...tasksOn(t)], p = progress(t);
  const eventsDone = eventsOn(t).filter((o) => o.done);
  el.append(h('div.card.hero', null,
    h('div.hero-text', null, h('div.hero-greet', null, 'Итоги дня'), h('div.hero-date', null, fmtFull(t)),
      h('div.muted', null, done.length ? `Сделано: ${done.length} ${plural(done.length, 'задача', 'задачи', 'задач')}` + (eventsDone.length ? `, событий: ${eventsDone.length}` : '') : 'Сегодня без отметок — и это нормально.')),
    h('div.hero-ring', null, ring(p.percent, 84))));

  if (done.length) el.append(h('section', null, sectionHead('Что сделал', done.length), h('div.card.list', null, done.map((x) => taskRow(x, { showDate: false, move: false })))));

  if (left.length) el.append(h('section', null,
    sectionHead('Что не успел', left.length),
    h('button.btn.btn-primary.big', { type: 'button', onclick: () => { const n = actions.carryOver(addDays(t, 1), t); toast(`Перенесено на завтра: ${n}`); } }, icon('arrowRight'), 'Перенести всё на завтра'),
    h('div.card.list', null, left.map((x) => taskRow(x)))));
  else el.append(h('div.card.cheer', null, '✨ Хвостов нет. Завтра начнёшь с чистого листа.'));

  const note = h('textarea.input', { rows: 2, placeholder: 'Что запомнилось сегодня? (необязательно — попадёт в «Историю»)', 'aria-label': 'Что запомнилось', dataset: { keep: 'evening-note' } });
  el.append(h('section', null, sectionHead('Одной строкой'), note));

  el.append(h('button.btn.btn-primary.big', { type: 'button', onclick: () => {
    if (note.value.trim()) actions.addLog({ text: note.value, type: 'other' });
    note.value = '';
    actions.markReview('evening'); toast('День закрыт. Отдыхай.'); location.hash = '#/today';
  } }, icon('moon'), 'Закрыть день'));
}

export const transientParams = true;

export function render(el, params) {
  if (params[0] === 'morning' || params[0] === 'evening') { state.kind = params[0]; }
  state.kind ||= new Date().getHours() < 15 ? 'morning' : 'evening';
  el.append(segmented([{ v: 'morning', label: 'Утренний обзор' }, { v: 'evening', label: 'Вечерний отчёт' }], state.kind, (v) => { state.kind = v; refresh(); }, 'wide'));
  (state.kind === 'morning' ? morning : evening)(el);
}
