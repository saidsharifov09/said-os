// Редактор задачи. Изменения сохраняются при закрытии окна (кнопка «Готово», фон или Esc).

import { h, icon, fill } from './dom.js';
import { openSheet, toast, confirmSheet } from './sheet.js';
import { field, group, segmented, chipSelect, datePicker, repeatPicker, remindSelect, checklistEditor } from './controls.js';
import * as actions from '../core/actions.js';
import * as store from '../core/store.js';
import { categories, focusTasks } from '../core/selectors.js';
import { PRIORITIES, colorOf } from '../core/schema.js';
import { today } from '../core/dates.js';
import { taskAsEvent } from '../core/ics.js';
import { openIcsSheet } from './ics-sheet.js';
import { openEventEditor } from './edit-event.js';
import { openLogEditor } from './edit-misc.js';

const FIELDS = ['title', 'notes', 'date', 'time', 'remind', 'priority', 'category', 'subtasks', 'repeat', 'goalId'];
const pick = (o) => Object.fromEntries(FIELDS.map((k) => [k, o[k] ?? null]));

// arg — id существующей задачи или объект с начальными полями для новой
export function openTaskEditor(arg = {}) {
  const existing = typeof arg === 'string' ? store.get('tasks', arg) : null;
  if (typeof arg === 'string' && !existing) return;
  const draft = existing ? structuredClone(pick(existing)) : { ...pick({ title: '', notes: '', priority: 0, subtasks: [] }), ...arg };
  const before = JSON.stringify(pick(draft));
  let skipSave = false;

  const save = () => {
    if (skipSave) return;
    if (existing) {
      if (JSON.stringify(pick(draft)) !== before) {
        // если дату серии поменяли вручную — серия начинается заново с этой даты
        actions.updateTask(existing.id, { ...pick(draft), ...(draft.date !== existing.date ? { seriesStart: null } : {}) });
      }
    } else if (draft.title.trim()) {
      actions.addTask(draft);
      toast('Задача добавлена');
    }
  };

  const title = h('textarea.input.title-input', { rows: 1, placeholder: 'Что нужно сделать?', value: draft.title, 'aria-label': 'Название',
    oninput: (e) => { draft.title = e.target.value.replace(/\n/g, ' '); autoGrow(e.target); },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); sheet.close(); } } });
  const notes = h('textarea.input', { rows: 2, placeholder: 'Описание, детали…', value: draft.notes || '', 'aria-label': 'Описание',
    oninput: (e) => { draft.notes = e.target.value; autoGrow(e.target); } });

  // Блок «когда»: дата, время, напоминание
  const when = h('div.stack');
  const drawWhen = () => {
    fill(when, 
      group('Дата', datePicker(draft.date, (d) => { draft.date = d; if (!d) { draft.time = null; draft.remind = null; } drawWhen(); })),
      draft.date && h('div.row.gap', null,
        field('Время', h('input.input', { type: 'time', value: draft.time || '', onchange: (e) => {
          const had = !!draft.time;
          draft.time = e.target.value || null;
          if (draft.time && !had && draft.remind == null) draft.remind = 0;
          if (!draft.time) draft.remind = null;
          drawWhen();
        } })),
        draft.time && field('Напомнить', remindSelect(draft.remind, (v) => { draft.remind = v; }))),
      draft.date && group('Повторять', repeatPicker(draft.repeat, (r) => { draft.repeat = r; })));
  };
  drawWhen();

  const cats = categories().map((c) => ({ v: c.id, label: c.name, color: colorOf(c.color) }));
  const goals = store.all('goals').filter((g) => g.status === 'active' || g.id === draft.goalId);

  const isFocus = () => existing && store.get('tasks', existing.id)?.focusDate === today();
  const focusBtn = existing && existing.status !== 'done' && h('button.btn.btn-soft', { type: 'button', onclick: () => {
    const on = !isFocus();
    if (!actions.setFocus(existing.id, on)) { toast('Уже выбрано 3 главных дела. Сними одно, чтобы добавить это.'); return; }
    if (on && !draft.date) { draft.date = today(); drawWhen(); }
    focusBtn.classList.toggle('active', on);
    toast(on ? 'Добавлено в главное на сегодня' : 'Убрано из главного');
  } }, icon('star', 18), 'Главное на сегодня');
  if (focusBtn && isFocus()) focusBtn.classList.add('active');

  const body = h('div.stack', null,
    title, notes, when,
    group('Приоритет', segmented(PRIORITIES, draft.priority || 0, (v) => { draft.priority = v; })),
    cats.length > 0 && group('Категория', chipSelect(cats, draft.category, (v) => { draft.category = v; }, { allowNone: true })),
    group('Подзадачи', checklistEditor(draft.subtasks || [], (list) => { draft.subtasks = list; })),
    goals.length > 0 && field('Цель', h('select.input', { onchange: (e) => { draft.goalId = e.target.value || null; } },
      h('option', { value: '' }, 'Без цели'), goals.map((g) => h('option', { value: g.id, selected: g.id === draft.goalId }, g.title)))),
    existing && h('div.editor-actions', null,
      focusBtn,
      h('button.btn.btn-soft', { type: 'button', onclick: () => openIcsSheet(taskAsEvent({ ...draft, id: existing.id }), draft.remind) }, icon('bell', 18), 'В Календарь iPhone'),
      h('button.btn.btn-soft', { type: 'button', onclick: () => {
        sheet.close();
        const ev = actions.scheduleTask(existing.id, {});
        if (ev) { openEventEditor(ev.id, ev.date); toast('Создано событие, связанное с задачей'); }
      } }, icon('calendar', 18), 'Запланировать в календаре'),
      h('button.btn.btn-soft', { type: 'button', onclick: () => { sheet.close(); openLogEditor({ text: draft.title, type: 'did', taskId: existing.id }); } }, icon('history', 18), 'Записать в историю'),
      h('button.btn.btn-soft.danger', { type: 'button', onclick: () => {
        skipSave = true; actions.deleteTask(existing.id); sheet.close();
        toast('Задача в корзине', { action: { label: 'Вернуть', onclick: () => actions.restoreItem('tasks', existing.id) } });
      } }, icon('trash', 18), 'Удалить')));

  const sheet = openSheet({ title: existing ? 'Задача' : 'Новая задача', body, onClose: save });
  requestAnimationFrame(() => { autoGrow(title); autoGrow(notes); });
  if (!existing) title.focus();
  return sheet;
}

export function autoGrow(ta, max = 320) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight + 2, max) + 'px';
}
