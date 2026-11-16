// Строки списков: задача, событие, пустое состояние. Используются на всех экранах.

import { h, icon, burst, reducedMotion } from './dom.js';
import { toast, openMenu } from './sheet.js';
import { moveOptions } from './controls.js';
import * as actions from '../core/actions.js';
import * as store from '../core/store.js';
import { fmtRel, fmtDuration, toMin, fromMin, today } from '../core/dates.js';
import { repeatLabel } from '../core/recur.js';
import { isOverdue, categoryOf } from '../core/selectors.js';
import { colorOf } from '../core/schema.js';
import { openTaskEditor } from './edit-task.js';
import { openEventEditor } from './edit-event.js';

// Отметить задачу с приятной анимацией и возможностью отмены
export function completeWithFeedback(task, rowEl, checkEl) {
  const run = () => {
    const undo = actions.toggleTask(task.id);
    if (task.status !== 'done') toast(task.repeat ? 'Готово! Следующий раз — ' + fmtRel(store.get('tasks', task.id)?.date).toLowerCase() : 'Готово!', { action: undo && { label: 'Отменить', onclick: undo } });
  };
  if (task.status === 'done' || reducedMotion()) return run();
  checkEl?.classList.add('checked');
  rowEl?.classList.add('completing');
  burst(checkEl);
  setTimeout(run, 420);
}

export function openMoveMenu(task) {
  openMenu('Перенести', [
    ...moveOptions((d) => { actions.moveTask(task.id, d); toast(d ? 'Перенесено: ' + fmtRel(d).toLowerCase() : 'Дата снята'); }),
    { label: 'Выбрать дату…', icon: 'edit', onclick: () => openTaskEditor(task.id) },
  ]);
}

// opts: showDate — показывать дату; move — кнопка переноса; extra — доп. элемент справа
export function taskRow(task, { showDate = true, move = true, extra = null } = {}) {
  const done = task.status === 'done';
  const overdue = isOverdue(task);
  const cat = categoryOf(task.category);
  const subs = task.subtasks || [];
  const meta = [
    task.time && h('span.meta-time', null, task.time),
    showDate && task.date && h('span' + (overdue ? '.overdue-text' : ''), null, fmtRel(task.date)),
    task.repeat && h('span.meta-icon', { title: repeatLabel(task.repeat) }, icon('repeat', 13), repeatLabel(task.repeat)),
    subs.length > 0 && h('span', null, `${subs.filter((s) => s.done).length}/${subs.length}`),
    cat && h('span.meta-cat', null, h('i.dot', { style: { background: colorOf(cat.color) } }), cat.name),
    task.focusDate === today() && !done && h('span.meta-icon.accent-text', null, icon('star', 13), 'главное'),
  ].filter(Boolean);

  const check = h(`button.check.p${task.priority || 0}` + (done ? '.checked' : ''), {
    type: 'button', 'aria-label': done ? 'Вернуть в работу' : 'Отметить выполненной',
    onclick: (e) => { e.stopPropagation(); completeWithFeedback(task, row, check); },
  });
  const row = h('div.task-row' + (done ? '.done' : '') + (overdue ? '.overdue' : ''), { dataset: { id: task.id } },
    check,
    h('button.task-main', { type: 'button', onclick: () => openTaskEditor(task.id) },
      h('span.task-title', null, task.title),
      meta.length > 0 && h('span.task-meta', null, meta)),
    extra,
    move && !done && h('button.icon-btn.small.ghost', { type: 'button', 'aria-label': 'Перенести', title: 'Перенести', onclick: () => openMoveMenu(task) }, icon('arrowRight', 18)));
  return row;
}

export const eventColor = (ev) => colorOf(ev.color || categoryOf(ev.category)?.color);

// Строка события. occ = { ev, date, done }
export function eventRow(occ, { showDate = false } = {}) {
  const { ev, date, done } = occ;
  const end = ev.start && ev.duration ? fromMin(toMin(ev.start) + ev.duration) : null;
  return h('button.event-row' + (done ? '.done' : ''), { type: 'button', style: { '--c': eventColor(ev) }, onclick: () => openEventEditor(ev.id, date) },
    h('span.event-time', null, ev.start ? [h('b', null, ev.start), end && h('small', null, end)] : h('small', null, 'весь день')),
    h('span.event-bar'),
    h('span.event-main', null,
      h('span.task-title', null, ev.title),
      h('span.task-meta', null, [
        showDate && h('span', null, fmtRel(date)),
        ev.start && ev.duration ? h('span', null, fmtDuration(ev.duration)) : null,
        ev.location && h('span', null, ev.location),
        ev.repeat && h('span.meta-icon', null, icon('repeat', 13), repeatLabel(ev.repeat)),
        done && h('span', null, 'выполнено'),
      ].filter(Boolean))));
}

export const empty = (emoji, title, text = '', action = null) => h('div.empty', null,
  h('div.empty-emoji', { 'aria-hidden': 'true' }, emoji), h('div.empty-title', null, title), text && h('div.empty-text', null, text), action);

export const sectionHead = (title, count = null, right = null) => h('div.section-head', null,
  h('h2', null, title), count != null && h('span.count', null, count), h('span.grow'), right);

// Кольцо прогресса
export function ring(percent, size = 64, label = null) {
  const r = 26, c = 2 * Math.PI * r;
  return h('div.ring', { style: { width: size + 'px', height: size + 'px' }, role: 'img', 'aria-label': `Выполнено ${percent}%`,
    html: `<svg viewBox="0 0 64 64"><circle class="ring-bg" cx="32" cy="32" r="${r}"/><circle class="ring-fg" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - percent / 100)}" transform="rotate(-90 32 32)"/></svg><b>${label ?? percent + '%'}</b>` });
}
