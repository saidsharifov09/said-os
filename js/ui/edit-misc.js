// Редакторы цели, привычки и записи истории.

import { h, icon, fill } from './dom.js';
import { openSheet, toast } from './sheet.js';
import { field, group, chipSelect, colorPicker, weekdayPicker, checklistEditor, segmented } from './controls.js';
import * as actions from '../core/actions.js';
import * as store from '../core/store.js';
import { LOG_TYPES, colorOf } from '../core/schema.js';
import { today, addDays, weekStart, WD_SHORT, WEEK_ORDER, fmtRel, parseYmd } from '../core/dates.js';
import { goalProgress, habitStreak, habitBest, habitStats, habitDone, habitDue } from '../core/selectors.js';

const autoGrow = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px'; };
const delBtn = (onclick) => h('button.btn.btn-soft.danger', { type: 'button', onclick }, icon('trash', 18), 'Удалить');

// ======================= Цель =======================
export function openGoalEditor(arg = {}) {
  const existing = typeof arg === 'string' ? store.get('goals', arg) : null;
  if (typeof arg === 'string' && !existing) return;
  const F = ['title', 'notes', 'deadline', 'milestones', 'status', 'color'];
  const pick = (o) => Object.fromEntries(F.map((k) => [k, o[k] ?? null]));
  const draft = existing ? structuredClone(pick(existing)) : { title: '', notes: '', deadline: null, milestones: [], status: 'active', color: 'blue', ...arg };
  const before = JSON.stringify(draft);
  let skipSave = false;
  const save = () => {
    if (skipSave) return;
    if (existing) { if (JSON.stringify(draft) !== before) actions.updateGoal(existing.id, draft); }
    else if (draft.title.trim()) { actions.addGoal(draft); toast('Цель добавлена'); }
  };

  const tasksBox = h('div.stack.tight');
  const drawTasks = () => {
    if (!existing) return;
    const tasks = goalProgress(existing).tasks.sort((a, b) => (a.status === 'done') - (b.status === 'done'));
    const input = h('input.input', { placeholder: 'Новая задача для этой цели…', enterKeyHint: 'done', 'aria-label': 'Новая задача для цели', onkeydown: (e) => {
      if (e.key === 'Enter' && input.value.trim()) { actions.addTask({ title: input.value, goalId: existing.id }); drawTasks(); tasksBox.querySelector('input.input')?.focus(); }
    } });
    fill(tasksBox, 
      ...tasks.map((t) => h('div.checklist-row', null,
        h('button.check.small' + (t.status === 'done' ? '.checked' : ''), { type: 'button', 'aria-label': 'Отметить', onclick: () => { actions.toggleTask(t.id); drawTasks(); } }),
        h('span.grow' + (t.status === 'done' ? '.struck' : ''), null, t.title),
        h('span.muted.small', null, t.date ? fmtRel(t.date) : ''))),
      input);
  };
  drawTasks();

  const body = h('div.stack', null,
    h('textarea.input.title-input', { rows: 1, placeholder: 'Чего хочу достичь?', value: draft.title, 'aria-label': 'Название цели', oninput: (e) => { draft.title = e.target.value.replace(/\n/g, ' '); autoGrow(e.target); } }),
    h('textarea.input', { rows: 2, placeholder: 'Зачем мне это? Как пойму, что достиг?', value: draft.notes || '', 'aria-label': 'Описание', oninput: (e) => { draft.notes = e.target.value; autoGrow(e.target); } }),
    field('Срок', h('input.input', { type: 'date', value: draft.deadline || '', onchange: (e) => { draft.deadline = e.target.value || null; } })),
    group('Этапы', checklistEditor(draft.milestones || [], (l) => { draft.milestones = l; }, 'Добавить этап…')),
    existing && group('Задачи цели', tasksBox),
    group('Цвет', colorPicker(draft.color, (c) => { draft.color = c; })),
    existing && group('Статус', segmented([{ v: 'active', label: 'В работе' }, { v: 'done', label: 'Достигнута' }, { v: 'paused', label: 'На паузе' }], draft.status, (v) => { draft.status = v; })),
    existing && h('div.editor-actions', null, delBtn(() => {
      skipSave = true; actions.deleteGoal(existing.id); sheet.close();
      toast('Цель в корзине', { action: { label: 'Вернуть', onclick: () => actions.restoreItem('goals', existing.id) } });
    })));
  const sheet = openSheet({ title: existing ? 'Цель' : 'Новая цель', body, onClose: save });
  if (!existing) body.querySelector('textarea').focus();
  return sheet;
}

