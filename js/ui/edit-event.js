// Редактор события календаря. Сохраняет при закрытии окна.

import { h, icon, fill } from './dom.js';
import { openSheet, toast, openMenu } from './sheet.js';
import { field, group, chipSelect, datePicker, repeatPicker, remindSelect, colorPicker, toggle } from './controls.js';
import * as actions from '../core/actions.js';
import * as store from '../core/store.js';
import { categories } from '../core/selectors.js';
import { colorOf } from '../core/schema.js';
import { today, toMin, fromMin, nowHM } from '../core/dates.js';
import { openIcsSheet } from './ics-sheet.js';
import { openTaskEditor, autoGrow } from './edit-task.js';
import { openLogEditor } from './edit-misc.js';

const FIELDS = ['title', 'notes', 'location', 'date', 'start', 'duration', 'color', 'category', 'repeat', 'remind'];
const pick = (o) => Object.fromEntries(FIELDS.map((k) => [k, o[k] ?? null]));
const DURATIONS = [{ v: 15, label: '15 мин' }, { v: 30, label: '30 мин' }, { v: 60, label: '1 час' }, { v: 90, label: '1,5 ч' }, { v: 120, label: '2 часа' }];

// arg — id события или объект с полями нового; occDate — день, который открыли (для повторяющихся)
export function openEventEditor(arg = {}, occDate = null) {
  const existing = typeof arg === 'string' ? store.get('events', arg) : null;
  if (typeof arg === 'string' && !existing) return;
  const draft = existing ? structuredClone(pick(existing)) : { ...pick({ title: '', notes: '', location: '', date: today(), duration: 60 }), ...arg };
  if (!existing && draft.start && draft.remind == null) draft.remind = 10;
  const before = JSON.stringify(pick(draft));
  const day = occDate || draft.date;
  let skipSave = false;

  const save = () => {
    if (skipSave) return;
    if (existing) { if (JSON.stringify(pick(draft)) !== before) actions.updateEvent(existing.id, pick(draft)); }
    else if (draft.title.trim()) { actions.addEvent(draft); toast('Событие добавлено'); }
  };

  const title = h('textarea.input.title-input', { rows: 1, placeholder: 'Название события', value: draft.title, 'aria-label': 'Название',
    oninput: (e) => { draft.title = e.target.value.replace(/\n/g, ' '); autoGrow(e.target); },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); sheet.close(); } } });

  const time = h('div.stack');
  const drawTime = () => {
    const end = draft.start ? fromMin(toMin(draft.start) + (draft.duration || 60)) : '';
    fill(time, 
      toggle('Весь день', !draft.start, (on) => {
        if (on) { draft.start = null; draft.remind = null; }
        else { const m = Math.ceil(toMin(nowHM()) / 30) * 30; draft.start = fromMin(Math.min(m, 23 * 60)); draft.remind ??= 10; }
        drawTime();
      }),
      draft.start && h('div.row.gap', null,
        field('Начало', h('input.input', { type: 'time', value: draft.start, onchange: (e) => { if (e.target.value) { draft.start = e.target.value; drawTime(); } } })),
        field('Конец', h('input.input', { type: 'time', value: end, onchange: (e) => {
          if (!e.target.value) return;
          let d = toMin(e.target.value) - toMin(draft.start);
          if (d <= 0) d += 1440;
          draft.duration = d; drawTime();
        } }))),
      draft.start && group('Длительность', chipSelect(DURATIONS, draft.duration, (v) => { draft.duration = v; drawTime(); })),
      draft.start && field('Напомнить (пока приложение открыто)', remindSelect(draft.remind, (v) => { draft.remind = v; })));
  };
  drawTime();

  const cats = categories().map((c) => ({ v: c.id, label: c.name, color: colorOf(c.color) }));
  const linked = existing?.taskId && store.get('tasks', existing.taskId);
  const done = existing?.doneDates?.includes(day);

  const remove = () => {
    const doDelete = (scope) => {
      skipSave = true; actions.deleteEvent(existing.id, { date: day, scope }); sheet.close();
      toast(scope === 'one' ? 'Этот день убран из серии' : 'Событие в корзине', scope === 'all' ? { action: { label: 'Вернуть', onclick: () => actions.restoreItem('events', existing.id) } } : {});
    };
    if (existing.repeat) openMenu('Удалить повторяющееся событие', [
      { label: 'Только этот день', icon: 'calendar', onclick: () => doDelete('one') },
      { label: 'Всю серию', icon: 'trash', danger: true, onclick: () => doDelete('all') },
    ]);
    else doDelete('all');
  };

  const body = h('div.stack', null,
    title,
    group('Дата' + (existing?.repeat ? ' начала серии' : ''), datePicker(draft.date, (d) => { draft.date = d; }, { allowNone: false })),
    time,
    group('Повторять', repeatPicker(draft.repeat, (r) => { draft.repeat = r; })),
    cats.length > 0 && group('Категория', chipSelect(cats, draft.category, (v) => { draft.category = v; }, { allowNone: true })),
    group('Цвет', colorPicker(draft.color || store.get('categories', draft.category)?.color || 'blue', (c) => { draft.color = c; })),
    field('Место', h('input.input', { value: draft.location || '', placeholder: 'Где?', oninput: (e) => { draft.location = e.target.value; } })),
    h('textarea.input', { rows: 2, placeholder: 'Заметки к событию…', value: draft.notes || '', 'aria-label': 'Заметки', oninput: (e) => { draft.notes = e.target.value; autoGrow(e.target); } }),
    linked && !linked.deletedAt && h('button.linked-chip', { type: 'button', onclick: () => { sheet.close(); openTaskEditor(linked.id); } }, icon('checkCircle', 18), 'Связано с задачей: ' + linked.title),
    existing && h('div.editor-actions', null,
      h('button.btn' + (done ? '.btn-soft.active' : '.btn-primary'), { type: 'button', onclick: () => { actions.toggleEventDone(existing.id, day); sheet.close(); toast(done ? 'Отметка снята' : 'Событие отмечено выполненным'); } },
        icon('check', 18), done ? 'Снять отметку' : 'Выполнено'),
      h('button.btn.btn-soft', { type: 'button', onclick: () => openIcsSheet({ ...draft, id: existing.id, exDates: existing.exDates }, draft.remind) }, icon('bell', 18), 'В Календарь iPhone'),
      h('button.btn.btn-soft', { type: 'button', onclick: () => { sheet.close(); openLogEditor({ text: draft.title, type: 'did', date: day, eventId: existing.id, place: draft.location || '' }); } }, icon('history', 18), 'Записать в историю'),
      h('button.btn.btn-soft.danger', { type: 'button', onclick: remove }, icon('trash', 18), 'Удалить')));

  const sheet = openSheet({ title: existing ? 'Событие' : 'Новое событие', body, onClose: save });
  requestAnimationFrame(() => autoGrow(title));
  if (!existing) title.focus();
  return sheet;
}