// ======================= Привычка =======================
export function openHabitEditor(arg = {}) {
  const existing = typeof arg === 'string' ? store.get('habits', arg) : null;
  if (typeof arg === 'string' && !existing) return;
  const F = ['title', 'emoji', 'color', 'days', 'archived'];
  const pick = (o) => Object.fromEntries(F.map((k) => [k, o[k] ?? null]));
  const draft = existing ? structuredClone(pick(existing)) : { title: '', emoji: '', color: 'sky', days: [], archived: false, ...arg };
  const before = JSON.stringify(draft);
  let skipSave = false;
  const save = () => {
    if (skipSave) return;
    if (existing) { if (JSON.stringify(draft) !== before) actions.updateHabit(existing.id, draft); }
    else if (draft.title.trim()) { actions.addHabit(draft); toast('Привычка добавлена'); }
  };

  // Статистика и календарь отметок за 5 недель
  const stats = h('div.stack');
  const drawStats = () => {
    if (!existing) return;
    const hb = store.get('habits', existing.id);
    const w = habitStats(hb, 7), m = habitStats(hb, 30);
    const start = addDays(weekStart(today()), -28);
    const cells = [];
    for (let i = 0; i < 35; i++) {
      const d = addDays(start, i);
      const future = d > today();
      cells.push(h('button.habit-cell' + (habitDone(hb, d) ? '.on' : '') + (d === today() ? '.today' : '') + (!habitDue(hb, d) ? '.off' : ''), {
        type: 'button', disabled: future, 'aria-label': `${fmtRel(d)}: ${habitDone(hb, d) ? 'выполнено' : 'нет'}`, style: { '--c': colorOf(hb.color) },
        onclick: () => { actions.toggleHabit(hb.id, d); drawStats(); },
      }, parseYmd(d).getDate()));
    }
    fill(stats, 
      h('div.stat-row', null,
        h('div.stat', null, h('b', null, '🔥 ' + habitStreak(hb)), h('span', null, 'серия')),
        h('div.stat', null, h('b', null, habitBest(hb)), h('span', null, 'рекорд')),
        h('div.stat', null, h('b', null, w.percent + '%'), h('span', null, `неделя · ${w.done}/${w.due}`)),
        h('div.stat', null, h('b', null, m.percent + '%'), h('span', null, `месяц · ${m.done}/${m.due}`))),
      h('div.habit-grid', null, WEEK_ORDER.map((d) => h('span.habit-wd', null, WD_SHORT[d])), cells),
      h('p.muted.small', null, 'Нажми на день, чтобы поставить или снять отметку.'));
  };
  drawStats();

  const body = h('div.stack', null,
    h('input.input.title-input', { placeholder: 'Например: зарядка 10 минут', value: draft.title, 'aria-label': 'Название привычки', oninput: (e) => { draft.title = e.target.value; } }),
    existing && stats,
    group('Дни недели (пусто — каждый день)', weekdayPicker(draft.days, (d) => { draft.days = d; })),
    group('Цвет', colorPicker(draft.color, (c) => { draft.color = c; })),
    existing && h('div.editor-actions', null,
      h('button.btn.btn-soft', { type: 'button', onclick: () => { draft.archived = !draft.archived; sheet.close(); toast(draft.archived ? 'Привычка в архиве' : 'Привычка возвращена'); } }, icon('archive', 18), draft.archived ? 'Вернуть из архива' : 'В архив'),
      delBtn(() => {
        skipSave = true; actions.deleteHabit(existing.id); sheet.close();
        toast('Привычка в корзине', { action: { label: 'Вернуть', onclick: () => actions.restoreItem('habits', existing.id) } });
      })));
  const sheet = openSheet({ title: existing ? 'Привычка' : 'Новая привычка', body, onClose: save });
  if (!existing) body.querySelector('input').focus();
  return sheet;
}

// ======================= Запись истории =======================
export function openLogEditor(arg = {}) {
  const existing = typeof arg === 'string' ? store.get('log', arg) : null;
  if (typeof arg === 'string' && !existing) return;
  const F = ['date', 'time', 'type', 'text', 'people', 'place', 'taskId', 'eventId'];
  const pick = (o) => Object.fromEntries(F.map((k) => [k, o[k] ?? null]));
  const d = new Date();
  const draft = existing ? structuredClone(pick(existing)) : { ...pick({ date: today(), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, type: 'did', text: '', people: '', place: '' }), ...arg };
  const before = JSON.stringify(draft);
  let skipSave = false;
  const save = () => {
    if (skipSave) return;
    if (existing) { if (JSON.stringify(draft) !== before) actions.updateLog(existing.id, draft); }
    else if (draft.text?.trim()) { actions.addLog(draft); toast('Записано в историю'); }
  };
  const linked = (draft.taskId && store.get('tasks', draft.taskId)) || (draft.eventId && store.get('events', draft.eventId));
  const text = h('textarea.input.title-input', { rows: 2, placeholder: 'Что произошло?', value: draft.text || '', 'aria-label': 'Текст записи', oninput: (e) => { draft.text = e.target.value; autoGrow(e.target); } });
  const body = h('div.stack', null,
    group('Тип', chipSelect(LOG_TYPES, draft.type, (v) => { draft.type = v; })),
    text,
    h('div.row.gap', null,
      field('Дата', h('input.input', { type: 'date', value: draft.date, max: today(), onchange: (e) => { if (e.target.value) draft.date = e.target.value; } })),
      field('Время', h('input.input', { type: 'time', value: draft.time || '', onchange: (e) => { draft.time = e.target.value || ''; } }))),
    field('С кем', h('input.input', { value: draft.people || '', placeholder: 'Имена через запятую', oninput: (e) => { draft.people = e.target.value; } })),
    field('Где (вписывается вручную, геолокация не используется)', h('input.input', { value: draft.place || '', placeholder: 'Место', oninput: (e) => { draft.place = e.target.value; } })),
    linked && !linked.deletedAt && h('div.linked-chip', null, icon(draft.taskId ? 'checkCircle' : 'calendar', 18), (draft.taskId ? 'Задача: ' : 'Событие: ') + linked.title),
    existing && h('div.editor-actions', null, delBtn(() => {
      skipSave = true; actions.deleteLog(existing.id); sheet.close();
      toast('Запись в корзине', { action: { label: 'Вернуть', onclick: () => actions.restoreItem('log', existing.id) } });
    })));
  const sheet = openSheet({ title: existing ? 'Запись истории' : 'Новая запись', body, onClose: save });
  requestAnimationFrame(() => autoGrow(text));
  if (!existing) text.focus();
  return sheet;
}
